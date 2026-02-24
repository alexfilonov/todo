import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer env var: ${name}`);
  }
  return parsed;
}

function parseBoolEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean env var: ${name}`);
}

export const config = {
  port: parseIntEnv("PORT", 3000),
  publicBaseUrl: required("PUBLIC_BASE_URL"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  canvasBaseUrl: required("CANVAS_BASE_URL").replace(/\/$/, ""),
  canvasAccessToken: optional("CANVAS_ACCESS_TOKEN"),
  canvasClientId: optional("CANVAS_CLIENT_ID"),
  canvasClientSecret: optional("CANVAS_CLIENT_SECRET"),
  googleClientId: required("GOOGLE_CLIENT_ID"),
  googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
  syncIntervalMinutes: parseIntEnv("SYNC_INTERVAL_MINUTES", 30),
  defaultTaskListName: process.env.TASK_LIST_NAME ?? "Berkeley Deadlines",
  defaultDeleteMode: (process.env.DELETE_MODE === "complete" ? "complete" : "delete") as
    | "delete"
    | "complete",
  defaultHidePastDue: parseBoolEnv("HIDE_PAST_DUE", true),
  internalSchedulerEnabled: parseBoolEnv("INTERNAL_SCHEDULER_ENABLED", true),
  adminToken: process.env.ADMIN_TOKEN ?? "",
};

export const canvasOAuthEnabled = Boolean(config.canvasClientId && config.canvasClientSecret);

export function canvasRedirectUri(): string {
  return `${config.publicBaseUrl}/api/auth/canvas/callback`;
}

export function googleRedirectUri(): string {
  return `${config.publicBaseUrl}/api/auth/google/callback`;
}
