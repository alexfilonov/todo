export type Provider = "canvas" | "google";

export interface OAuthTokenRow {
  provider: Provider;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string | null;
  updated_at: string;
}

export interface AssignmentRecord {
  id: string;
  source: "canvas" | "gradescope_via_canvas";
  source_id: string;
  course_id: string;
  course_name: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  html_url: string | null;
  points_possible: number | null;
  status: "active" | "deleted";
  raw: unknown;
  first_seen_at: string;
  updated_at: string;
}

export interface CanvasCourse {
  id: number;
  name: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string;
  due_at?: string | null;
  html_url?: string;
  points_possible?: number | null;
  submission_types?: string[];
  external_tool_tag_attributes?: {
    url?: string;
  };
}

export interface SyncSettings {
  taskListName: string;
  deleteMode: "delete" | "complete";
  includedCourseIds?: string[];
  hidePastDue?: boolean;
}
