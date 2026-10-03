import { describe, expect, it } from "vitest";
import { parseBulkRosterActionInput } from "@/features/roster/bulk-roster";

const id1 = "10000000-0000-4000-8000-000000000001";
const id2 = "10000000-0000-4000-8000-000000000002";

describe("bulk roster action input", () => {
  it("parses a bulk designation update", () => {
    expect(
      parseBulkRosterActionInput({
        characterIdsJson: JSON.stringify([id1, id2]),
        action: "designation",
        value: "main",
      }),
    ).toEqual({
      ok: true,
      value: {
        characterIds: [id1, id2],
        action: "designation",
        value: "main",
      },
    });
  });

  it("allows clearing designation and organizer role", () => {
    const designation = parseBulkRosterActionInput({
      characterIdsJson: JSON.stringify([id1]),
      action: "designation",
      value: "",
    });
    const role = parseBulkRosterActionInput({
      characterIdsJson: JSON.stringify([id1]),
      action: "role_label",
      value: "   ",
    });

    expect(designation.ok && designation.value.value).toBe("");
    expect(role.ok && role.value.value).toBe("");
  });

  it("trims a custom organizer role", () => {
    expect(
      parseBulkRosterActionInput({
        characterIdsJson: JSON.stringify([id1]),
        action: "role_label",
        value: "  Reserve Healer  ",
      }),
    ).toEqual({
      ok: true,
      value: {
        characterIds: [id1],
        action: "role_label",
        value: "Reserve Healer",
      },
    });
  });

  it("deduplicates selected character ids", () => {
    const result = parseBulkRosterActionInput({
      characterIdsJson: JSON.stringify([id1, id1, id2]),
      action: "status",
      value: "inactive",
    });

    expect(result.ok && result.value.characterIds).toEqual([
      id1,
      id2,
    ]);
  });

  it("rejects invalid ids, actions, and status values", () => {
    expect(
      parseBulkRosterActionInput({
        characterIdsJson: JSON.stringify(["bad-id"]),
        action: "status",
        value: "active",
      }).ok,
    ).toBe(false);

    expect(
      parseBulkRosterActionInput({
        characterIdsJson: JSON.stringify([id1]),
        action: "delete",
        value: "",
      }).ok,
    ).toBe(false);

    expect(
      parseBulkRosterActionInput({
        characterIdsJson: JSON.stringify([id1]),
        action: "status",
        value: "left_guild",
      }).ok,
    ).toBe(false);
  });
});
