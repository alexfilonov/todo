import "./config.js";
import { runSync } from "./sync.js";

async function main(): Promise<void> {
  const result = await runSync();
  console.log(JSON.stringify({ ok: true, ...result }));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
