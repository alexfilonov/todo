import { SyncButton } from "./sync-button";
import { fetchBackend } from "../lib/backend";

export const dynamic = "force-dynamic";

type SyncStatus = {
  ok: boolean;
  latest?: {
    status?: string;
    started_at?: string;
    finished_at?: string;
    fetched_count?: number;
    upserted_count?: number;
    deleted_count?: number;
    error?: string | null;
  };
};

type AssignmentsResponse = {
  ok: boolean;
  assignments: Array<{
    id: string;
    course_name: string | null;
    title: string;
    due_at: string | null;
    html_url: string | null;
  }>;
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return "No due date";
  const date = new Date(value);
  return date.toLocaleString();
}

export default async function Page() {
  const [syncStatus, assignments] = await Promise.all([
    fetchBackend<SyncStatus>("/api/sync/status"),
    fetchBackend<AssignmentsResponse>("/api/assignments?status=active"),
  ]);

  const topAssignments = assignments.assignments
    .slice()
    .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"))
    .slice(0, 30);

  return (
    <main className="grid" style={{ gap: 16 }}>
      <div className="card grid" style={{ gap: 10 }}>
        <h1>Caltodo Dashboard</h1>
        <p className="muted">Hosted monitor for Canvas to Google Tasks sync.</p>
      </div>

      <div className="grid cols-2">
        <section className="card grid" style={{ gap: 12 }}>
          <h2>Sync</h2>
          <div className="small muted">
            Latest status: <strong>{syncStatus.latest?.status ?? "unknown"}</strong>
          </div>
          <div className="small muted">Started: {fmtDate(syncStatus.latest?.started_at)}</div>
          <div className="small muted">Finished: {fmtDate(syncStatus.latest?.finished_at)}</div>
          <div className="small muted">
            Counts: fetched={syncStatus.latest?.fetched_count ?? 0}, upserted={syncStatus.latest?.upserted_count ?? 0}, deleted={syncStatus.latest?.deleted_count ?? 0}
          </div>
          {syncStatus.latest?.error ? (
            <div className="small" style={{ color: "#b42318" }}>
              Error: {syncStatus.latest.error}
            </div>
          ) : null}
          <SyncButton />
        </section>

        <section className="card grid" style={{ gap: 8 }}>
          <h2>Assignments</h2>
          <div className="small muted">Active upcoming tasks from backend.</div>
          <div className="small muted">Showing {topAssignments.length} items.</div>
        </section>
      </div>

      <section className="card">
        <div className="list">
          {topAssignments.map((item) => (
            <article key={item.id} className="item grid" style={{ gap: 6 }}>
              <div className="row">
                <strong>{item.title}</strong>
                <span className="small muted">{fmtDate(item.due_at)}</span>
              </div>
              <div className="small muted">{item.course_name ?? "Unknown course"}</div>
              {item.html_url ? (
                <a className="small" href={item.html_url} target="_blank" rel="noreferrer">
                  Open in Canvas
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
