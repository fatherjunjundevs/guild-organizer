import { describe, expect, it } from "vitest";
import {
  isValidEventUuid,
  parseEventCreationInput,
} from "@/features/events/event-management";

const templateId = "85000000-0000-4000-8000-000000000001";

describe("event management input", () => {
  it("accepts a valid UUID", () => {
    expect(isValidEventUuid(templateId)).toBe(true);
  });

  it("rejects a malformed Template id", () => {
    const result = parseEventCreationInput({
      templateId: "not-a-template",
      name: "Guild League Week 1",
      description: "",
    });

    expect(result).toEqual({
      ok: false,
      message: "Choose a valid active Template.",
    });
  });

  it("trims Event name and description", () => {
    const result = parseEventCreationInput({
      templateId,
      name: "  Guild League Week 1  ",
      description: "  Opening week lineup  ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        templateId,
        name: "Guild League Week 1",
        description: "Opening week lineup",
      },
    });
  });

  it("converts a blank description to null", () => {
    const result = parseEventCreationInput({
      templateId,
      name: "Guild League Week 1",
      description: "   ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        templateId,
        name: "Guild League Week 1",
        description: null,
      },
    });
  });

  it("rejects a blank Event name", () => {
    const result = parseEventCreationInput({
      templateId,
      name: "   ",
      description: "",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects Event names over 120 characters", () => {
    const result = parseEventCreationInput({
      templateId,
      name: "x".repeat(121),
      description: "",
    });

    expect(result.ok).toBe(false);
  });

  it("accepts an Event name exactly 120 characters long", () => {
    const result = parseEventCreationInput({
      templateId,
      name: "x".repeat(120),
      description: "",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects descriptions over 1000 characters", () => {
    const result = parseEventCreationInput({
      templateId,
      name: "Guild League Week 1",
      description: "x".repeat(1001),
    });

    expect(result.ok).toBe(false);
  });
});
