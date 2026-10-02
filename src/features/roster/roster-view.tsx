"use client";

import { useMemo, useState } from "react";
import { BulkRosterDialog } from "@/features/roster/bulk-roster-dialog";
import { CharacterOrganizerDialog } from "@/features/roster/character-organizer-dialog";
import type { MasterRosterCharacter } from "@/features/roster/server";
import {
  filterAndSortRoster,
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

function CharacterStatus({
  character,
}: {
  character: MasterRosterCharacter;
}) {
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
}: {
  guildId: string;
  characters: MasterRosterCharacter[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<RosterStatusFilter>("active");
  const [className, setClassName] = useState("all");
  const [sort, setSort] =
    useState<RosterSort>("position-hierarchy");
  const [selectedCharacter, setSelectedCharacter] =
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
  const visibleCharacters = useMemo(
    () =>
      filterAndSortRoster(characters, {
        query,
        status,
        className,
        sort,
      }),
    [characters, query, status, className, sort],
  );
  const selectedCharacters = useMemo(
    () =>
      characters.filter((character) =>
        selectedIds.has(character.id),
      ),
    [characters, selectedIds],
  );
  const allVisibleSelected =
    visibleCharacters.length > 0 &&
    visibleCharacters.every((character) =>
      selectedIds.has(character.id),
    );

  function toggleCharacterSelection(characterId: string) {
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
        for (const character of visibleCharacters) {
          next.delete(character.id);
        }
      } else {
        for (const character of visibleCharacters) {
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
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_11rem_13rem_13rem]">
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
              placeholder="IGN, class, role…"
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
            {visibleCharacters.length > 0 ? (
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
              <table className="w-full min-w-[1210px] border-collapse text-left text-sm">
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
                          onChange={() =>
                            toggleCharacterSelection(character.id)
                          }
                          aria-label={`Select ${character.ign}`}
                          className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-[var(--text-primary)]">
                          {character.ign}
                        </p>
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
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setSelectedCharacter(character)
                          }
                        >
                          Edit
                        </Button>
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
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {character.className ?? "Class unavailable"}
                      {character.level !== null
                        ? ` · Lv. ${character.level}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(character.id)}
                      onChange={() =>
                        toggleCharacterSelection(character.id)
                      }
                      aria-label={`Select ${character.ign}`}
                      className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
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

                <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedCharacter(character)}
                  >
                    Edit Character
                  </Button>
                </div>
              </Surface>
            ))}
          </div>
        </>
      )}

      <CharacterOrganizerDialog
        guildId={guildId}
        character={selectedCharacter}
        onClose={() => setSelectedCharacter(null)}
      />
    </>
  );
}
