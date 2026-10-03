import { describe, expect, it } from "vitest";
import {
  formatImportHistoryValue,
  labelForImportChange,
  labelForImportField,
  labelForImportSource,
  toneForImportChange,
} from "@/features/roster/import-history";

describe("import history presentation", () => {
  it("labels known import sources", () => {
    expect(labelForImportSource("rtnw_csv")).toBe("RTNW CSV");
    expect(labelForImportSource("generic_spreadsheet")).toBe(
      "Spreadsheet",
    );
    expect(labelForImportSource("future_source")).toBe(
      "Roster import",
    );
  });

  it("labels known Character change kinds", () => {
    expect(labelForImportChange("new")).toBe("New");
    expect(labelForImportChange("update")).toBe("Updated");
    expect(labelForImportChange("reactivate")).toBe("Returning");
    expect(labelForImportChange("left_guild")).toBe("Left Guild");
  });

  it("maps change kinds to consistent status tones", () => {
    expect(toneForImportChange("new")).toBe("success");
    expect(toneForImportChange("update")).toBe("accent");
    expect(toneForImportChange("reactivate")).toBe("warning");
    expect(toneForImportChange("left_guild")).toBe("warning");
  });

  it("labels known and future field names", () => {
    expect(labelForImportField("gear_score")).toBe("Gear score");
    expect(labelForImportField("role_label")).toBe("Organizer role");
    expect(labelForImportField("future_metric")).toBe(
      "Future Metric",
    );
  });

  it("formats null and boolean history values", () => {
    expect(formatImportHistoryValue("title", null)).toBe("â€”");
    expect(formatImportHistoryValue("flag", true)).toBe("Yes");
    expect(formatImportHistoryValue("flag", false)).toBe("No");
  });

  it("formats numeric history values", () => {
    expect(formatImportHistoryValue("gear_score", 125000)).toBe(
      "125,000",
    );
  });

  it("humanizes lifecycle values", () => {
    expect(formatImportHistoryValue("status", "active")).toBe(
      "Active",
    );
    expect(
      formatImportHistoryValue("inactive_reason", "left_guild"),
    ).toBe("Left Guild");
    expect(
      formatImportHistoryValue("source_origin", "rtnw_export"),
    ).toBe("RTNW Export");
  });
});
