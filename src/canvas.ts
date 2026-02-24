import { config } from "./config.js";
import type { CanvasAssignment, CanvasCourse } from "./types.js";

interface PaginatedResponse<T> {
  data: T[];
  nextUrl: string | null;
}

async function fetchCanvasPage<T>(url: string, accessToken: string): Promise<PaginatedResponse<T>> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Canvas API failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as T[];
  const linkHeader = response.headers.get("link") ?? "";
  const nextMatch = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'));

  let nextUrl: string | null = null;
  if (nextMatch) {
    const urlMatch = nextMatch.match(/<([^>]+)>/);
    if (urlMatch) {
      nextUrl = urlMatch[1];
    }
  }

  return { data, nextUrl };
}

async function fetchCanvasPaginated<T>(initialUrl: string, accessToken: string): Promise<T[]> {
  let url: string | null = initialUrl;
  const result: T[] = [];

  while (url) {
    const page: PaginatedResponse<T> = await fetchCanvasPage<T>(url, accessToken);
    result.push(...page.data);
    url = page.nextUrl;
  }

  return result;
}

export async function fetchCanvasCourses(accessToken: string): Promise<CanvasCourse[]> {
  const url = `${config.canvasBaseUrl}/api/v1/courses?enrollment_state=active&per_page=100`;
  const courses = await fetchCanvasPaginated<CanvasCourse>(url, accessToken);
  return courses.filter((course) => Boolean(course?.id));
}

export async function fetchCanvasAssignmentsForCourse(
  accessToken: string,
  courseId: string,
): Promise<CanvasAssignment[]> {
  const url = `${config.canvasBaseUrl}/api/v1/courses/${courseId}/assignments?per_page=100`;
  const assignments = await fetchCanvasPaginated<CanvasAssignment>(url, accessToken);
  return assignments.filter((assignment) => Boolean(assignment?.id));
}
