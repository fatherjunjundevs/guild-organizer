"use client";

import { useMemo, useState } from "react";
import { BulkRosterDialog } from "@/features/roster/bulk-roster-dialog";
import { CharacterTagsDialog } from "@/features/roster/character-tags-dialog";
import { CharacterOrganizerDialog } from "@/features/roster/character-organizer-dialog";
import type {
  MasterRosterCharacter,
  MasterRosterCustomField,
  MasterRosterTag,
} from "@/features/roster/server";
import {
  filterAndSortRoster,
  formatRosterCustomFieldValue,
  getRosterClassOptions,
  getRosterSummary,
  type RosterSort,
  type RosterStatusFilter,
} from "@/features/roster/view-model";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

function formatNumber(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat().format(value);
}

function CharacterCustomFieldPreview({
  character,
  customFields,
}: {
  character: MasterRosterCharacter;
  customFields: MasterRosterCustomField[];
}) {
  const populatedFields = customFields.flatMap((field) => {
    const value = character.customFieldValues?.[field.id];

    return value === undefined ? [] : [{ field, value }];
  });

  if (populatedFields.length === 0) {
    return null;
  }

  const preview = populatedFields.slice(0, 2);
  const remaining = populatedFields.length - preview.length;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {preview.map(({ field, value }) => (
        <span
          key={field.id}
          title={`${field.name}: ${formatRosterCustomFieldValue(value)}`}
          className="max-w-56 truncate rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]"
        >
          {field.name}: {formatRosterCustomFieldValue(value)}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-tertiary)]">
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}

function CharacterStatus({
  character,
}: {
  character: MasterRosterCharacter;
}) {
  if (character.reconciledIntoCharacterId) {
    return <StatusChip tone="neutral">Reconciled</StatusChip>;
  }

  if (character.status === "active") {
    return <StatusChip tone="success">Active</StatusChip>;
  }

  if (character.inactiveReason === "left_guild") {
    return <StatusChip tone="warning">Left Guild</StatusChip>;
  }

  return <StatusChip tone="neutral">Inactive</StatusChip>;
}

export function RosterView({
  guildId,
  characters,
  tags,
  customFields,
}: {
  guildId: string;
  characters: MasterRosterCharacter[];
  tags: MasterRosterTag[];
  customFields: MasterRosterCustomField[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<RosterStatusFilter>("active");
  const [className, setClassName] = useState("all");
  const [tagId, setTagId] = useState("all");
  const [customFieldId, setCustomFieldId] = useState("all");
  const [customFieldValue, setCustomFieldValue] = useState("");
  const [sort, setSort] =
    useState<RosterSort>("position-hierarchy");
  const [selectedCharacter, setSelectedCharacter] =
    useState<MasterRosterCharacter | null>(null);
  const [tagCharacter, setTagCharacter] =
    useState<MasterRosterCharacter | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const summary = useMemo(
    () => getRosterSummary(characters),
    [characters],
  );
  const classOptions = useMemo(
    () => getRosterClassOptions(characters),
    [characters],
  );
  const selectedCustomField = useMemo(
    () =>
      customFields.find((field) => field.id === customFieldId) ?? null,
    [customFieldId, customFields],
  );
  const effectiveCustomFieldId = selectedCustomField
    ? customFieldId
    : "all";
  const effectiveCustomFieldValue = useMemo(() => {
    if (!selectedCustomField) {
      return "";
    }

    if (
      selectedCustomField.fieldType === "select" &&
      customFieldValue &&
      !selectedCustomField.selectOptions.includes(customFieldValue)
    ) {
      return "";
    }

    return customFieldValue;
  }, [customFieldValue, selectedCustomField]);

  const visibleCharacters = useMemo(
    () =>
      filterAndSortRoster(characters, {
        query,
        status,
        className,
        tagId,
        customFields,
        customFieldId: effectiveCustomFieldId,
        customFieldValue: effectiveCustomFieldValue,
        sort,
      }),
    [
      characters,
      query,
      status,
      className,
      tagId,
      customFields,
      effectiveCustomFieldId,
      effectiveCustomFieldValue,
      sort,
    ],
  );
  const selectableVisibleCharacters = useMemo(
    () =>
      visibleCharacters.filter(
        (character) => !character.reconciledIntoCharacterId,
      ),
    [visibleCharacters],
  );
  const selectedCharacters = useMemo(
    () =>
      characters.filter(
        (character) =>
          selectedIds.has(character.id) &&
          !character.reconciledIntoCharacterId,
      ),
    [characters, selectedIds],
  );
  const allVisibleSelected =
    selectableVisibleCharacters.length > 0 &&
    selectableVisibleCharacters.every((character) =>
      selectedIds.has(character.id),
    );

  function toggleCharacterSelection(characterId: string) {
    const character = characters.find(
      (candidate) => candidate.id === characterId,
    );

    if (!character || character.reconciledIntoCharacterId) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(characterId)) {
        next.delete(characterId);
      } else {
        next.add(characterId);
      }

      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        for (const character of selectableVisibleCharacters) {
          next.delete(character.id);
        }
      } else {
        for (const character of selectableVisibleCharacters) {
          next.add(character.id);
        }
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Surface level={2} className="p-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase">
            Current
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.active}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Active Guild characters
          </p>
        </Surface>

        <Surface level={2} className="p-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase">
            Left Guild
          </p>
          <p className="mt-2 text-2xl font-semibold">{summary.left}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Preserved historical characters
          </p>
        </Surface>

        <Surface level={2} className="p-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase">
            Inactive
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.inactive}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manually inactive
          </p>
        </Surface>

        <Surface level={2} className="p-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase">
            Reconciled
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.reconciled}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Resolved historical identities
          </p>
        </Surface>

        <Surface level={2} className="p-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase">
            Stored
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.total}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Current + historical
          </p>
        </Surface>
      </div>

      <Surface level={2} className="mt-6 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_10rem_12rem_12rem_13rem]">
          <div>
            <label
              htmlFor="roster-search"
              className="text-xs font-semibold text-[var(--text-tertiary)]"
            >
              Search
            </label>
            <input
              id="roster-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="IGN, class, role, custom fields…"
              className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
            />
          </div>

          <div>
            <label
              htmlFor="roster-status"
              className="text-xs font-semibold text-[var(--text-tertiary)]"
            >
              Status
            </label>
            <select
              id="roster-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as RosterStatusFilter)
              }
              className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="active">Active</option>
              <option value="left">Left Guild</option>
              <option value="inactive">Inactive</option>
              <option value="reconciled">Reconciled</option>
              <option value="all">All stored</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="roster-class"
              className="text-xs font-semibold text-[var(--text-tertiary)]"
            >
              Class
            </label>
            <select
              id="roster-class"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="all">All classes</option>
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="roster-tag"
              className="text-xs font-semibold text-[var(--text-tertiary)]"
            >
              Tag
            </label>
            <select
              id="roster-tag"
              value={tagId}
              onChange={(event) => setTagId(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="all">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="roster-sort"
              className="text-xs font-semibold text-[var(--text-tertiary)]"
            >
              Sort
            </label>
            <select
              id="roster-sort"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as RosterSort)
              }
              className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="position-hierarchy">
                Guild Hierarchy
              </option>
              <option value="gear-desc">Gear Score · High</option>
              <option value="ign-asc">IGN · A–Z</option>
              <option value="level-desc">Level · High</option>
              <option value="weekly-contribution-desc">
                Weekly Contribution · High
              </option>
              <option value="weekly-contribution-asc">
                Weekly Contribution · Low
              </option>
              <option value="total-contribution-desc">
                Total Contribution · High
              </option>
              <option value="total-contribution-asc">
                Total Contribution · Low
              </option>
            </select>
          </div>
        </div>

        {customFields.length > 0 ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4 md:grid-cols-2 xl:max-w-2xl">
            <div>
              <label
                htmlFor="roster-custom-field"
                className="text-xs font-semibold text-[var(--text-tertiary)]"
              >
                Custom field
              </label>
              <select
                id="roster-custom-field"
                value={effectiveCustomFieldId}
                onChange={(event) => {
                  setCustomFieldId(event.target.value);
                  setCustomFieldValue("");
                }}
                className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
              >
                <option value="all">All custom fields</option>
                {customFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomField ? (
              <div>
                <label
                  htmlFor="roster-custom-field-value"
                  className="text-xs font-semibold text-[var(--text-tertiary)]"
                >
                  Custom value
                </label>

                {selectedCustomField.fieldType === "boolean" ? (
                  <select
                    id="roster-custom-field-value"
                    value={effectiveCustomFieldValue}
                    onChange={(event) =>
                      setCustomFieldValue(event.target.value)
                    }
                    className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Any set value</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : selectedCustomField.fieldType === "select" ? (
                  <select
                    id="roster-custom-field-value"
                    value={effectiveCustomFieldValue}
                    onChange={(event) =>
                      setCustomFieldValue(event.target.value)
                    }
                    className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Any set value</option>
                    {selectedCustomField.selectOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="roster-custom-field-value"
                    type={
                      selectedCustomField.fieldType === "number"
                        ? "number"
                        : "search"
                    }
                    step={
                      selectedCustomField.fieldType === "number"
                        ? "any"
                        : undefined
                    }
                    value={effectiveCustomFieldValue}
                    onChange={(event) =>
                      setCustomFieldValue(event.target.value)
                    }
                    placeholder={
                      selectedCustomField.fieldType === "number"
                        ? "Exact number · blank = any"
                        : "Contains text · blank = any"
                    }
                    className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                  />
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Showing{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {visibleCharacters.length}
            </span>{" "}
            of {characters.length} stored characters
            {selectedIds.size > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {selectedIds.size} selected
                </span>
              </>
            ) : null}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {selectableVisibleCharacters.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={toggleAllVisible}
              >
                {allVisibleSelected
                  ? "Clear shown"
                  : "Select all shown"}
              </Button>
            ) : null}

            {selectedIds.size > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearSelection}
              >
                Clear selection
              </Button>
            ) : null}
          </div>
        </div>
      </Surface>

      {selectedCharacters.length > 0 ? (
        <Surface
          level={2}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-[var(--accent-border)] p-4"
        >
          <div>
            <p className="font-semibold">
              {selectedCharacters.length} character
              {selectedCharacters.length === 1 ? "" : "s"} selected
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
              Bulk actions only change organizer-owned fields and manual
              roster status.
            </p>
          </div>

          <BulkRosterDialog
            guildId={guildId}
            characters={selectedCharacters}
            onApplied={clearSelection}
          />
        </Surface>
      ) : null}

      {visibleCharacters.length === 0 ? (
        <Surface level={2} className="mt-4 p-8 text-center">
          <p className="font-semibold">No roster characters match</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Adjust the search or filters.
          </p>
        </Surface>
      ) : (
        <>
          <Surface
            level={2}
            className="mt-4 hidden overflow-hidden xl:block"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-3)] text-xs font-semibold tracking-[0.06em] text-[var(--text-tertiary)] uppercase">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3">Character</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3 text-right">Lv.</th>
                    <th className="px-4 py-3 text-right">Gear Score</th>
                    <th className="px-4 py-3 text-right">
                      Weekly Contribution
                    </th>
                    <th className="px-4 py-3 text-right">
                      Total Contribution
                    </th>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCharacters.map((character) => (
                    <tr
                      key={character.id}
                      className="border-t border-[var(--border-subtle)]"
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(character.id)}
                          disabled={Boolean(character.reconciledIntoCharacterId)}
                          onChange={() =>
                            toggleCharacterSelection(character.id)
                          }
                          aria-label={`Select ${character.ign}`}
                          title={
                            character.reconciledIntoCharacterId
                              ? "Reconciled historical Characters are read-only."
                              : undefined
                          }
                          className="h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-[var(--text-primary)]">
                          {character.ign}
                        </p>
                        {character.reconciledIntoIgn ? (
                          <p className="mt-1 text-xs font-semibold text-[var(--text-tertiary)]">
                            Historical identity → {character.reconciledIntoIgn}
                          </p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-[var(--text-tertiary)]">
                          {character.designation ? (
                            <span className="capitalize">
                              {character.designation}
                            </span>
                          ) : null}
                          {character.roleLabel ? (
                            <span>· {character.roleLabel}</span>
                          ) : null}
                        </div>
                        {character.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {character.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="rounded-full border border-[var(--border-default)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]"
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <CharacterCustomFieldPreview
                          character={character}
                          customFields={customFields}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                        {character.className ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatNumber(character.level)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        {formatNumber(character.gearScore)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatNumber(character.weeklyContribution)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        {formatNumber(character.totalContribution)}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                        {character.guildPosition ?? "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <CharacterStatus character={character} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {character.reconciledIntoCharacterId ? (
                          <span className="text-xs font-semibold text-[var(--text-tertiary)]">
                            History only
                          </span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Manage tags for ${character.ign}`}
                              onClick={() => setTagCharacter(character)}
                            >
                              Tags
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${character.ign}`}
                              onClick={() =>
                                setSelectedCharacter(character)
                              }
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          <div className="mt-4 space-y-3 xl:hidden">
            {visibleCharacters.map((character) => (
              <Surface key={character.id} level={2} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {character.ign}
                    </p>
                    {character.reconciledIntoIgn ? (
                      <p className="mt-1 text-xs font-semibold text-[var(--text-tertiary)]">
                        Historical identity → {character.reconciledIntoIgn}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {character.className ?? "Class unavailable"}
                      {character.level !== null
                        ? ` · Lv. ${character.level}`
                        : ""}
                    </p>
                    {character.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {character.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full border border-[var(--border-default)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <CharacterCustomFieldPreview
                      character={character}
                      customFields={customFields}
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(character.id)}
                      disabled={Boolean(character.reconciledIntoCharacterId)}
                      onChange={() =>
                        toggleCharacterSelection(character.id)
                      }
                      aria-label={`Select ${character.ign}`}
                      title={
                        character.reconciledIntoCharacterId
                          ? "Reconciled historical Characters are read-only."
                          : undefined
                      }
                      className="h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                    />
                    <CharacterStatus character={character} />
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-[var(--text-tertiary)]">
                      Gear Score
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {formatNumber(character.gearScore)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-tertiary)]">
                      Weekly Contribution
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {formatNumber(character.weeklyContribution)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-tertiary)]">
                      Total Contribution
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {formatNumber(character.totalContribution)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-tertiary)]">
                      Position
                    </dt>
                    <dd className="mt-1">
                      {character.guildPosition ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-tertiary)]">
                      Organizer role
                    </dt>
                    <dd className="mt-1">
                      {character.roleLabel ?? "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
                  {character.reconciledIntoCharacterId ? (
                    <p className="text-xs font-semibold text-[var(--text-tertiary)]">
                      Historical identity is read-only.
                    </p>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        aria-label={`Manage tags for ${character.ign}`}
                        onClick={() => setTagCharacter(character)}
                      >
                        Manage Tags
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        aria-label={`Edit ${character.ign}`}
                        onClick={() => setSelectedCharacter(character)}
                      >
                        Edit Character
                      </Button>
                    </>
                  )}
                </div>
              </Surface>
            ))}
          </div>
        </>
      )}

      <CharacterTagsDialog
        guildId={guildId}
        character={tagCharacter}
        availableTags={tags}
        onClose={() => setTagCharacter(null)}
      />

      <CharacterOrganizerDialog
        guildId={guildId}
        character={selectedCharacter}
        customFields={customFields}
        onClose={() => setSelectedCharacter(null)}
      />
    </>
  );
}
