import { fetchJson } from "./http.js";

interface TaskList {
  id: string;
  title: string;
}

interface TaskListsResponse {
  items?: TaskList[];
}

interface GoogleTask {
  id: string;
  etag?: string;
}

interface GoogleTasksPage {
  items?: GoogleTask[];
  nextPageToken?: string;
}

function tasksHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function ensureTaskList(accessToken: string, taskListName: string): Promise<string> {
  const lists = await fetchJson<TaskListsResponse>("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
    headers: tasksHeaders(accessToken),
  });

  const existing = lists.items?.find((list) => list.title === taskListName);
  if (existing) {
    return existing.id;
  }

  const created = await fetchJson<TaskList>("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
    method: "POST",
    headers: tasksHeaders(accessToken),
    body: JSON.stringify({ title: taskListName }),
  });

  return created.id;
}

export async function createTask(
  accessToken: string,
  taskListId: string,
  payload: {
    title: string;
    notes?: string;
    due?: string;
  },
): Promise<{ id: string; etag: string | null }> {
  const task = await fetchJson<GoogleTask>(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`,
    {
      method: "POST",
      headers: tasksHeaders(accessToken),
      body: JSON.stringify(payload),
    },
  );

  return { id: task.id, etag: task.etag ?? null };
}

export async function updateTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  payload: {
    title?: string;
    notes?: string;
    due?: string;
    status?: "needsAction" | "completed";
  },
): Promise<{ etag: string | null }> {
  const task = await fetchJson<GoogleTask>(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: tasksHeaders(accessToken),
      body: JSON.stringify(payload),
    },
  );

  return { etag: task.etag ?? null };
}

export async function deleteTask(accessToken: string, taskListId: string, taskId: string): Promise<void> {
  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "DELETE",
      headers: tasksHeaders(accessToken),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to delete Google Task ${taskId}: ${response.status} ${body}`);
  }
}

export async function completeTask(accessToken: string, taskListId: string, taskId: string): Promise<void> {
  await updateTask(accessToken, taskListId, taskId, { status: "completed" });
}

export async function deleteAllTasksInList(accessToken: string, taskListId: string): Promise<void> {
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      showCompleted: "true",
      showHidden: "true",
      maxResults: "100",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const page = await fetchJson<GoogleTasksPage>(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?${params.toString()}`,
      {
        headers: tasksHeaders(accessToken),
      },
    );

    const items = page.items ?? [];
    for (const task of items) {
      await deleteTask(accessToken, taskListId, task.id);
    }

    pageToken = page.nextPageToken;
  } while (pageToken);
}
