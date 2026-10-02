"use client";

import { useMemo, useState } from "react";
import type { MasterRosterCharacter } from "@/features/roster/server";
import {
  filterAndSortRoster,
  getRosterClassOptions,
  getRosterSummary,
  type RosterSort,
  type RosterStatusFilter,
} from "@/features/roster/view-model";
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
  characters,
}: {
  characters: MasterRosterCharacter[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<RosterStatusFilter>("active");
  const [className, setClassName] = useState("all");
  const [sort, setSort] = useState<RosterSort>("gear-desc");

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
          <label>
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">
              Search
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="IGN, class, role…"
              className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">
              Status
            </span>
            <select
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
          </label>

          <label>
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">
              Class
            </span>
            <select
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
          </label>

          <label>
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">
              Sort
            </span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as RosterSort)
              }
              className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="gear-desc">Gear Score · High</option>
              <option value="ign-asc">IGN · A–Z</option>
              <option value="level-desc">Level · High</option>
              <option value="contribution-desc">
                Total Contribution · High
              </option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Showing{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {visibleCharacters.length}
            </span>{" "}
            of {characters.length} stored characters
          </p>

          {status !== "active" ? (
            <p className="text-xs text-[var(--text-tertiary)]">
              Historical rows remain preserved for future event,
              attendance, and auction history.
            </p>
          ) : null}
        </div>
      </Surface>

      {visibleCharacters.length === 0 ? (
        <Surface level={2} className="mt-4 p-8 text-center">
          <p className="font-semibold">No roster characters match</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Adjust the search or filters. If this Guild has not been
            imported yet, the RTNW CSV import flow is the next roster
            checkpoint.
          </p>
        </Surface>
      ) : (
        <>
          <Surface
            level={2}
            className="mt-4 hidden overflow-hidden xl:block"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-3)] text-xs font-semibold tracking-[0.06em] text-[var(--text-tertiary)] uppercase">
                  <tr>
                    <th className="px-4 py-3">Character</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3 text-right">Lv.</th>
                    <th className="px-4 py-3 text-right">Gear Score</th>
                    <th className="px-4 py-3 text-right">
                      Weekly Contribution
                    </th>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCharacters.map((character) => (
                    <tr
                      key={character.id}
                      className="border-t border-[var(--border-subtle)]"
                    >
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
                      <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                        {character.guildPosition ?? "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <CharacterStatus character={character} />
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

                  <CharacterStatus character={character} />
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
                      Contribution
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {formatNumber(character.weeklyContribution)}
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
              </Surface>
            ))}
          </div>
        </>
      )}
    </>
  );
}
