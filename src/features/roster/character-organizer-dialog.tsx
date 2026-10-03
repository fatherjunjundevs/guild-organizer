"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CharacterCustomFieldsForm } from "@/features/roster/character-custom-fields-form";
import {
  updateCharacterOrganizationAction,
  updateManualCharacterDetailsAction,
} from "@/features/roster/manual-actions";
import { PresetOrCustomField } from "@/features/roster/preset-or-custom-field";
import {
  GENDER_OPTIONS,
  GUILD_POSITION_OPTIONS,
  ONLINE_STATUS_OPTIONS,
  ORGANIZER_ROLE_OPTIONS,
  RTNW_CLASS_OPTIONS,
} from "@/features/roster/roster-field-options";
import type {
  MasterRosterCharacter,
  MasterRosterCustomField,
} from "@/features/roster/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

function fieldValue(value: string | number | null) {
  return value === null ? "" : String(value);
}

export function CharacterOrganizerDialog({
  guildId,
  character,
  customFields,
  onClose,
}: {
  guildId: string;
  character: MasterRosterCharacter | null;
  customFields: MasterRosterCustomField[];
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerStartedRef = useRef(false);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [organizationBusy, setOrganizationBusy] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState("");
  const [organizationMessage, setOrganizationMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (character && !dialog.open) dialog.showModal();
    if (!character && dialog.open) dialog.close();
  }, [character]);

  if (!character) {
    return <dialog ref={dialogRef} className="hidden" />;
  }

  function finishSuccess() {
    dialogRef.current?.close();
    router.refresh();
  }

  async function submitDetails(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setDetailsBusy(true);
    setDetailsMessage("");

    const result = await updateManualCharacterDetailsAction(
      new FormData(event.currentTarget),
    );

    if (!result.ok) {
      setDetailsMessage(result.message);
      setDetailsBusy(false);
      return;
    }

    setDetailsBusy(false);
    finishSuccess();
  }

  async function submitOrganization(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setOrganizationBusy(true);
    setOrganizationMessage("");

    const result = await updateCharacterOrganizationAction(
      new FormData(event.currentTarget),
    );

    if (!result.ok) {
      setOrganizationMessage(result.message);
      setOrganizationBusy(false);
      return;
    }

    setOrganizationBusy(false);
    finishSuccess();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="character-organizer-dialog-title"
      onClose={() => {
        setDetailsBusy(false);
        setOrganizationBusy(false);
        setDetailsMessage("");
        setOrganizationMessage("");
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPointerStartedRef.current =
          event.target === dialogRef.current;
      }}
      onPointerCancel={() => {
        backdropPointerStartedRef.current = false;
      }}
      onClick={(event) => {
        const shouldClose =
          backdropPointerStartedRef.current &&
          event.target === dialogRef.current;

        backdropPointerStartedRef.current = false;

        if (!shouldClose) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        window.requestAnimationFrame(() => {
          if (dialogRef.current?.open) {
            dialogRef.current.close();
          }
        });
      }}
      className="m-auto w-[min(52rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <StatusChip
            tone={character.sourceOrigin === "rtnw_export" ? "accent" : "neutral"}
          >
            {character.sourceOrigin === "rtnw_export"
              ? "RTNW synced"
              : "Manual"}
          </StatusChip>
          <h2
            id="character-organizer-dialog-title"
            className="mt-2 truncate text-xl font-semibold"
          >
            <span className="sr-only">Character organizer for </span>
            {character.ign}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {character.className ?? "Class unavailable"}
            {character.guildPosition ? ` · ${character.guildPosition}` : ""}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => dialogRef.current?.close()}
        >
          Close
        </Button>
      </div>

      <div className="p-5 sm:p-6">
        {character.sourceOrigin === "manual" ? (
          <form onSubmit={submitDetails}>
            <input type="hidden" name="guildId" value={guildId} />
            <input type="hidden" name="characterId" value={character.id} />

            <p className="font-semibold">Manual game details</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Maintain these fields manually until this exact IGN is
              recognized by an official RTNW roster import.
            </p>

            <div className="mt-4">
              <div className="text-sm font-semibold">
                <label htmlFor="edit-character-ign">IGN</label>
                <input id="edit-character-ign"
                  name="ign"
                  required
                  maxLength={80}
                  defaultValue={character.ign}
                  autoComplete="off"
                  className="mt-2 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                IGN is the v1 roster identity key. Preserve exact case,
                symbols, and Unicode. Renaming changes the exact IGN that
                a future RTNW import will match.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="text-sm font-semibold">
                <label htmlFor="edit-character-level">Level</label>
                <input id="edit-character-level"
                  name="level"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  defaultValue={fieldValue(character.level)}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                />
              </div>

              <PresetOrCustomField
                name="className"
                label="Class"
                options={RTNW_CLASS_OPTIONS}
                defaultValue={character.className}
                placeholder="Enter class"
              />

              <PresetOrCustomField
                name="guildPosition"
                label="Guild Position"
                options={GUILD_POSITION_OPTIONS}
                defaultValue={character.guildPosition}
                placeholder="Enter Guild position"
              />

              <div className="text-sm font-semibold">
                <label htmlFor="edit-character-gear-score">Gear Score</label>
                <input id="edit-character-gear-score"
                  name="gearScore"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  defaultValue={fieldValue(character.gearScore)}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                />
              </div>

              <div className="text-sm font-semibold">
                <label htmlFor="edit-character-title">Title</label>
                <input id="edit-character-title"
                  name="title"
                  maxLength={120}
                  defaultValue={fieldValue(character.title)}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                />
              </div>

              <PresetOrCustomField
                name="gender"
                label="Gender"
                options={GENDER_OPTIONS}
                defaultValue={character.gender}
                placeholder="Enter gender"
                maxLength={40}
              />

              <div className="text-sm font-semibold">
                <label htmlFor="edit-character-weekly-activity">Weekly Activity</label>
                <input id="edit-character-weekly-activity"
                  name="weeklyActivity"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  defaultValue={fieldValue(character.weeklyActivity)}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                />
              </div>

              <div className="text-sm font-semibold">
                <label htmlFor="edit-character-weekly-contribution">Weekly Contribution</label>
                <input id="edit-character-weekly-contribution"
                  name="weeklyContribution"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  defaultValue={fieldValue(character.weeklyContribution)}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                />
              </div>

              <div className="text-sm font-semibold">
                <label htmlFor="edit-character-total-contribution">Total Contribution</label>
                <input id="edit-character-total-contribution"
                  name="totalContribution"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  defaultValue={fieldValue(character.totalContribution)}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <PresetOrCustomField
                  name="onlineStatus"
                  label="Online Status"
                  options={ONLINE_STATUS_OPTIONS}
                  defaultValue={character.onlineStatus}
                  placeholder="Enter online status"
                  maxLength={120}
                />
              </div>
            </div>

            {detailsMessage ? (
              <p className="mt-4 text-sm text-[var(--danger)]">
                {detailsMessage}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={detailsBusy}>
                {detailsBusy ? "Saving…" : "Save Game Details"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--accent)]">
              Game fields are RTNW-managed
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              IGN, class, level, title, gender, Guild Position, Gear
              Score, activity, contribution, and online status are
              protected from manual edits. The latest confirmed official
              roster export remains the source of truth.
            </p>
          </div>
        )}

        <form
          onSubmit={submitOrganization}
          className="mt-6 border-t border-[var(--border-subtle)] pt-6"
        >
          <input type="hidden" name="guildId" value={guildId} />
          <input type="hidden" name="characterId" value={character.id} />

          <p className="font-semibold">Organizer controls</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Main/Sub and Organizer Role are Guild Organizer metadata.
            RTNW imports never overwrite them.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="text-sm font-semibold">
                <label htmlFor="edit-character-designation">Designation</label>
                <select id="edit-character-designation"
                name="designation"
                defaultValue={character.designation ?? ""}
                className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
              >
                <option value="">None</option>
                <option value="main">Main</option>
                <option value="sub">Sub</option>
              </select>
              </div>

            <PresetOrCustomField
              name="roleLabel"
              label="Organizer Role"
              options={ORGANIZER_ROLE_OPTIONS}
              defaultValue={character.roleLabel}
              emptyLabel="None"
              placeholder="Enter organizer role"
            />
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold">
                <label htmlFor="edit-character-status">Roster Status</label>
                <select id="edit-character-status"
                name="status"
                defaultValue={
                  character.status === "active" ? "active" : "inactive"
                }
                className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              </div>

            <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
              Manual Inactive never deletes history. If this exact IGN
              appears in a later confirmed RTNW export, that export can
              restore the character to Active because it is authoritative
              for current Guild membership.
            </p>
          </div>

          {organizationMessage ? (
            <p className="mt-4 text-sm text-[var(--danger)]">
              {organizationMessage}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={detailsBusy || organizationBusy}
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={detailsBusy || organizationBusy}
            >
              {organizationBusy
                ? "Saving…"
                : "Save Organizer Settings"}
            </Button>
          </div>
        </form>

        <CharacterCustomFieldsForm
          guildId={guildId}
          character={character}
          fields={customFields}
          onSaved={finishSuccess}
        />
      </div>
    </dialog>
  );
}
