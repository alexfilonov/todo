import { supabase } from "./db.js";
import type { AssignmentRecord, OAuthTokenRow, Provider, SyncSettings } from "./types.js";
import { config } from "./config.js";

const SETTINGS_KEY = "settings";

export async function getOAuthToken(provider: Provider): Promise<OAuthTokenRow | null> {
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function upsertOAuthToken(token: {
  provider: Provider;
  access_token: string;
  refresh_token?: string | null;
  token_type?: string | null;
  scope?: string | null;
  expires_at?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("oauth_tokens").upsert(
    {
      provider: token.provider,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      token_type: token.token_type ?? null,
      scope: token.scope ?? null,
      expires_at: token.expires_at ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );

  if (error) {
    throw error;
  }
}

export async function getSettings(): Promise<SyncSettings> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const fallback: SyncSettings = {
    taskListName: config.defaultTaskListName,
    deleteMode: config.defaultDeleteMode,
    hidePastDue: config.defaultHidePastDue,
  };

  if (!data?.value || typeof data.value !== "object") {
    return fallback;
  }

  const value = data.value as Partial<SyncSettings>;
  return {
    taskListName: value.taskListName || fallback.taskListName,
    deleteMode: value.deleteMode === "complete" ? "complete" : "delete",
    includedCourseIds: Array.isArray(value.includedCourseIds)
      ? value.includedCourseIds.map(String)
      : undefined,
    hidePastDue:
      value.hidePastDue === undefined ? fallback.hidePastDue : Boolean(value.hidePastDue),
  };
}

export async function saveSettings(settings: Partial<SyncSettings>): Promise<SyncSettings> {
  const current = await getSettings();
  const merged: SyncSettings = { ...current };
  if (settings.taskListName !== undefined) merged.taskListName = settings.taskListName;
  if (settings.deleteMode !== undefined) merged.deleteMode = settings.deleteMode;
  if (settings.includedCourseIds !== undefined) merged.includedCourseIds = settings.includedCourseIds;
  if (settings.hidePastDue !== undefined) merged.hidePastDue = settings.hidePastDue;

  const { error } = await supabase.from("app_config").upsert(
    {
      key: SETTINGS_KEY,
      value: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    throw error;
  }

  return merged;
}

export async function startSyncRun(): Promise<string> {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function finishSyncRun(
  runId: string,
  payload: {
    status: "success" | "failed";
    fetched_count?: number;
    upserted_count?: number;
    deleted_count?: number;
    error?: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from("sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: payload.status,
      fetched_count: payload.fetched_count ?? 0,
      upserted_count: payload.upserted_count ?? 0,
      deleted_count: payload.deleted_count ?? 0,
      error: payload.error ?? null,
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
}

export async function getLatestSyncRun(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getActiveAssignments(): Promise<AssignmentRecord[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return (data ?? []) as AssignmentRecord[];
}

export async function upsertAssignments(rows: Array<Omit<AssignmentRecord, "id" | "first_seen_at" | "updated_at">>): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const payload = rows.map((row) => ({
    ...row,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("assignments")
    .upsert(payload, { onConflict: "source,source_id" });

  if (error) {
    throw error;
  }
}

export async function markAssignmentsDeleted(assignmentIds: string[]): Promise<void> {
  if (assignmentIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("assignments")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .in("id", assignmentIds);

  if (error) {
    throw error;
  }
}

export async function listAssignments(filters: {
  courseId?: string;
  from?: string;
  to?: string;
  status?: "active" | "deleted";
}): Promise<AssignmentRecord[]> {
  let query = supabase
    .from("assignments")
    .select("*")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (filters.courseId) {
    query = query.eq("course_id", filters.courseId);
  }
  if (filters.from) {
    query = query.gte("due_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("due_at", filters.to);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as AssignmentRecord[];
}

export async function getTaskLinkByAssignmentId(
  assignmentId: string,
): Promise<{ task_list_id: string; google_task_id: string } | null> {
  const { data, error } = await supabase
    .from("google_task_links")
    .select("task_list_id, google_task_id")
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    task_list_id: data.task_list_id as string,
    google_task_id: data.google_task_id as string,
  };
}

export async function upsertTaskLink(row: {
  assignment_id: string;
  task_list_id: string;
  google_task_id: string;
  etag?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("google_task_links").upsert(
    {
      assignment_id: row.assignment_id,
      task_list_id: row.task_list_id,
      google_task_id: row.google_task_id,
      etag: row.etag ?? null,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id" },
  );

  if (error) {
    throw error;
  }
}

export async function deleteTaskLinksForAssignments(assignmentIds: string[]): Promise<void> {
  if (assignmentIds.length === 0) {
    return;
  }

  const { error } = await supabase.from("google_task_links").delete().in("assignment_id", assignmentIds);
  if (error) {
    throw error;
  }
}

export async function clearTaskLinks(): Promise<void> {
  const { error } = await supabase.from("google_task_links").delete().not("id", "is", null);
  if (error) {
    throw error;
  }
}
