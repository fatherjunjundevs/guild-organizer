import { describe, expect, it } from "vitest";
import {
  parseEventTypeManagementInput,
  parseTemplateManagementInput,
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
