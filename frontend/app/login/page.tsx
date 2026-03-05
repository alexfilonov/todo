export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const failed = params.error === "1";

  return (
    <main className="grid" style={{ gap: 16, maxWidth: 460, paddingTop: 80 }}>
      <div className="card grid" style={{ gap: 10 }}>
        <h1>Sign in</h1>
        <p className="muted">Enter your dashboard password.</p>
        {failed ? (
          <p className="small" style={{ color: "#b42318" }}>
            Invalid password.
          </p>
        ) : null}

        <form method="POST" action="/api/auth/login" className="grid" style={{ gap: 10 }}>
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              fontSize: "1rem",
            }}
          />
          <button type="submit" className="button">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
