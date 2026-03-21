/**
 * SSE proxy route — streams chat room events from the backend through
 * the Next.js server so EventSource works on the same origin.
 *
 * This avoids cross-origin issues and Next.js rewrite buffering that
 * can silently break SSE delivery in Docker dev environments.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — SSE is long-lived

const API_URL = process.env.API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const after = request.nextUrl.searchParams.get("after");
  const qs = after ? `?after=${encodeURIComponent(after)}` : "";

  const upstream = await fetch(
    `${API_URL}/api/chat/rooms/${roomId}/events${qs}`,
    { cache: "no-store" },
  );

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(null, { status: upstream.status || 502 });
  }

  // Pipe the backend SSE stream straight through to the client
  return new Response(upstream.body as ReadableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "X-SSE-Proxy": "route-handler",
    },
  });
}
