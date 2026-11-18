import { NextRequest, NextResponse } from "next/server";
import { getOrchestrator } from "@fineprint/agent";
import { getOrCreateScanOwner, setScanSessionCookie } from "@/lib/scan-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // The browser's session cookie should never authorize a cross-site upload.
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).origin !== new URL(req.url).origin) {
      return NextResponse.json({ error: "cross-origin request rejected" }, { status: 403 });
    }

    const ownerId = getOrCreateScanOwner(req);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/pdf";
    const orchestrator = getOrchestrator();
    const isAsync = new URL(req.url).searchParams.get("async") === "1";
    const run = isAsync ? orchestrator.startScan : orchestrator.createAndProcess;
    const result = await run.call(orchestrator, {
      ownerId,
      filename: file.name || "document.pdf",
      mime,
      buffer,
    });
    const response = NextResponse.json(result);
    setScanSessionCookie(response, ownerId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
