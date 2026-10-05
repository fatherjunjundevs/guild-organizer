"use server";

import { revalidatePath } from "next/cache";
import {
  PARTY_SEAT_COUNT,
  parsePartySeatCount,
  parseTeamPartyCount,
  parseTemplateSlotRoleLabel,
  parseTemplateStructureName,
} from "@/features/templates/template-structure";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TemplateStructureMutationResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getUuid(formData: FormData, key: string) {
  const value = getString(formData, key);
  return UUID_PATTERN.test(value) ? value : null;
}

function getUuidList(formData: FormData, key: string) {
  const values = formData.getAll(key);

  if (values.length < 1) return null;

  const ids: string[] = [];

  for (const value of values) {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
      return null;
    }
    ids.push(value);
  }

  return ids;
}

function getOptionalUuid(formData: FormData, key: string) {
  const value = getString(formData, key);

  if (!value) return null;
  return UUID_PATTERN.test(value) ? value : undefined;
}

function getSortOrder(formData: FormData) {
  const value = getString(formData, "sortOrder");

  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function validateScope(formData: FormData) {
  const guildId = getUuid(formData, "guildId");
  const templateId = getUuid(formData, "templateId");

  if (!guildId || !templateId) return null;

  return { guildId, templateId };
}

function templatePath(guildId: string, templateId: string) {
  return `/app/guild/${guildId}/templates/${templateId}`;
}

function templatesPath(guildId: string) {
  return `/app/guild/${guildId}/templates`;
}

function revalidateTemplatePaths(guildId: string, templateId: string) {
  revalidatePath(templatePath(guildId, templateId));
  revalidatePath(templatesPath(guildId));
}

function mapStructureRpcError(code: string | undefined) {
  if (code === "23505") {
    return "That name already exists at this level of the Template.";
  }

  if (code === "42501") {
    return "You do not have permission to edit this Template.";
  }

  if (code === "55000") {
    return "Archived Templates cannot be structurally edited.";
  }

  if (code === "23514") {
    return "This change is blocked by the Team layout rules or Template hierarchy mode.";
  }

  if (code === "P0002") {
    return "The Template structure item could not be found.";
  }

  if (code === "22023") {
    return "One or more structure fields are invalid.";
  }

  return "The Template structure change could not be saved.";
}

async function nextAreaSortOrder(
  guildId: string,
  templateId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_template_areas")
    .select("sort_order")
    .eq("guild_id", guildId)
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) return null;
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function createTemplateAreaAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);

  if (!scope) {
    return { ok: false, message: "The Template identifiers are invalid." };
  }

  const name = parseTemplateStructureName(
    getString(formData, "name"),
    "Area",
  );

  if (!name.ok) return name;

  const sortOrder = await nextAreaSortOrder(
    scope.guildId,
    scope.templateId,
  );

  if (sortOrder === null) {
    return {
      ok: false,
      message: "Unable to determine the next Area position.",
    };
  }

  const supabase = await createClient();
  const { data: areaId, error } = await supabase.rpc(
    "create_event_template_area",
    {
      p_template_id: scope.templateId,
      p_name: name.value,
      p_sort_order: sortOrder,
    },
  );

  if (error || !areaId) {
    return { ok: false, message: mapStructureRpcError(error?.code) };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: `${name.value} Area was added.`,
    id: areaId,
  };
}

