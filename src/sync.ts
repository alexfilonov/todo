import { fetchCanvasAssignmentsForCourse, fetchCanvasCourses } from "./canvas.js";
import {
  completeTask,
  createTask,
  deleteAllTasksInList,
  deleteTask,
  ensureTaskList,
  updateTask,
} from "./googleTasks.js";
import { getValidAccessToken } from "./oauth.js";
import {
  clearTaskLinks,
  deleteTaskLinksForAssignments,
  finishSyncRun,
  getActiveAssignments,
  getSettings,
  getTaskLinkByAssignmentId,
  markAssignmentsDeleted,
  startSyncRun,
  upsertAssignments,
  upsertTaskLink,
} from "./repositories.js";
import type { AssignmentRecord } from "./types.js";

let isSyncRunning = false;

function assignmentSource(assignment: {
  submission_types?: string[];
  external_tool_tag_attributes?: { url?: string };
}): "canvas" | "gradescope_via_canvas" {
  const externalUrl = assignment.external_tool_tag_attributes?.url?.toLowerCase() ?? "";
  const hasExternalTool = assignment.submission_types?.includes("external_tool") ?? false;
  if (hasExternalTool && externalUrl.includes("gradescope")) {
    return "gradescope_via_canvas";
  }
  return "canvas";
}

function stableKey(assignment: { source: string; source_id: string }): string {
  return `${assignment.source}:${assignment.source_id}`;
}

function toTaskPayload(assignment: AssignmentRecord): { title: string; notes: string; due?: string } {
  const due = assignment.due_at ? new Date(assignment.due_at).toISOString() : undefined;
  const notesLines = [
    `Course: ${assignment.course_name ?? assignment.course_id}`,
    assignment.html_url ? `Link: ${assignment.html_url}` : "",
    assignment.points_possible != null ? `Points: ${assignment.points_possible}` : "",
    `Source Key: ${assignment.source}:${assignment.source_id}`,
  ].filter(Boolean);

  return {
    title: `[${assignment.course_name ?? assignment.course_id}] ${assignment.title}`,
    notes: notesLines.join("\n"),
    due,
  };
}

async function syncDeletedAssignments(
  deletedAssignments: AssignmentRecord[],
  googleAccessToken: string,
  deleteMode: "delete" | "complete",
): Promise<void> {
  const deletedIds: string[] = [];

  for (const assignment of deletedAssignments) {
    const link = await getTaskLinkByAssignmentId(assignment.id);
    if (!link) {
      continue;
    }

    if (deleteMode === "complete") {
      await completeTask(googleAccessToken, link.task_list_id, link.google_task_id);
    } else {
      await deleteTask(googleAccessToken, link.task_list_id, link.google_task_id);
    }

    deletedIds.push(assignment.id);
  }

  await deleteTaskLinksForAssignments(deletedIds);
}

export async function runSync(options?: { forceRebuildLinks?: boolean }): Promise<{
  fetchedCount: number;
  upsertedCount: number;
  deletedCount: number;
}> {
  if (isSyncRunning) {
    throw new Error("Sync is already in progress.");
  }

  isSyncRunning = true;
  const runId = await startSyncRun();

  try {
    const settings = await getSettings();
    const canvasAccessToken = await getValidAccessToken("canvas");
    const googleAccessToken = await getValidAccessToken("google");
    const taskListId = await ensureTaskList(googleAccessToken, settings.taskListName);

    if (options?.forceRebuildLinks) {
      await deleteAllTasksInList(googleAccessToken, taskListId);
      await clearTaskLinks();
    }

    const courses = await fetchCanvasCourses(canvasAccessToken);
    const filteredCourses = settings.includedCourseIds?.length
      ? courses.filter((course) => settings.includedCourseIds?.includes(String(course.id)))
      : courses;

    const assignmentRows: Array<Omit<AssignmentRecord, "id" | "first_seen_at" | "updated_at">> = [];
    const nowMs = Date.now();
    for (const course of filteredCourses) {
      const assignments = await fetchCanvasAssignmentsForCourse(canvasAccessToken, String(course.id));
      for (const assignment of assignments) {
        const dueAt = assignment.due_at ?? null;

        // No-due assignments are usually participation/exams/past artifacts and are noisy for deadline sync.
        if (!dueAt) {
          continue;
        }

        if (settings.hidePastDue && new Date(dueAt).getTime() < nowMs) {
          continue;
        }

        assignmentRows.push({
          source: assignmentSource(assignment),
          source_id: String(assignment.id),
          course_id: String(course.id),
          course_name: course.name,
          title: assignment.name,
          description: assignment.description ?? null,
          due_at: dueAt,
          html_url: assignment.html_url ?? null,
          points_possible: assignment.points_possible ?? null,
          status: "active",
          raw: assignment,
        });
      }
    }

    const existingActive = await getActiveAssignments();
    await upsertAssignments(assignmentRows);

    const nextKeys = new Set(assignmentRows.map((row) => stableKey(row)));
    const nowDeleted = existingActive.filter((oldRow) => !nextKeys.has(stableKey(oldRow)));

    await markAssignmentsDeleted(nowDeleted.map((row) => row.id));
    const refreshedActive = await getActiveAssignments();

    let upsertedCount = 0;

    for (const assignment of refreshedActive) {
      const link = await getTaskLinkByAssignmentId(assignment.id);
      const payload = toTaskPayload(assignment);

      if (!link) {
        const created = await createTask(googleAccessToken, taskListId, payload);
        await upsertTaskLink({
          assignment_id: assignment.id,
          task_list_id: taskListId,
          google_task_id: created.id,
          etag: created.etag,
        });
        upsertedCount += 1;
        continue;
      }

      const updated = await updateTask(googleAccessToken, link.task_list_id, link.google_task_id, payload);
      await upsertTaskLink({
        assignment_id: assignment.id,
        task_list_id: link.task_list_id,
        google_task_id: link.google_task_id,
        etag: updated.etag,
      });
      upsertedCount += 1;
    }

    await syncDeletedAssignments(nowDeleted, googleAccessToken, settings.deleteMode);

    await finishSyncRun(runId, {
      status: "success",
      fetched_count: assignmentRows.length,
      upserted_count: upsertedCount,
      deleted_count: nowDeleted.length,
    });

    return {
      fetchedCount: assignmentRows.length,
      upsertedCount,
      deletedCount: nowDeleted.length,
    };
  } catch (error) {
    await finishSyncRun(runId, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    isSyncRunning = false;
  }
}
