"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import {
  addTemplatePartyAction,
  createTemplateAreaAction,
  createTemplateTeamAction,
  deleteTemplateAreaAction,
  deleteTemplatePartyAction,
  deleteTemplateTeamAction,
  reorderTemplatePartiesAction,
  reorderTemplateTeamsAction,
  updateTemplateAreaAction,
  updateTemplatePartyAction,
  updateTemplateSeatRoleAction,
  updateTemplateTeamAction,
  type TemplateStructureMutationResult,
} from "@/features/templates/structure-actions";
import {
  activateEventTemplateAction,
  inspectEventTemplateAction,
} from "@/features/templates/readiness-actions";
import {
  hasBlockingValidationIssues,
  type EventTemplateInspection,
  type TemplatePreviewParty,
  type TemplatePreviewTeam,
} from "@/features/templates/template-readiness";
import type { TemplateStructureSummary } from "@/features/templates/structure-server";
import {
  PARTY_MAX_SEAT_COUNT,
  PARTY_SEAT_COUNT,
  TEAM_MAX_PARTIES,
  moveOrderedId,
  type TemplateAreaNode,
  type TemplatePartyNode,
  type TemplateSectionNode,
  type TemplateSlotNode,
} from "@/features/templates/template-structure";

type EditorTarget =
  | {
      mode: "create" | "edit";
      kind: "area";
      id: string | null;
      parentId: null;
      name: string;
      sortOrder: number;
      partyCount: number;
      seatCount: number;
      roleLabel: string;
      internalName: string;
    }
  | {
      mode: "create" | "edit";
      kind: "team";
      id: string | null;
      parentId: string | null;
      name: string;
      sortOrder: number;
      partyCount: number;
      seatCount: number;
      roleLabel: string;
      internalName: string;
    }
  | {
      mode: "create" | "edit";
      kind: "party";
      id: string | null;
      parentId: string;
      name: string;
      sortOrder: number;
      partyCount: number;
      seatCount: number;
      originalSeatCount: number;
      roleLabel: string;
      internalName: string;
    }
  | {
      mode: "edit";
      kind: "seat";
      id: string;
      parentId: string;
      name: string;
      sortOrder: number;
      partyCount: number;
      seatCount: number;
      roleLabel: string;
      internalName: string;
    };

type DeleteTarget = {
  kind: "area" | "team" | "party";
  id: string;
  name: string;
  detail: string;
};

type DragItem = {
  kind: "team" | "party";
  id: string;
  parentId: string | null;
};

function swapOrderedIds(ids: string[], sourceId: string, targetId: string) {
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);

  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex === targetIndex
  ) {
    return ids;
  }

  const next = [...ids];
  [next[sourceIndex], next[targetIndex]] = [
    next[targetIndex],
    next[sourceIndex],
  ];
  return next;
}

function orderNodesByIds<T extends { id: string }>(
  nodes: T[],
  orderedIds: string[] | undefined,
) {
  if (!orderedIds) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((node): node is T => Boolean(node));
  const orderedIdSet = new Set(ordered.map((node) => node.id));

  return [
    ...ordered,
    ...nodes.filter((node) => !orderedIdSet.has(node.id)),
  ];
}