export async function createTemplateTeamAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);

  if (!scope) {
    return { ok: false, message: "The Template identifiers are invalid." };
  }

  const areaId = getOptionalUuid(formData, "areaId");

  if (areaId === undefined) {
    return { ok: false, message: "The Area identifier is invalid." };
  }

  const name = parseTemplateStructureName(
    getString(formData, "name"),
    "Team",
  );

  if (!name.ok) return name;

  const partyCount = parseTeamPartyCount(
    getString(formData, "partyCount"),
  );

  if (!partyCount.ok) return partyCount;

  const seatCount = parsePartySeatCount(
    getString(formData, "seatCount") || String(PARTY_SEAT_COUNT),
  );

  if (!seatCount.ok) return seatCount;

  const args: {
    p_template_id: string;
    p_name: string;
    p_party_count: number;
    p_seat_count: number;
    p_area_id?: string;
  } = {
    p_template_id: scope.templateId,
    p_name: name.value,
    p_party_count: partyCount.value,
    p_seat_count: seatCount.value,
  };

  if (areaId) {
    args.p_area_id = areaId;
  }

  const supabase = await createClient();
  const { data: sectionId, error } = await supabase.rpc(
    "create_event_template_team",
    args,
  );

  if (error || !sectionId) {
    return { ok: false, message: mapStructureRpcError(error?.code) };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: `${name.value} Team was created with ${partyCount.value} Parties and ${seatCount.value} seat${seatCount.value === 1 ? "" : "s"} per Party.`,
    id: sectionId,
  };
}

export async function addTemplatePartyAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);
  const sectionId = getUuid(formData, "sectionId");

  if (!scope || !sectionId) {
    return { ok: false, message: "The Team identifiers are invalid." };
  }

  const seatCount = parsePartySeatCount(
    getString(formData, "seatCount") || String(PARTY_SEAT_COUNT),
  );

  if (!seatCount.ok) return seatCount;

  const supabase = await createClient();
  const { data: partyId, error } = await supabase.rpc(
    "create_event_template_party_with_slots",
    {
      p_section_id: sectionId,
      p_seat_count: seatCount.value,
    },
  );

  if (error || !partyId) {
    return { ok: false, message: mapStructureRpcError(error?.code) };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: `Party added with ${seatCount.value} seat${seatCount.value === 1 ? "" : "s"}.`,
    id: partyId,
  };
}

export async function updateTemplateAreaAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);
  const areaId = getUuid(formData, "areaId");
  const sortOrder = getSortOrder(formData);

  if (!scope || !areaId || sortOrder === null) {
    return { ok: false, message: "The Area identifiers are invalid." };
  }

  const name = parseTemplateStructureName(
    getString(formData, "name"),
    "Area",
  );

  if (!name.ok) return name;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_event_template_area", {
    p_area_id: areaId,
    p_name: name.value,
    p_sort_order: sortOrder,
  });

  if (error) {
    return { ok: false, message: mapStructureRpcError(error.code) };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: `${name.value} Area was updated.`,
    id: areaId,
  };
}

export async function updateTemplateTeamAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);
  const sectionId = getUuid(formData, "sectionId");
  const areaId = getOptionalUuid(formData, "areaId");
  const sortOrder = getSortOrder(formData);

  if (
    !scope ||
    !sectionId ||
    areaId === undefined ||
    sortOrder === null
  ) {
    return { ok: false, message: "The Team identifiers are invalid." };
  }

  const name = parseTemplateStructureName(
    getString(formData, "name"),
    "Team",
  );

  if (!name.ok) return name;

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "update_event_template_section",
    {
      p_section_id: sectionId,
      p_name: name.value,
      p_area_id: areaId as unknown as string,
      p_sort_order: sortOrder,
    },
  );

  if (error) {
    return { ok: false, message: mapStructureRpcError(error.code) };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: `${name.value} Team was updated.`,
    id: sectionId,
  };
}

export async function updateTemplatePartyAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);
  const partyId = getUuid(formData, "partyId");
  const sortOrder = getSortOrder(formData);

  if (!scope || !partyId || sortOrder === null) {
    return { ok: false, message: "The Party identifiers are invalid." };
  }

  const name = parseTemplateStructureName(
    getString(formData, "name"),
    "Party",
  );

  if (!name.ok) return name;

  const seatCount = parsePartySeatCount(
    getString(formData, "seatCount"),
  );

  if (!seatCount.ok) return seatCount;

  const allowRoleRemoval =
    getString(formData, "allowRoleRemoval") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "update_event_template_party_layout",
    {
      p_party_id: partyId,
      p_name: name.value,
      p_sort_order: sortOrder,
      p_seat_count: seatCount.value,
      p_allow_role_removal: allowRoleRemoval,
    },
  );

  if (error) {
    if (error.code === "23514" && !allowRoleRemoval) {
      return {
        ok: false,
        message:
          "Reducing this Party would remove seat rows with role requirements. Confirm the seat reduction to continue.",
      };
    }

    return { ok: false, message: mapStructureRpcError(error.code) };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: `${name.value} was updated with ${seatCount.value} seat${seatCount.value === 1 ? "" : "s"}.`,
    id: partyId,
  };
}

export async function updateTemplateSeatRoleAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);
  const slotId = getUuid(formData, "slotId");
  const partyId = getUuid(formData, "partyId");
  const sortOrder = getSortOrder(formData);
  const internalName = getString(formData, "internalName");

  if (
    !scope ||
    !slotId ||
    !partyId ||
    sortOrder === null ||
    !internalName
  ) {
    return { ok: false, message: "The seat identifiers are invalid." };
  }

  const roleLabel = parseTemplateSlotRoleLabel(
    getString(formData, "roleLabel"),
  );

  if (!roleLabel.ok) return roleLabel;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_event_template_slot", {
    p_slot_id: slotId,
    p_party_id: partyId,
    p_name: internalName,
    p_role_label: roleLabel.value as unknown as string,
    p_sort_order: sortOrder,
  });

  if (error) {
    return { ok: false, message: mapStructureRpcError(error.code) };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: roleLabel.value
      ? `Seat role set to ${roleLabel.value}.`
      : "Seat role requirement cleared.",
    id: slotId,
  };
}

export async function reorderTemplateTeamsAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);
  const areaId = getOptionalUuid(formData, "areaId");
  const orderedIds = getUuidList(formData, "orderedIds");

  if (!scope || areaId === undefined || !orderedIds) {
    return {
      ok: false,
      message: "The Team ordering payload is invalid.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "reorder_event_template_teams",
    {
      p_template_id: scope.templateId,
      p_area_id: areaId as unknown as string,
      p_ordered_section_ids: orderedIds,
    },
  );

  if (error) {
    return {
      ok: false,
      message: mapStructureRpcError(error.code),
    };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: "Team order updated.",
  };
}

export async function reorderTemplatePartiesAction(
  formData: FormData,
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);
  const sectionId = getUuid(formData, "sectionId");
  const orderedIds = getUuidList(formData, "orderedIds");

  if (!scope || !sectionId || !orderedIds) {
    return {
      ok: false,
      message: "The Party ordering payload is invalid.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "reorder_event_template_parties",
    {
      p_section_id: sectionId,
      p_ordered_party_ids: orderedIds,
    },
  );

  if (error) {
    return {
      ok: false,
      message: mapStructureRpcError(error.code),
    };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message: "Party order updated.",
  };
}

async function deleteStructureItem(
  formData: FormData,
  kind: "area" | "section" | "party",
): Promise<TemplateStructureMutationResult> {
  const scope = validateScope(formData);
  const id = getUuid(formData, `${kind}Id`);

  if (!scope || !id) {
    return {
      ok: false,
      message: `The ${kind} identifiers are invalid.`,
    };
  }

  const supabase = await createClient();

  const result =
    kind === "area"
      ? await supabase.rpc("delete_event_template_area", {
          p_area_id: id,
        })
      : kind === "section"
        ? await supabase.rpc("delete_event_template_section", {
            p_section_id: id,
          })
        : await supabase.rpc("delete_event_template_party", {
            p_party_id: id,
          });

  if (result.error) {
    return {
      ok: false,
      message: mapStructureRpcError(result.error.code),
    };
  }

  revalidateTemplatePaths(scope.guildId, scope.templateId);

  return {
    ok: true,
    message:
      kind === "section"
        ? "Team was deleted."
        : `${kind.charAt(0).toUpperCase() + kind.slice(1)} was deleted.`,
    id,
  };
}

export async function deleteTemplateAreaAction(formData: FormData) {
  return deleteStructureItem(formData, "area");
}

export async function deleteTemplateTeamAction(formData: FormData) {
  return deleteStructureItem(formData, "section");
}

export async function deleteTemplatePartyAction(formData: FormData) {
  return deleteStructureItem(formData, "party");
}
