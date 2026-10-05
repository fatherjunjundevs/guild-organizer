"use server";

import { revalidatePath } from "next/cache";
import { isValidUuid } from "@/features/templates/template-management";
import {
  buildTemplatePreviewModel,
  type EventTemplateInspection,
  type TemplatePreviewRpcRow,
  type TemplateValidationIssue,
} from "@/features/templates/template-readiness";
import { createClient } from "@/lib/supabase/server";

export type TemplateInspectionActionResult =
  | { ok: true; inspection: EventTemplateInspection }
  | { ok: false; message: string };

export type TemplateActivationActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function templatePath(guildId: string, templateId: string) {
  return `/app/guild/${guildId}/templates/${templateId}`;
}

function templatesPath(guildId: string) {
  return `/app/guild/${guildId}/templates`;
}

function mapReadinessRpcError(code: string | undefined) {
  if (code === "42501") {
    return "You do not have permission to inspect or activate this Template.";
  }

  if (code === "23514") {
    return "This Template still has blocking validation errors.";
  }

  if (code === "55000") {
    return "Archived Templates cannot be activated.";
  }

  if (code === "P0002") {
    return "The Template could not be found.";
  }

  return "The Template readiness operation could not be completed.";
}

export async function inspectEventTemplateAction(
  formData: FormData,
): Promise<TemplateInspectionActionResult> {
  const guildId = getString(formData, "guildId");
  const templateId = getString(formData, "templateId");

  if (!isValidUuid(guildId) || !isValidUuid(templateId)) {
    return { ok: false, message: "The Template identifiers are invalid." };
  }

  const supabase = await createClient();
  const [validationResult, previewResult] = await Promise.all([
    supabase.rpc("validate_event_template", {
      p_template_id: templateId,
    }),
    supabase.rpc("get_event_template_preview", {
      p_template_id: templateId,
    }),
  ]);

  if (validationResult.error) {
    return {
      ok: false,
      message: mapReadinessRpcError(validationResult.error.code),
    };
  }

  if (previewResult.error) {
    return {
      ok: false,
      message: mapReadinessRpcError(previewResult.error.code),
    };
  }

  const issues: TemplateValidationIssue[] = (validationResult.data ?? []).map(
    (issue) => ({
      issueCode: issue.issue_code,
      severity: issue.severity,
      message: issue.message,
      entityType: issue.entity_type,
      entityId: issue.entity_id,
    }),
  );

  const preview = buildTemplatePreviewModel(
    (previewResult.data ?? []) as unknown as TemplatePreviewRpcRow[],
  );

  if (!preview || preview.templateId !== templateId) {
    return {
      ok: false,
      message: "The ordered Template preview could not be loaded.",
    };
  }

  return {
    ok: true,
    inspection: { issues, preview },
  };
}

export async function activateEventTemplateAction(
  formData: FormData,
): Promise<TemplateActivationActionResult> {
  const guildId = getString(formData, "guildId");
  const templateId = getString(formData, "templateId");

  if (!isValidUuid(guildId) || !isValidUuid(templateId)) {
    return { ok: false, message: "The Template identifiers are invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_event_template", {
    p_template_id: templateId,
  });

  if (error) {
    return {
      ok: false,
      message: mapReadinessRpcError(error.code),
    };
  }

  revalidatePath(templatePath(guildId, templateId));
  revalidatePath(templatesPath(guildId));

  return {
    ok: true,
    message: "Template activated successfully.",
  };
}
