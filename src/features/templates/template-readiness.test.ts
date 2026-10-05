import { describe, expect, it } from "vitest";
import {
  buildTemplatePreviewModel,
  hasBlockingValidationIssues,
  type TemplatePreviewRpcRow,
} from "@/features/templates/template-readiness";

function row(
  overrides: Partial<TemplatePreviewRpcRow> = {},
): TemplatePreviewRpcRow {
  return {
    event_type_id: "11111111-1111-4111-8111-111111111111",
    event_type_name: "Guild League",
    template_id: "22222222-2222-4222-8222-222222222222",
    template_name: "Saturday League",
    template_description: null,
    template_status: "draft",
    uses_areas: false,
    area_id: null,
    area_name: null,
    area_sort_order: null,
    section_id: "33333333-3333-4333-8333-333333333333",
    section_name: "SUN",
    section_sort_order: 0,
    party_id: "44444444-4444-4444-8444-444444444444",
    party_name: "Party 1",
    party_sort_order: 0,
    slot_id: "55555555-5555-4555-8555-555555555555",
    slot_name: "Seat 1",
    role_label: null,
    slot_sort_order: 0,
    ...overrides,
  };
}

describe("Template readiness", () => {
  it("treats error severity as blocking and warnings as non-blocking", () => {
    expect(
      hasBlockingValidationIssues([
        {
          issueCode: "warning",
          severity: "warning",
          message: "Heads up",
          entityType: "template",
          entityId: "1",
        },
      ]),
    ).toBe(false);

    expect(
      hasBlockingValidationIssues([
        {
          issueCode: "missing_section",
          severity: "error",
          message: "Missing Team",
          entityType: "template",
          entityId: "1",
        },
      ]),
    ).toBe(true);
  });

  it("builds a flat ordered Team -> Party -> Slot preview", () => {
    const preview = buildTemplatePreviewModel([
      row({
        slot_id: "55555555-5555-4555-8555-555555555556",
        slot_name: "Seat 2",
        slot_sort_order: 1,
        role_label: "Healer",
      }),
      row(),
    ]);

    expect(preview?.areas).toEqual([]);
    expect(preview?.rootTeams).toHaveLength(1);
    expect(preview?.rootTeams[0]?.parties).toHaveLength(1);
    expect(preview?.rootTeams[0]?.parties[0]?.slots.map((slot) => slot.name)).toEqual([
      "Seat 1",
      "Seat 2",
    ]);
    expect(preview?.rootTeams[0]?.parties[0]?.slots[1]?.roleLabel).toBe("Healer");
  });

  it("groups Area-based Teams under their ordered Areas", () => {
    const preview = buildTemplatePreviewModel([
      row({
        uses_areas: true,
        area_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        area_name: "North",
        area_sort_order: 1,
      }),
      row({
        uses_areas: true,
        area_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        area_name: "South",
        area_sort_order: 0,
        section_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        section_name: "MOON",
      }),
    ]);

    expect(preview?.rootTeams).toEqual([]);
    expect(preview?.areas.map((area) => area.name)).toEqual(["South", "North"]);
    expect(preview?.areas[0]?.teams[0]?.name).toBe("MOON");
  });
});