function statusTone(status: TemplateStructureSummary["status"]) {
  if (status === "active") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function MutationMessage({
  message,
  isError,
}: {
  message: string;
  isError: boolean;
}) {
  if (!message) return null;

  return (
    <p
      aria-live="polite"
      className={`mt-4 text-sm ${
        isError
          ? "text-[var(--danger)]"
          : "text-[var(--success)]"
      }`}
    >
      {message}
    </p>
  );
}

export function TemplateStructureDesigner({
  guildId,
  guildName,
  template,
}: {
  guildId: string;
  guildName: string;
  template: TemplateStructureSummary;
}) {
  const router = useRouter();
  const editorDialogRef = useRef<HTMLDialogElement>(null);
  const previewDialogRef = useRef<HTMLDialogElement>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<DeleteTarget | null>(null);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<DragItem | null>(null);
  const dragOverItemRef = useRef<DragItem | null>(null);
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const dragPointerOffsetRef = useRef({ x: 0, y: 0 });
  const dragSourceRectRef = useRef<DOMRect | null>(null);
  const dragCandidateRectsRef = useRef<
    Array<{ id: string; parentId: string; rect: DOMRect }>
  >([]);
  const dragBodyStyleRef = useRef<{ userSelect: string; cursor: string } | null>(null);
  const [dragSwapOffset, setDragSwapOffset] = useState({ x: 0, y: 0 });
  const [teamOrderOverrides, setTeamOrderOverrides] = useState<Record<string, string[]>>({});
  const [partyOrderOverrides, setPartyOrderOverrides] = useState<Record<string, string[]>>({});
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [inspection, setInspection] = useState<EventTemplateInspection | null>(null);
  const [readinessBusy, setReadinessBusy] = useState<"" | "inspect" | "activate">("");
  const [readinessMessage, setReadinessMessage] = useState("");
  const [readinessError, setReadinessError] = useState(false);
  const [seatReductionPending, setSeatReductionPending] = useState<number | null>(null);
  const structureScrollRestoreRef = useRef<{
    windowX: number;
    windowY: number;
    boards: Array<{ key: string; left: number; top: number }>;
  } | null>(null);

  const readOnly = template.status === "archived";
  const reorderBusy = busyKey.startsWith("reorder-");
  const visuallyStableBusy =
    reorderBusy || busyKey.startsWith("delete:");
  const structureCount =
    template.areaCount +
    template.sectionCount +
    template.partyCount +
    template.slotCount;
  const blockingIssueCount = inspection
    ? inspection.issues.filter((issue) => issue.severity === "error").length
    : null;
  const templateReady =
    inspection !== null && !hasBlockingValidationIssues(inspection.issues);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTeamOrderOverrides((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
      setPartyOrderOverrides((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [template.tree]);

  useLayoutEffect(() => {
    const snapshot = structureScrollRestoreRef.current;
    if (!snapshot) return;

    window.scrollTo(snapshot.windowX, snapshot.windowY);

    for (const board of snapshot.boards) {
      const element = document.querySelector<HTMLElement>(
        `[data-preserve-structure-scroll="${CSS.escape(board.key)}"]`,
      );

      if (!element) continue;
      element.scrollLeft = board.left;
      element.scrollTop = board.top;
    }

    structureScrollRestoreRef.current = null;
  }, [
    template.tree,
    template.status,
    template.areaCount,
    template.sectionCount,
    template.partyCount,
    template.slotCount,
  ]);

  // Phase 4.2B2 no button blink v2.4
  // Phase 4.2B2 drop settle v2.3
  function dragParentKey(parentId: string | null) {
    return parentId ?? "__root__";
  }

  function setCurrentDragOver(
    next: DragItem | null,
    offset = { x: 0, y: 0 },
  ) {
    const current = dragOverItemRef.current;
    if (
      current?.kind === next?.kind &&
      current?.id === next?.id &&
      current?.parentId === next?.parentId &&
      dragSwapOffset.x === offset.x &&
      dragSwapOffset.y === offset.y
    ) {
      return;
    }

    dragOverItemRef.current = next;
    setDragOverItem(next);
    setDragSwapOffset(offset);
  }

  function removePointerDragPreview() {
    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;
    dragSourceRectRef.current = null;
    dragCandidateRectsRef.current = [];
    setDragSwapOffset({ x: 0, y: 0 });

    if (dragBodyStyleRef.current) {
      document.body.style.userSelect = dragBodyStyleRef.current.userSelect;
      document.body.style.cursor = dragBodyStyleRef.current.cursor;
      dragBodyStyleRef.current = null;
    }
  }

  function clearPointerDrag() {
    removePointerDragPreview();
    dragOverItemRef.current = null;
    setDragOverItem(null);
    setDragItem(null);
  }

  function beginPointerDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    item: DragItem,
    selector: string,
  ) {
    if (event.button !== 0 || busyKey !== "") return;

    const source = event.currentTarget.closest(selector) as HTMLElement | null;
    if (!source) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const rect = source.getBoundingClientRect();
    const idAttribute =
      item.kind === "team" ? "data-team-id" : "data-party-id";
    const parentAttribute =
      item.kind === "team"
        ? "data-team-parent-id"
        : "data-party-parent-id";

    dragSourceRectRef.current = rect;
    dragCandidateRectsRef.current = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    )
      .map((element) => ({
        id: element.getAttribute(idAttribute) ?? "",
        parentId: element.getAttribute(parentAttribute) ?? "",
        rect: element.getBoundingClientRect(),
      }))
      .filter((candidate) => candidate.id.length > 0);

    const preview = source.cloneNode(true) as HTMLElement;
    preview.setAttribute("aria-hidden", "true");
    preview.style.position = "fixed";
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
    preview.style.margin = "0";
    preview.style.pointerEvents = "none";
    preview.style.opacity = "0.97";
    preview.style.transform = "scale(1.01) rotate(0.15deg)";
    preview.style.transformOrigin = "center";
    preview.style.boxShadow = "0 28px 70px rgba(0, 0, 0, 0.46)";
    preview.style.zIndex = "9999";
    preview.style.willChange = "left, top";

    document.body.appendChild(preview);
    dragPreviewRef.current = preview;
    dragPointerOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    dragBodyStyleRef.current = {
      userSelect: document.body.style.userSelect,
      cursor: document.body.style.cursor,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    dragOverItemRef.current = null;
    setDragOverItem(null);
    setDragItem(item);
  }

  function movePointerDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    item: DragItem,
  ) {
    const preview = dragPreviewRef.current;
    if (!preview) return;

    event.preventDefault();
    const offset = dragPointerOffsetRef.current;
    preview.style.left = `${event.clientX - offset.x}px`;
    preview.style.top = `${event.clientY - offset.y}px`;

    const expectedParentId = item.parentId ?? "";
    const candidate = dragCandidateRectsRef.current.find(({ id, parentId, rect }) =>
      id !== item.id &&
      parentId === expectedParentId &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom,
    );
    const sourceRect = dragSourceRectRef.current;

    if (!candidate || !sourceRect) {
      setCurrentDragOver(null);
      return;
    }

    setCurrentDragOver(
      {
        kind: item.kind,
        id: candidate.id,
        parentId: item.parentId,
      },
      {
        x: sourceRect.left - candidate.rect.left,
        y: sourceRect.top - candidate.rect.top,
      },
    );
  }

  function releasePointerCapture(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function animateSettledCard(kind: DragItem["kind"], id: string) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    window.requestAnimationFrame(() => {
      const selector =
        kind === "team" ? "[data-team-drag-card]" : "[data-party-drag-card]";
      const idAttribute =
        kind === "team" ? "data-team-id" : "data-party-id";
      const element = Array.from(
        document.querySelectorAll<HTMLElement>(selector),
      ).find((candidate) => candidate.getAttribute(idAttribute) === id);

      element?.animate(
        [
          { boxShadow: "0 0 0 1px var(--guild-accent)" },
          { boxShadow: "0 0 0 0 transparent" },
        ],
        {
          duration: 120,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    });
  }

  function refreshStructurePreservingPosition() {
    const boards = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-preserve-structure-scroll]",
      ),
    ).flatMap((element) => {
      const key = element.getAttribute("data-preserve-structure-scroll");
      return key
        ? [{ key, left: element.scrollLeft, top: element.scrollTop }]
        : [];
    });

    structureScrollRestoreRef.current = {
      windowX: window.scrollX,
      windowY: window.scrollY,
      boards,
    };

    router.refresh();
  }

  function clearMessage() {
    setMessage("");
    setIsError(false);
  }

  function applyResult(result: TemplateStructureMutationResult) {
    setMessage(result.message);
    setIsError(!result.ok);
    return result.ok;
  }

  function invalidateInspection() {
    setInspection(null);
    setReadinessMessage("");
    setReadinessError(false);
  }

  async function inspectTemplate(openPreview = false) {
    const data = new FormData();
    data.set("guildId", guildId);
    data.set("templateId", template.id);

    setReadinessBusy("inspect");
    setReadinessMessage("");
    setReadinessError(false);

    try {
      const result = await inspectEventTemplateAction(data);

      if (!result.ok) {
        setInspection(null);
        setReadinessMessage(result.message);
        setReadinessError(true);
        return;
      }

      setInspection(result.inspection);
      setReadinessMessage(
        hasBlockingValidationIssues(result.inspection.issues)
          ? "Resolve the validation errors below before activating this Template."
          : "Template validation passed. This Template is ready to activate.",
      );

      if (openPreview) {
        window.requestAnimationFrame(() => {
          previewDialogRef.current?.showModal();
        });
      }
    } catch {
      setInspection(null);
      setReadinessMessage("Template readiness could not be checked.");
      setReadinessError(true);
    } finally {
      setReadinessBusy("");
    }
  }

  async function activateTemplate() {
    if (!templateReady || template.status !== "draft") return;

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("templateId", template.id);

    setReadinessBusy("activate");
    setReadinessMessage("");
    setReadinessError(false);

    try {
      const result = await activateEventTemplateAction(data);

      if (!result.ok) {
        setReadinessMessage(result.message);
        setReadinessError(true);
        return;
      }

      setInspection(null);
      setReadinessMessage(result.message);
      router.refresh();
    } catch {
      setReadinessMessage("Template activation could not be completed.");
      setReadinessError(true);
    } finally {
      setReadinessBusy("");
    }
  }

  function showEditor(target: EditorTarget) {
    clearMessage();
    setSeatReductionPending(null);
    setEditor(target);
    window.requestAnimationFrame(() => {
      editorDialogRef.current?.showModal();
    });
  }

  function openCreateArea() {
    showEditor({
      mode: "create",
      kind: "area",
      id: null,
      parentId: null,
      name: "",
      sortOrder: 0,
      partyCount: TEAM_MAX_PARTIES,
      seatCount: PARTY_SEAT_COUNT,
      roleLabel: "",
      internalName: "",
    });
  }

  function openCreateTeam(areaId: string | null = null) {
    showEditor({
      mode: "create",
      kind: "team",
      id: null,
      parentId: areaId,
      name: "",
      sortOrder: 0,
      partyCount: TEAM_MAX_PARTIES,
      seatCount: PARTY_SEAT_COUNT,
      roleLabel: "",
      internalName: "",
    });
  }

  function openCreateParty(team: TemplateSectionNode) {
    showEditor({
      mode: "create",
      kind: "party",
      id: null,
      parentId: team.id,
      name: "",
      sortOrder: team.parties.length,
      partyCount: 0,
      seatCount: PARTY_SEAT_COUNT,
      originalSeatCount: PARTY_SEAT_COUNT,
      roleLabel: "",
      internalName: "",
    });
  }

  function openEditArea(area: TemplateAreaNode) {
    showEditor({
      mode: "edit",
      kind: "area",
      id: area.id,
      parentId: null,
      name: area.name,
      sortOrder: area.sortOrder,
      partyCount: TEAM_MAX_PARTIES,
      seatCount: PARTY_SEAT_COUNT,
      roleLabel: "",
      internalName: "",
    });
  }

  function openEditTeam(team: TemplateSectionNode) {
    showEditor({
      mode: "edit",
      kind: "team",
      id: team.id,
      parentId: team.areaId,
      name: team.name,
      sortOrder: team.sortOrder,
      partyCount: team.parties.length || TEAM_MAX_PARTIES,
      seatCount: PARTY_SEAT_COUNT,
      roleLabel: "",
      internalName: "",
    });
  }

  function openEditParty(party: TemplatePartyNode) {
    showEditor({
      mode: "edit",
      kind: "party",
      id: party.id,
      parentId: party.sectionId,
      name: party.name,
      sortOrder: party.sortOrder,
      partyCount: 0,
      seatCount: party.slots.length,
      originalSeatCount: party.slots.length,
      roleLabel: "",
      internalName: "",
    });
  }

  function openEditSeat(
    seat: TemplateSlotNode,
    partyId: string,
  ) {
    showEditor({
      mode: "edit",
      kind: "seat",
      id: seat.id,
      parentId: partyId,
      name: "",
      sortOrder: seat.sortOrder,
      partyCount: 0,
      seatCount: PARTY_SEAT_COUNT,
      roleLabel: seat.roleLabel ?? "",
      internalName: seat.name,
    });
  }

  function requestAreaDelete(area: TemplateAreaNode) {
    const partyCount = area.sections.reduce(
      (sum, team) => sum + team.parties.length,
      0,
    );
    const seatCount = area.sections.reduce(
      (sum, team) =>
        sum +
        team.parties.reduce(
          (partySum, party) => partySum + party.slots.length,
          0,
        ),
      0,
    );

    setPendingDelete({
      kind: "area",
      id: area.id,
      name: area.name,
      detail: `This also deletes ${area.sections.length} Team(s), ${partyCount} Party row(s), and ${seatCount} seat row(s) inside the Area.`,
    });
  }

  function requestTeamDelete(team: TemplateSectionNode) {
    const seatCount = team.parties.reduce(
      (sum, party) => sum + party.slots.length,
      0,
    );

    setPendingDelete({
      kind: "team",
      id: team.id,
      name: team.name,
      detail: `This also deletes ${team.parties.length} Party row(s) and ${seatCount} seat row(s) inside the Team.`,
    });
  }

  function requestPartyDelete(party: TemplatePartyNode) {
    setPendingDelete({
      kind: "party",
      id: party.id,
      name: party.name,
      detail: `This also deletes the ${party.slots.length} seat row(s) inside the Party.`,
    });
  }

  async function submitEditor(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!editor) return;

    invalidateInspection();

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("templateId", template.id);

    let result: TemplateStructureMutationResult;

    if (editor.kind === "area") {
      data.set("name", editor.name);

      if (editor.mode === "create") {
        setBusyKey("create:area");
        result = await createTemplateAreaAction(data);
      } else {
        data.set("areaId", editor.id ?? "");
        data.set("sortOrder", String(editor.sortOrder));
        setBusyKey("edit:area");
        result = await updateTemplateAreaAction(data);
      }
    } else if (editor.kind === "team") {
      data.set("name", editor.name);
      data.set("areaId", editor.parentId ?? "");

      if (editor.mode === "create") {
        data.set("partyCount", String(editor.partyCount));
        data.set("seatCount", String(editor.seatCount));
        setBusyKey("create:team");
        result = await createTemplateTeamAction(data);
      } else {
        data.set("sectionId", editor.id ?? "");
        data.set("sortOrder", String(editor.sortOrder));
        setBusyKey("edit:team");
        result = await updateTemplateTeamAction(data);
      }
    } else if (editor.kind === "party") {
      data.set("sectionId", editor.parentId);

      if (editor.mode === "create") {
        data.set("seatCount", String(editor.seatCount));
        setBusyKey("create:party");
        result = await addTemplatePartyAction(data);
      } else {
        const isSeatReduction =
          editor.seatCount < editor.originalSeatCount;

        if (
          isSeatReduction &&
          seatReductionPending !== editor.seatCount
        ) {
          setSeatReductionPending(editor.seatCount);
          clearMessage();
          return;
        }

        data.set("partyId", editor.id ?? "");
        data.set("name", editor.name);
        data.set("sortOrder", String(editor.sortOrder));
        data.set("seatCount", String(editor.seatCount));
        data.set(
          "allowRoleRemoval",
          isSeatReduction ? "true" : "false",
        );
        setBusyKey("edit:party");
        result = await updateTemplatePartyAction(data);
      }
    } else {
      data.set("slotId", editor.id);
      data.set("partyId", editor.parentId);
      data.set("roleLabel", editor.roleLabel);
      data.set("sortOrder", String(editor.sortOrder));
      data.set("internalName", editor.internalName);
      setBusyKey("edit:seat");
      result = await updateTemplateSeatRoleAction(data);
    }

    setBusyKey("");

    if (!applyResult(result)) return;

    editorDialogRef.current?.close();
    setEditor(null);
    setSeatReductionPending(null);
    refreshStructurePreservingPosition();
  }

  function appendOrderedIds(data: FormData, ids: string[]) {
    for (const id of ids) {
      data.append("orderedIds", id);
    }
  }

  function teamSiblingIds(team: TemplateSectionNode) {
    if (!team.areaId) {
      return template.tree.rootSections.map((sibling) => sibling.id);
    }

    return (
      template.tree.areas
        .find((area) => area.id === team.areaId)
        ?.sections.map((sibling) => sibling.id) ?? []
    );
  }

  async function persistTeamOrder(
    team: TemplateSectionNode,
    orderedIds: string[],
    refreshAfterSave = true,
  ) {
    invalidateInspection();
    const data = new FormData();
    data.set("guildId", guildId);
    data.set("templateId", template.id);
    data.set("areaId", team.areaId ?? "");
    appendOrderedIds(data, orderedIds);

    setBusyKey(`reorder-team:${team.id}`);
    clearMessage();

    const result = await reorderTemplateTeamsAction(data);

    setBusyKey("");
    setDragItem(null);

    if (!result.ok) {
      applyResult(result);
      return false;
    }

    if (refreshAfterSave) {
      router.refresh();
    }

    return true;
  }

  async function moveTeam(team: TemplateSectionNode, offset: number) {
    const parentKey = dragParentKey(team.areaId);
    const serverIds = teamSiblingIds(team);
    const currentIds = teamOrderOverrides[parentKey] ?? serverIds;
    const orderedIds = moveOrderedId(currentIds, team.id, offset);

    if (orderedIds.join("|") === currentIds.join("|")) return;

    await persistTeamOrder(team, orderedIds);
  }

  async function persistPartyOrder(
    team: TemplateSectionNode,
    orderedIds: string[],
    refreshAfterSave = true,
  ) {
    invalidateInspection();
    const data = new FormData();
    data.set("guildId", guildId);
    data.set("templateId", template.id);
    data.set("sectionId", team.id);
    appendOrderedIds(data, orderedIds);

    setBusyKey(`reorder-party:${team.id}`);
    clearMessage();

    const result = await reorderTemplatePartiesAction(data);

    setBusyKey("");
    setDragItem(null);

    if (!result.ok) {
      applyResult(result);
      return false;
    }

    if (refreshAfterSave) {
      router.refresh();
    }

    return true;
  }

  async function moveParty(
    team: TemplateSectionNode,
    party: TemplatePartyNode,
    offset: number,
  ) {
    const serverIds = team.parties.map((sibling) => sibling.id);
    const currentIds = partyOrderOverrides[team.id] ?? serverIds;
    const orderedIds = moveOrderedId(currentIds, party.id, offset);

    if (orderedIds.join("|") === currentIds.join("|")) return;

    await persistPartyOrder(team, orderedIds);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    invalidateInspection();
    const data = new FormData();
    data.set("guildId", guildId);
    data.set("templateId", template.id);

    if (pendingDelete.kind === "area") {
      data.set("areaId", pendingDelete.id);
    } else if (pendingDelete.kind === "team") {
      data.set("sectionId", pendingDelete.id);
    } else {
      data.set("partyId", pendingDelete.id);
    }

    setBusyKey(`delete:${pendingDelete.kind}:${pendingDelete.id}`);
    clearMessage();

    const result =
      pendingDelete.kind === "area"
        ? await deleteTemplateAreaAction(data)
        : pendingDelete.kind === "team"
          ? await deleteTemplateTeamAction(data)
          : await deleteTemplatePartyAction(data);

    setBusyKey("");

    if (!applyResult(result)) {
      setPendingDelete(null);
      return;
    }

    setPendingDelete(null);
    refreshStructurePreservingPosition();
  }

  function teamsForRender(
    teams: TemplateSectionNode[],
    parentId: string | null,
  ) {
    const parentKey = dragParentKey(parentId);
    return orderNodesByIds(teams, teamOrderOverrides[parentKey]);
  }

  function partiesForRender(team: TemplateSectionNode) {
    return orderNodesByIds(
      team.parties,
      partyOrderOverrides[team.id],
    );
  }

  function finishTeamPointerDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    team: TemplateSectionNode,
  ) {
    event.preventDefault();
    movePointerDrag(event, {
      kind: "team",
      id: team.id,
      parentId: team.areaId,
    });
    releasePointerCapture(event);

    const target = dragOverItemRef.current;
    const parentKey = dragParentKey(team.areaId);
    const serverIds = teamSiblingIds(team);
    const currentIds = teamOrderOverrides[parentKey] ?? serverIds;
    const orderedIds =
      target?.kind === "team" && target.parentId === team.areaId
        ? swapOrderedIds(currentIds, team.id, target.id)
        : currentIds;

    removePointerDragPreview();

    if (orderedIds.join("|") === currentIds.join("|")) {
      dragOverItemRef.current = null;
      setDragOverItem(null);
      setDragItem(null);
      return;
    }

    const previousOverride = teamOrderOverrides[parentKey];
    flushSync(() => {
      setTeamOrderOverrides((current) => ({
        ...current,
        [parentKey]: orderedIds,
      }));
      dragOverItemRef.current = null;
      setDragOverItem(null);
      setDragItem(null);
    });
    animateSettledCard("team", team.id);

    void persistTeamOrder(
      team,
      orderedIds,
      template.status === "active",
    ).then((ok) => {
      if (ok) return;
      setTeamOrderOverrides((current) => {
        const next = { ...current };
        if (previousOverride) next[parentKey] = previousOverride;
        else delete next[parentKey];
        return next;
      });
    });
  }

  function finishPartyPointerDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    team: TemplateSectionNode,
    party: TemplatePartyNode,
  ) {
    event.preventDefault();
    movePointerDrag(event, {
      kind: "party",
      id: party.id,
      parentId: team.id,
    });
    releasePointerCapture(event);

    const target = dragOverItemRef.current;
    const serverIds = team.parties.map((sibling) => sibling.id);
    const currentIds = partyOrderOverrides[team.id] ?? serverIds;
    const orderedIds =
      target?.kind === "party" && target.parentId === team.id
        ? swapOrderedIds(currentIds, party.id, target.id)
        : currentIds;

    removePointerDragPreview();

    if (orderedIds.join("|") === currentIds.join("|")) {
      dragOverItemRef.current = null;
      setDragOverItem(null);
      setDragItem(null);
      return;
    }

    const previousOverride = partyOrderOverrides[team.id];
    flushSync(() => {
      setPartyOrderOverrides((current) => ({
        ...current,
        [team.id]: orderedIds,
      }));
      dragOverItemRef.current = null;
      setDragOverItem(null);
      setDragItem(null);
    });
    animateSettledCard("party", party.id);

    void persistPartyOrder(
      team,
      orderedIds,
      template.status === "active",
    ).then((ok) => {
      if (ok) return;
      setPartyOrderOverrides((current) => {
        const next = { ...current };
        if (previousOverride) next[team.id] = previousOverride;
        else delete next[team.id];
        return next;
      });
    });
  }

  function cancelPointerDrag(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    releasePointerCapture(event);
    clearPointerDrag();
  }

  function renderSeat(seat: TemplateSlotNode, partyId: string) {
    return (
      <button
        key={seat.id}
        type="button"
        disabled={readOnly || busyKey !== ""}
        onClick={() => openEditSeat(seat, partyId)}
        className="min-h-14 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-left transition-colors hover:border-[var(--guild-accent)] disabled:cursor-default disabled:hover:border-[var(--border-subtle)]"
      >
        <p className="text-xs font-semibold text-[var(--text-secondary)]">
          {seat.roleLabel ?? "Open seat"}
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
          {seat.roleLabel ? "Role requirement" : "Any role"}
        </p>
      </button>
    );
  }

  function renderParty(
    party: TemplatePartyNode,
    team: TemplateSectionNode,
  ) {
    const partyIndex = team.parties.findIndex(
      (sibling) => sibling.id === party.id,
    );

    return (
      <div
        key={party.id}
        data-party-drag-card
        data-party-id={party.id}
        data-party-parent-id={team.id}
        style={
          dragOverItem?.kind === "party" && dragOverItem.id === party.id
            ? {
                transform: `translate3d(${dragSwapOffset.x}px, ${dragSwapOffset.y}px, 0)`,
                zIndex: 30,
              }
            : undefined
        }
        className={`relative w-44 shrink-0 rounded-[var(--radius-lg)] border bg-[var(--surface-2)] p-3 transition-[border-color,box-shadow,transform] duration-150 ${
          dragItem?.kind === "party" && dragItem.id === party.id
            ? "border-dashed border-[var(--guild-accent)]"
            : dragOverItem?.kind === "party" && dragOverItem.id === party.id
              ? "border-[var(--guild-accent)] ring-1 ring-[var(--guild-accent)] shadow-lg"
              : "border-[var(--border-default)]"
        }`}
      >
        {dragItem?.kind === "party" && dragItem.id === party.id ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--guild-accent)] bg-[var(--surface-2)]">
            <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">
              Drop here
            </span>
          </div>
        ) : null}
        <div className="min-w-0">
          <p
            className="truncate text-sm font-semibold"
            title={party.name}
          >
            {party.name}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            {party.slots.length} seat{party.slots.length === 1 ? "" : "s"}
          </p>
        </div>

        {!readOnly ? (
          <>
            <div className="mt-2 flex items-center gap-1 border-t border-[var(--border-subtle)] pt-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="px-2"
                aria-label={`Move ${party.name} left`}
                disabled={busyKey !== "" || partyIndex <= 0}
                onClick={() => void moveParty(team, party, -1)}
              >
                ←
              </Button>
              <button
                type="button"
                aria-label={`Drag ${party.name} to reorder`}
                title="Drag to reorder"
                disabled={busyKey !== ""}
                onPointerDown={(event) =>
                  beginPointerDrag(
                    event,
                    {
                      kind: "party",
                      id: party.id,
                      parentId: team.id,
                    },
                    "[data-party-drag-card]",
                  )
                }
                onPointerMove={(event) =>
                  movePointerDrag(event, {
                    kind: "party",
                    id: party.id,
                    parentId: team.id,
                  })
                }
                onPointerUp={(event) =>
                  finishPartyPointerDrag(event, team, party)
                }
                onPointerCancel={cancelPointerDrag}
                className="hidden h-8 flex-1 cursor-grab items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-2 text-xs font-semibold text-[var(--text-secondary)] touch-none select-none active:cursor-grabbing md:inline-flex"
              >
                Drag
              </button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="px-2"
                aria-label={`Move ${party.name} right`}
                disabled={
                  busyKey !== "" ||
                  partyIndex < 0 ||
                  partyIndex >= team.parties.length - 1
                }
                onClick={() => void moveParty(team, party, 1)}
              >
                →
              </Button>
            </div>

            <div className="mt-1 flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-w-0 flex-1 px-2"
                disabled={busyKey !== ""}
                onClick={() => openEditParty(party)}
              >
                Edit
              </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              className="min-w-0 flex-1 px-2"
              disabled={busyKey !== ""}
              onClick={() => requestPartyDelete(party)}
            >
              Delete
            </Button>
          </div>
          </>
        ) : null}

        <div className="mt-3 grid gap-2">
          {party.slots.map((seat) => renderSeat(seat, party.id))}
        </div>
      </div>
    );
  }

  function renderTeam(team: TemplateSectionNode) {
    const partyLimitReached = team.parties.length >= TEAM_MAX_PARTIES;
    const siblingIds = teamSiblingIds(team);
    const teamIndex = siblingIds.indexOf(team.id);

    return (
      <div
        key={team.id}
        data-team-drag-card
        data-team-id={team.id}
        data-team-parent-id={team.areaId ?? ""}
        style={
          dragOverItem?.kind === "team" && dragOverItem.id === team.id
            ? {
                transform: `translate3d(${dragSwapOffset.x}px, ${dragSwapOffset.y}px, 0)`,
                zIndex: 30,
              }
            : undefined
        }
        className={`relative rounded-[var(--radius-xl)] transition-[box-shadow,outline-color,transform] duration-150 ${
          dragItem?.kind === "team" && dragItem.id === team.id
            ? "outline outline-1 outline-dashed outline-[var(--guild-accent)]"
            : dragOverItem?.kind === "team" && dragOverItem.id === team.id
              ? "ring-1 ring-[var(--guild-accent)] shadow-xl"
              : ""
        }`}
      >
        {dragItem?.kind === "team" && dragItem.id === team.id ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--guild-accent)] bg-[var(--surface-2)]">
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">
              Drop Team here
            </span>
          </div>
        ) : null}
        <Surface
          level={2}
          className={`min-w-0 max-w-full overflow-hidden p-4 transition-all duration-150 sm:p-5 ${
            dragItem?.kind === "team" && dragItem.id === team.id
              ? "pointer-events-none opacity-0"
              : ""
          }`}
        >
        <div className="min-w-0 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{team.name}</h3>
              <StatusChip tone="accent">
                {team.parties.length} / {TEAM_MAX_PARTIES} Parties
              </StatusChip>
            </div>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              New Parties can use 1–{PARTY_MAX_SEAT_COUNT} seats
              ({PARTY_SEAT_COUNT} by default). Seat numbers are internal and
              hidden from the board.
            </p>
          </div>

          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Move ${team.name} up`}
                disabled={busyKey !== "" || teamIndex <= 0}
                onClick={() => void moveTeam(team, -1)}
              >
                ↑
              </Button>
              <button
                type="button"
                aria-label={`Drag ${team.name} to reorder`}
                title="Drag Team to reorder"
                disabled={busyKey !== ""}
                onPointerDown={(event) =>
                  beginPointerDrag(
                    event,
                    {
                      kind: "team",
                      id: team.id,
                      parentId: team.areaId,
                    },
                    "[data-team-drag-card]",
                  )
                }
                onPointerMove={(event) =>
                  movePointerDrag(event, {
                    kind: "team",
                    id: team.id,
                    parentId: team.areaId,
                  })
                }
                onPointerUp={(event) => finishTeamPointerDrag(event, team)}
                onPointerCancel={cancelPointerDrag}
                className="hidden h-8 cursor-grab items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 text-xs font-semibold text-[var(--text-secondary)] touch-none select-none active:cursor-grabbing md:inline-flex"
              >
                Drag Team
              </button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Move ${team.name} down`}
                disabled={
                  busyKey !== "" ||
                  teamIndex < 0 ||
                  teamIndex >= siblingIds.length - 1
                }
                onClick={() => void moveTeam(team, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busyKey !== "" || partyLimitReached}
                onClick={() => openCreateParty(team)}
              >
                {partyLimitReached ? "8 Parties Max" : "Add Party"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busyKey !== ""}
                onClick={() => openEditTeam(team)}
              >
                Rename Team
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={busyKey !== ""}
                onClick={() => requestTeamDelete(team)}
              >
                Delete Team
              </Button>
            </div>
          ) : null}
        </div>

        {team.parties.length > 0 ? (
          <div
            className="mt-4 min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain pb-2"
            data-preserve-structure-scroll={`party-board:${team.id}`}
            aria-label={`${team.name} Party board`}
          >
            <div className="flex min-w-max gap-3">
              {partiesForRender(team).map((party) => renderParty(party, team))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] p-5">
            <p className="font-semibold">No Parties in this Team</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Add a Party and choose how many seat rows it should contain.
            </p>
            {!readOnly ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => openCreateParty(team)}
              >
                Add first Party
              </Button>
            ) : null}
          </div>
        )}
      </Surface>
      </div>
    );
  }

  function renderArea(area: TemplateAreaNode) {
    return (
      <section
        key={area.id}
        className="min-w-0 max-w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{area.name}</h2>
              <StatusChip tone="neutral">
                {area.sections.length} Team
                {area.sections.length === 1 ? "" : "s"}
              </StatusChip>
            </div>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Optional grouping layer above Teams
            </p>
          </div>

          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busyKey !== ""}
                onClick={() => openCreateTeam(area.id)}
              >
                Add Team
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busyKey !== ""}
                onClick={() => openEditArea(area)}
              >
                Rename Area
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={busyKey !== ""}
                onClick={() => requestAreaDelete(area)}
              >
                Delete Area
              </Button>
            </div>
          ) : null}
        </div>

        {area.sections.length > 0 ? (
          <div className="mt-4 grid gap-4">
            {teamsForRender(area.sections, area.id).map(renderTeam)}
          </div>
        ) : (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] p-5">
            <p className="font-semibold">No Teams in this Area</p>
            {!readOnly ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => openCreateTeam(area.id)}
              >
                Create first Team
              </Button>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  function renderPreviewParty(party: TemplatePreviewParty) {
    return (
      <div
        key={party.id}
        className="w-44 shrink-0 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-3"
      >
        <p className="truncate text-sm font-semibold" title={party.name}>
          {party.name}
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
          {party.slots.length} seat{party.slots.length === 1 ? "" : "s"}
        </p>
        <div className="mt-3 grid gap-2">
          {party.slots.map((slot) => (
            <div
              key={slot.id}
              className="min-h-14 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2"
            >
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                {slot.roleLabel ?? "Open seat"}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                {slot.roleLabel ? "Role requirement" : "Any role"}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPreviewTeam(team: TemplatePreviewTeam) {
    return (
      <Surface key={team.id} level={2} className="min-w-0 max-w-full overflow-hidden p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{team.name}</h3>
          <StatusChip tone="accent">
            {team.parties.length} {team.parties.length === 1 ? "Party" : "Parties"}
          </StatusChip>
        </div>
        {team.parties.length > 0 ? (
          <div className="mt-4 min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain pb-2">
            <div className="flex min-w-max gap-3">
              {team.parties.map(renderPreviewParty)}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            No Parties in this Team.
          </p>
        )}
      </Surface>
    );
  }

  return (
    <div
      className={`min-w-0 overflow-x-hidden px-5 py-8 sm:px-8 lg:px-10 [overflow-anchor:none] ${
        visuallyStableBusy ? "[&_button:disabled]:opacity-100" : ""
      }`}
    >
      <div className="mx-auto min-w-0 max-w-[96rem]">
        <Link
          href={`/app/guild/${guildId}/templates`}
          className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          ← Back to Event Templates
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone={statusTone(template.status)}>
                {template.status.charAt(0).toUpperCase() +
                  template.status.slice(1)}
              </StatusChip>
              <StatusChip tone="neutral">
                {template.eventTypeName}
              </StatusChip>
              <StatusChip tone="neutral">Team Board</StatusChip>
              {template.usesAreas ? (
                <StatusChip tone="neutral">Area grouping</StatusChip>
              ) : null}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
              {template.name}
            </h1>
            <p className="mt-2 max-w-4xl leading-7 text-[var(--text-secondary)]">
              Build reusable Teams for {guildName}. A Team can contain up to{" "}
              {TEAM_MAX_PARTIES} Parties, and each Party can use 1–{" "}
              {PARTY_MAX_SEAT_COUNT} seats. New Parties default to{" "}
              {PARTY_SEAT_COUNT} seats. Seat numbers stay internal, so
              organizers work with the board instead of creating seat rows
              manually.
            </p>
          </div>

        </div>

        {template.status === "active" ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-4">
            <p className="text-sm font-semibold text-[var(--warning)]">
              Structural edits return this active Template to Draft.
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              It must pass validation again before reactivation.
            </p>
          </div>
        ) : null}

        {readOnly ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-4">
            <p className="text-sm font-semibold">
              Archived Template — read only
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
              Restore it to Draft from the Template list before editing
              Teams or Parties.
            </p>
          </div>
        ) : null}

        <Surface level={2} className="mt-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--guild-accent)] uppercase">
                  Template Readiness
                </p>
                <StatusChip
                  tone={
                    template.status === "active"
                      ? "success"
                      : inspection === null
                        ? "neutral"
                        : templateReady
                          ? "success"
                          : "warning"
                  }
                >
                  {template.status === "active"
                    ? "Active"
                    : inspection === null
                      ? "Not checked"
                      : templateReady
                        ? "Ready"
                        : `${blockingIssueCount ?? 0} issue${blockingIssueCount === 1 ? "" : "s"}`}
                </StatusChip>
              </div>
              <h2 className="mt-2 text-lg font-semibold">
                Validate before this Template is used for Events
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                Validation uses the canonical database rules. Preview uses the ordered
                Template snapshot that future Event creation will consume.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={readinessBusy !== ""}
                onClick={() => void inspectTemplate(false)}
              >
                {readinessBusy === "inspect" ? "Checking…" : "Check Readiness"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={readinessBusy !== ""}
                onClick={() => void inspectTemplate(true)}
              >
                Preview
              </Button>
              {template.status === "draft" ? (
                <Button
                  type="button"
                  disabled={readinessBusy !== "" || !templateReady}
                  onClick={() => void activateTemplate()}
                  title={templateReady ? "Activate Template" : "Check readiness and resolve validation errors first"}
                >
                  {readinessBusy === "activate" ? "Activating…" : "Activate Template"}
                </Button>
              ) : null}
            </div>
          </div>

          {readinessMessage ? (
            <p
              aria-live="polite"
              className={`mt-4 text-sm font-semibold ${
                readinessError
                  ? "text-[var(--danger)]"
                  : templateReady
                    ? "text-[var(--success)]"
                    : "text-[var(--warning)]"
              }`}
            >
              {readinessMessage}
            </p>
          ) : null}

          {inspection && inspection.issues.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {inspection.issues.map((issue, index) => (
                <div
                  key={`${issue.issueCode}:${issue.entityId}:${index}`}
                  className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] px-3 py-2"
                >
                  <p className="text-sm font-semibold">{issue.message}</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {issue.entityType} · {issue.issueCode}
                  </p>
                </div>
              ))}
            </div>
          ) : inspection ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              No blocking validation issues were found.
            </p>
          ) : null}
        </Surface>

        <MutationMessage message={message} isError={isError} />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Teams
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {template.sectionCount}
            </p>
          </Surface>
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Parties
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {template.partyCount}
            </p>
          </Surface>
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Seats
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {template.slotCount}
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              internal Slot rows
            </p>
          </Surface>
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Areas
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {template.areaCount}
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              optional grouping
            </p>
          </Surface>
        </div>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--guild-accent)] uppercase">
              Team Layout
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Reusable roster board
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-secondary)]">
              Future Event building can render these Teams as Party columns
              with the configured number of assignment cells, matching the
              roster-board style you use in-game. Multiple Teams can live inside the same
              Template. Drag on desktop, or use the arrow controls on
              touch and keyboard devices, to reorder Teams and Parties.
            </p>
          </div>

            {!readOnly ? (
              <Button
                type="button"
                size="lg"
                className="shrink-0"
                onClick={() =>
                  template.usesAreas
                    ? openCreateArea()
                    : openCreateTeam()
                }
              >
                {template.usesAreas ? "Add Area" : "Add Team"}
              </Button>
            ) : null}
          </div>

          {structureCount === 0 ? (
            <Surface level={2} className="mt-5 p-8">
              <p className="text-lg font-semibold">
                Start your Team Board
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                {template.usesAreas
                  ? "Create an Area first, then add one or more Teams inside it."
                  : `Create a Team, choose 1–${TEAM_MAX_PARTIES} Parties, and choose 1–${PARTY_MAX_SEAT_COUNT} seats per Party.`}
              </p>
              {!readOnly ? (
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() =>
                    template.usesAreas
                      ? openCreateArea()
                      : openCreateTeam()
                  }
                >
                  {template.usesAreas
                    ? "Create first Area"
                    : "Create first Team"}
                </Button>
              ) : null}
            </Surface>
          ) : template.usesAreas ? (
            <div className="mt-5 grid gap-5">
              {template.tree.areas.map(renderArea)}
            </div>
          ) : (
            <div className="mt-5 grid gap-5">
              {teamsForRender(template.tree.rootSections, null).map(renderTeam)}
            </div>
          )}
        </section>
      </div>

      <dialog
        ref={editorDialogRef}
        aria-labelledby="team-board-editor-title"
        onClose={() => {
          setEditor(null);
          setBusyKey("");
          setSeatReductionPending(null);
        }}
        className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        {editor ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <StatusChip tone="accent">
                  {editor.kind === "seat"
                    ? "Seat role"
                    : `${editor.mode === "create" ? "Add" : "Edit"} ${editor.kind === "team" ? "Team" : editor.kind === "party" ? "Party" : "Area"}`}
                </StatusChip>
                <h2
                  id="team-board-editor-title"
                  className="mt-2 text-xl font-semibold"
                >
                  {editor.kind === "seat"
                    ? "Seat role requirement"
                    : editor.mode === "create"
                      ? `Create ${editor.kind === "team" ? "Team" : editor.kind === "party" ? "Party" : "Area"}`
                      : `Rename ${editor.kind === "team" ? "Team" : editor.kind === "party" ? "Party" : "Area"}`}
                </h2>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editorDialogRef.current?.close()}
              >
                Close
              </Button>
            </div>

            <form onSubmit={submitEditor} className="p-5">
              {editor.kind !== "seat" &&
              !(editor.kind === "party" && editor.mode === "create") ? (
                <label className="text-sm font-semibold">
                  {editor.kind === "team"
                    ? "Team name"
                    : editor.kind === "party"
                      ? "Party name"
                      : "Area name"}
                  <input
                    required
                    maxLength={80}
                    autoFocus
                    autoComplete="off"
                    value={editor.name}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? { ...current, name: event.target.value }
                          : current,
                      )
                    }
                    placeholder={
                      editor.kind === "team"
                        ? "Example: SUN or STAR"
                        : editor.kind === "party"
                          ? "Example: Party 1"
                          : "Example: North"
                    }
                    className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                  />
                </label>
              ) : (
                <label className="text-sm font-semibold">
                  Role requirement
                  <input
                    maxLength={80}
                    autoFocus
                    autoComplete="off"
                    value={editor.roleLabel}
                    onChange={(event) =>
                      setEditor((current) =>
                        current && current.kind === "seat"
                          ? {
                              ...current,
                              roleLabel: event.target.value,
                            }
                          : current,
                      )
                    }
                    placeholder="Optional — example: Main Tank"
                    className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                  />
                  <span className="mt-2 block text-xs font-normal leading-5 text-[var(--text-tertiary)]">
                    Leave blank for any role. The seat number stays hidden
                    from the Team Board.
                  </span>
                </label>
              )}

              {editor.kind === "team" && editor.mode === "create" ? (
                <>
                  <label className="mt-5 block text-sm font-semibold">
                    Starting Parties
                    <select
                      value={editor.partyCount}
                      onChange={(event) =>
                        setEditor((current) =>
                          current && current.kind === "team"
                            ? {
                                ...current,
                                partyCount: Number(event.target.value),
                              }
                            : current,
                        )
                      }
                      className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                    >
                      {Array.from(
                        { length: TEAM_MAX_PARTIES },
                        (_, index) => index + 1,
                      ).map((count) => (
                        <option key={count} value={count}>
                          {count} Part{count === 1 ? "y" : "ies"} ·{" "}
                          {count * editor.seatCount} total seats
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-5 block text-sm font-semibold">
                    Seats per Party
                    <select
                      value={editor.seatCount}
                      onChange={(event) =>
                        setEditor((current) =>
                          current && current.kind === "team"
                            ? {
                                ...current,
                                seatCount: Number(event.target.value),
                              }
                            : current,
                        )
                      }
                      className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                    >
                      {Array.from(
                        { length: PARTY_MAX_SEAT_COUNT },
                        (_, index) => index + 1,
                      ).map((count) => (
                        <option key={count} value={count}>
                          {count} seat{count === 1 ? "" : "s"} per Party
                          {count === PARTY_SEAT_COUNT ? " · default" : ""}
                        </option>
                      ))}
                    </select>
                    <span className="mt-2 block text-xs font-normal leading-5 text-[var(--text-tertiary)]">
                      Every starting Party uses this seat count. You can add
                      Parties later with their own seat counts until the Team
                      reaches {TEAM_MAX_PARTIES}.
                    </span>
                  </label>
                </>
              ) : null}

              {editor.kind === "party" && editor.mode === "create" ? (
                <label className="text-sm font-semibold">
                  Seats in new Party
                  <select
                    autoFocus
                    value={editor.seatCount}
                    onChange={(event) =>
                      setEditor((current) =>
                        current && current.kind === "party"
                          ? {
                              ...current,
                              seatCount: Number(event.target.value),
                            }
                          : current,
                      )
                    }
                    className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                  >
                    {Array.from(
                      { length: PARTY_MAX_SEAT_COUNT },
                      (_, index) => index + 1,
                    ).map((count) => (
                      <option key={count} value={count}>
                        {count} seat{count === 1 ? "" : "s"}
                        {count === PARTY_SEAT_COUNT ? " · default" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="mt-2 block text-xs font-normal leading-5 text-[var(--text-tertiary)]">
                    The Party name is assigned automatically. Seat numbers stay
                    internal and can receive individual role requirements.
                  </span>
                </label>
              ) : null}

              {editor.kind === "party" && editor.mode === "edit" ? (
                <div className="mt-5">
                  <label className="block text-sm font-semibold">
                    Seat count
                    <select
                      value={editor.seatCount}
                      onChange={(event) => {
                        setSeatReductionPending(null);
                        setEditor((current) =>
                          current && current.kind === "party"
                            ? {
                                ...current,
                                seatCount: Number(event.target.value),
                              }
                            : current,
                        );
                      }}
                      className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                    >
                      {Array.from(
                        { length: PARTY_MAX_SEAT_COUNT },
                        (_, index) => index + 1,
                      ).map((count) => (
                        <option key={count} value={count}>
                          {count} seat{count === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </label>

                  {editor.seatCount < editor.originalSeatCount ? (
                    <div className="mt-3 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-3">
                      <p className="text-sm font-semibold text-[var(--danger)]">
                        This removes {editor.originalSeatCount - editor.seatCount}{" "}
                        trailing seat
                        {editor.originalSeatCount - editor.seatCount === 1
                          ? ""
                          : "s"}.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                        Existing earlier seats and their role requirements stay
                        intact. Any role requirement on a removed trailing seat
                        is deleted with that seat.
                      </p>
                      {seatReductionPending === editor.seatCount ? (
                        <p className="mt-2 text-xs font-semibold text-[var(--danger)]">
                          Confirm the removal with the button below.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <MutationMessage message={message} isError={isError} />

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyKey !== ""}
                  onClick={() => editorDialogRef.current?.close()}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={
                    editor.kind === "party" &&
                    editor.mode === "edit" &&
                    editor.seatCount < editor.originalSeatCount &&
                    seatReductionPending === editor.seatCount
                      ? "danger"
                      : "primary"
                  }
                  disabled={
                    busyKey !== "" ||
                    (editor.kind !== "seat" &&
                      !(editor.kind === "party" && editor.mode === "create") &&
                      editor.name.trim().length === 0)
                  }
                >
                  {busyKey
                    ? "Saving…"
                    : editor.kind === "seat"
                      ? "Save Role"
                      : editor.kind === "party" &&
                          editor.mode === "edit" &&
                          editor.seatCount < editor.originalSeatCount &&
                          seatReductionPending === editor.seatCount
                        ? `Confirm remove ${editor.originalSeatCount - editor.seatCount} seat${editor.originalSeatCount - editor.seatCount === 1 ? "" : "s"}`
                        : editor.mode === "create"
                          ? "Create"
                          : "Save"}
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </dialog>

      <dialog
        ref={previewDialogRef}
        aria-labelledby="template-preview-title"
        className="m-auto w-[min(92rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        {inspection ? (
          <>
            <div className="sticky top-0 z-20 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="accent">Template Preview</StatusChip>
                  <StatusChip tone={inspection.issues.length === 0 ? "success" : "warning"}>
                    {inspection.issues.length === 0
                      ? "Validation passed"
                      : `${inspection.issues.length} issue${inspection.issues.length === 1 ? "" : "s"}`}
                  </StatusChip>
                </div>
                <h2 id="template-preview-title" className="mt-2 text-2xl font-semibold">
                  {inspection.preview.templateName}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {inspection.preview.eventTypeName} · read-only ordered preview
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => previewDialogRef.current?.close()}
              >
                Close Preview
              </Button>
            </div>

            <div className="p-5 sm:p-6">
              {inspection.issues.length > 0 ? (
                <div className="mb-5 rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-4">
                  <p className="text-sm font-semibold text-[var(--warning)]">
                    Preview is available, but this Template is not ready to activate.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    Return to the designer and resolve the readiness issues.
                  </p>
                </div>
              ) : null}

              {inspection.preview.usesAreas ? (
                inspection.preview.areas.length > 0 ? (
                  <div className="grid gap-5">
                    {inspection.preview.areas.map((area) => (
                      <section
                        key={area.id}
                        className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold">{area.name}</h3>
                          <StatusChip tone="neutral">
                            {area.teams.length} Team{area.teams.length === 1 ? "" : "s"}
                          </StatusChip>
                        </div>
                        <div className="mt-4 grid gap-4">
                          {area.teams.map(renderPreviewTeam)}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    This Area-based Template has no Areas yet.
                  </p>
                )
              ) : inspection.preview.rootTeams.length > 0 ? (
                <div className="grid gap-4">
                  {inspection.preview.rootTeams.map(renderPreviewTeam)}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  This Template has no Teams yet.
                </p>
              )}
            </div>
          </>
        ) : null}
      </dialog>

      {pendingDelete ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-team-board-title"
            aria-describedby="delete-team-board-description"
            className="w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-5 shadow-2xl"
          >
            <StatusChip tone="danger">
              Delete{" "}
              {pendingDelete.kind === "team"
                ? "Team"
                : pendingDelete.kind === "party"
                  ? "Party"
                  : "Area"}
            </StatusChip>

            <h2
              id="delete-team-board-title"
              className="mt-4 text-lg font-semibold"
            >
              Delete &ldquo;{pendingDelete.name}&rdquo;?
            </h2>

            <p
              id="delete-team-board-description"
              className="mt-2 text-sm leading-6 text-[var(--text-secondary)]"
            >
              {pendingDelete.detail}
            </p>

            <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">
              This changes only the reusable Template. Future Events will
              use independent structural snapshots.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busyKey !== ""}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={busyKey !== ""}
                onClick={confirmDelete}
              >
                {busyKey.startsWith("delete:")
                  ? "Deleting…"
                  : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
