import express from "express";
import { canvasOAuthEnabled, config, canvasRedirectUri, googleRedirectUri } from "./config.js";
import { exchangeCanvasCode, exchangeGoogleCode } from "./oauth.js";
import { getLatestSyncRun, listAssignments, saveSettings } from "./repositories.js";
import { runSync } from "./sync.js";

const app = express();
app.use(express.json());

function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>,
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireAdminToken(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!config.adminToken) {
    next();
    return;
  }

  const token = req.header("x-admin-token");
  if (token !== config.adminToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

function oauthState(provider: "canvas" | "google"): string {
  return `${provider}:${Date.now()}`;
}

app.get("/api/health", asyncHandler(async (_req, res) => {
  const latest = await getLatestSyncRun();
  res.json({ ok: true, latestSyncRun: latest });
}));

app.get("/api/auth/canvas/start", (_req, res) => {
  if (!canvasOAuthEnabled) {
    res.status(400).json({
      error:
        "Canvas OAuth is not configured. Set CANVAS_ACCESS_TOKEN for personal token mode or set CANVAS_CLIENT_ID/CANVAS_CLIENT_SECRET.",
    });
    return;
  }

  const params = new URLSearchParams({
    client_id: config.canvasClientId!,
    response_type: "code",
    redirect_uri: canvasRedirectUri(),
    state: oauthState("canvas"),
  });

  const url = `${config.canvasBaseUrl}/login/oauth2/auth?${params.toString()}`;
  res.redirect(url);
});

app.get("/api/auth/canvas/callback", asyncHandler(async (req, res) => {
  if (!canvasOAuthEnabled) {
    res.status(400).json({
      error:
        "Canvas OAuth callback is disabled because client credentials are not configured. Use CANVAS_ACCESS_TOKEN mode.",
    });
    return;
  }

  const code = req.query.code;
  if (typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  await exchangeCanvasCode(code, canvasRedirectUri());
  res.json({ ok: true, provider: "canvas" });
}));

app.get("/api/auth/google/start", (_req, res) => {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    redirect_uri: googleRedirectUri(),
    scope: "https://www.googleapis.com/auth/tasks",
    state: oauthState("google"),
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(url);
});

app.get("/api/auth/google/callback", asyncHandler(async (req, res) => {
  const code = req.query.code;
  if (typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  await exchangeGoogleCode(code, googleRedirectUri());
  res.json({ ok: true, provider: "google" });
}));

app.post("/api/sync/run", requireAdminToken, asyncHandler(async (_req, res) => {
  const result = await runSync();
  res.json({ ok: true, ...result });
}));

app.get("/api/sync/status", asyncHandler(async (_req, res) => {
  const latest = await getLatestSyncRun();
  res.json({ ok: true, latest });
}));

app.get("/api/assignments", asyncHandler(async (req, res) => {
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const status = req.query.status === "deleted" || req.query.status === "active" ? req.query.status : undefined;

  const assignments = await listAssignments({ courseId, from, to, status });
  res.json({ ok: true, assignments });
}));

app.patch("/api/config", requireAdminToken, asyncHandler(async (req, res) => {
  const body = req.body as {
    taskListName?: string;
    deleteMode?: "delete" | "complete";
    includedCourseIds?: string[];
    hidePastDue?: boolean;
  };

  const settings = await saveSettings({
    taskListName: body.taskListName,
    deleteMode: body.deleteMode,
    includedCourseIds: Array.isArray(body.includedCourseIds)
      ? body.includedCourseIds.map(String)
      : undefined,
    hidePastDue: typeof body.hidePastDue === "boolean" ? body.hidePastDue : undefined,
  });

  res.json({ ok: true, settings });
}));

app.post("/api/tasks/reconcile", requireAdminToken, asyncHandler(async (_req, res) => {
  const result = await runSync({ forceRebuildLinks: true });
  res.json({ ok: true, ...result });
}));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Listening on port ${config.port}`);

  if (!config.internalSchedulerEnabled) {
    console.log("Internal scheduler disabled.");
    return;
  }

  const intervalMs = config.syncIntervalMinutes * 60_000;
  setInterval(() => {
    runSync().catch((error) => {
      console.error("Scheduled sync failed", error);
    });
  }, intervalMs);
});
