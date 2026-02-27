import { NextResponse } from "next/server";
import { adminToken, fetchBackend } from "../../../lib/backend";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    const data = await fetchBackend<Record<string, unknown>>("/api/sync/run", {
      method: "POST",
      headers: {
        "x-admin-token": adminToken(),
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
