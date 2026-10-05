import { describe, expect, it } from "vitest";
import {
  parseEventTypeManagementInput,
  parseTemplateCloneInput,
  parseTemplateManagementInput,
  suggestTemplateCloneName,
} from "@/features/templates/template-management";

const EVENT_TYPE_ID = "11111111-1111-4111-8111-111111111111";

describe("Event Type management input", () => {
  it("trims organizer-entered text and normalizes a blank description", () => {
    expect(
      parseEventTypeManagementInput({
        name: "  Guild League  ",
        description: "   ",
        status: "active",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "Guild League",
        description: null,
        status: "active",
      },
    });
  });

  it("preserves Unicode Event Type names", () => {
    expect(
      parseEventTypeManagementInput({
        name: "  星月 Siege  ",
        description: "  Saturday rotation  ",
        status: "archived",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "星月 Siege",
        description: "Saturday rotation",
        status: "archived",
      },
    });
  });

  it("rejects unsupported Event Type lifecycle values", () => {
    expect(
      parseEventTypeManagementInput({
        name: "Guild League",
        description: "",
        status: "draft",
      }).ok,
    ).toBe(false);
  });

  it("rejects Event Type names over the schema limit", () => {
    expect(
      parseEventTypeManagementInput({
        name: "x".repeat(81),
        description: "",
        status: "active",
      }).ok,
    ).toBe(false);
  });
});

describe("Template management input", () => {
  it("parses a reusable Area-based draft Template", () => {
    expect(
      parseTemplateManagementInput({
        eventTypeId: EVENT_TYPE_ID,
        name: "  Saturday League  ",
        description: "  Standard lineup  ",
        usesAreas: "true",
        status: "draft",
      }),
    ).toEqual({
      ok: true,
      value: {
        eventTypeId: EVENT_TYPE_ID,
        name: "Saturday League",
        description: "Standard lineup",
        usesAreas: true,
        status: "draft",
      },
    });
  });

  it("parses a flat archived Template and clears blank description", () => {
    expect(
      parseTemplateManagementInput({
        eventTypeId: EVENT_TYPE_ID,
        name: "Legacy Setup",
        description: "",
        usesAreas: "false",
        status: "archived",
      }),
    ).toEqual({
      ok: true,
      value: {
        eventTypeId: EVENT_TYPE_ID,
        name: "Legacy Setup",
        description: null,
        usesAreas: false,
        status: "archived",
      },
    });
  });

  it("rejects malformed Event Type identifiers", () => {
    expect(
      parseTemplateManagementInput({
        eventTypeId: "not-a-uuid",
        name: "Saturday League",
        description: "",
        usesAreas: "false",
        status: "draft",
      }).ok,
    ).toBe(false);
  });

  it("rejects direct metadata activation", () => {
    const result = parseTemplateManagementInput({
      eventTypeId: EVENT_TYPE_ID,
      name: "Saturday League",
      description: "",
      usesAreas: "false",
      status: "active",
    });

    expect(result).toEqual({
      ok: false,
      message:
        "Template metadata can only be saved as Draft or Archived. Activation uses the validation gate.",
    });
  });

  it("rejects unknown structure modes", () => {
    expect(
      parseTemplateManagementInput({
        eventTypeId: EVENT_TYPE_ID,
        name: "Saturday League",
        description: "",
        usesAreas: "maybe",
        status: "draft",
      }).ok,
    ).toBe(false);
  });
});

describe("Template clone input", () => {
  it("trims clone metadata and normalizes a blank description", () => {
    expect(
      parseTemplateCloneInput({
        eventTypeId: EVENT_TYPE_ID,
        name: "  Guild League Copy  ",
        description: "   ",
      }),
    ).toEqual({
      ok: true,
      value: {
        eventTypeId: EVENT_TYPE_ID,
        name: "Guild League Copy",
        description: null,
      },
    });
  });

  it("rejects an invalid destination Event Type", () => {
    expect(
      parseTemplateCloneInput({
        eventTypeId: "not-a-uuid",
        name: "Guild League Copy",
        description: "",
      }),
    ).toEqual({
      ok: false,
      message: "Choose a valid destination Event Type.",
    });
  });

  it("suggests a case-insensitive unique copy name", () => {
    expect(
      suggestTemplateCloneName("Guild League", [
        "Guild League",
        "guild league copy",
        "Guild League Copy 2",
      ]),
    ).toBe("Guild League Copy 3");
  });

  it("normalizes an already-cloned source name", () => {
    expect(
      suggestTemplateCloneName("Guild League Copy", [
        "Guild League",
        "Guild League Copy",
      ]),
    ).toBe("Guild League Copy 2");

    expect(
      suggestTemplateCloneName("Guild League Copy 2", [
        "Guild League",
        "Guild League Copy",
        "Guild League Copy 2",
      ]),
    ).toBe("Guild League Copy 3");
  });

  it("keeps suggested clone names within the schema limit", () => {
    expect(suggestTemplateCloneName("x".repeat(120), [])).toHaveLength(120);
  });
});
