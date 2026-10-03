"use client";

import { useState } from "react";
import { setCharacterRosterCustomFieldsAction } from "@/features/roster/custom-field-actions";
import type {
  MasterRosterCharacter,
  MasterRosterCustomField,
} from "@/features/roster/server";
import { Button } from "@/components/ui/button";

function getDefaultValue(
  character: MasterRosterCharacter,
  field: MasterRosterCustomField,
) {
  const value = character.customFieldValues?.[field.id];

  if (value === undefined) {
    return "";
  }

  if (field.fieldType === "boolean") {
    return typeof value === "boolean" ? String(value) : "";
  }

  return String(value);
}

function CustomFieldControl({
  character,
  field,
}: {
  character: MasterRosterCharacter;
  field: MasterRosterCustomField;
}) {
  const inputId = `character-custom-field-${field.id}`;
  const name = `customField:${field.id}`;
  const defaultValue = getDefaultValue(character, field);

  if (field.fieldType === "boolean") {
    return (
      <div className="text-sm font-semibold">
        <label htmlFor={inputId}>{field.name}</label>
        <select
          id={inputId}
          name={name}
          defaultValue={defaultValue}
          className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
        >
          <option value="">Not set</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }

  if (field.fieldType === "select") {
    return (
      <div className="text-sm font-semibold">
        <label htmlFor={inputId}>{field.name}</label>
        <select
          id={inputId}
          name={name}
          defaultValue={defaultValue}
          className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
        >
          <option value="">Not set</option>
          {field.selectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="text-sm font-semibold">
      <label htmlFor={inputId}>{field.name}</label>
      <input
        id={inputId}
        name={name}
        defaultValue={defaultValue}
        maxLength={field.fieldType === "text" ? 120 : undefined}
        inputMode={field.fieldType === "number" ? "decimal" : undefined}
        autoComplete="off"
        placeholder={field.fieldType === "number" ? "Enter a number" : "Not set"}
        className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
      />
    </div>
  );
}

export function CharacterCustomFieldsForm({
  guildId,
  character,
  fields,
  onSaved,
}: {
  guildId: string;
  character: MasterRosterCharacter;
  fields: MasterRosterCustomField[];
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result = await setCharacterRosterCustomFieldsAction(
      new FormData(event.currentTarget),
    );

    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    onSaved();
  }

  if (fields.length === 0) {
    return (
      <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
        <p className="font-semibold">Custom fields</p>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
          No Guild custom fields are configured yet. Use Manage Fields at
          the top of the Master Roster to create organizer-defined fields.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 border-t border-[var(--border-subtle)] pt-6"
    >
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="characterId" value={character.id} />

      <p className="font-semibold">Custom fields</p>
      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
        These values belong to Guild Organizer and are preserved across
        official RTNW roster imports.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <CustomFieldControl
            key={field.id}
            character={character}
            field={field}
          />
        ))}
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[var(--danger)]">{message}</p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save Custom Fields"}
        </Button>
      </div>
    </form>
  );
}
