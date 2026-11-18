import { NextResponse } from "next/server";
import { redactSensitiveText } from "@fineprint/shared";
import { getMailboxStore } from "@fineprint/mcp-mailbox";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  const messages = await getMailboxStore().listEmails(query);
  return NextResponse.json({
    query,
    messages: messages.map((m) => ({
      id: m.id,
      from: redactSensitiveText(m.from).text,
      subject: redactSensitiveText(m.subject).text,
      received_at: m.received_at,
      snippet: redactSensitiveText(m.snippet).text,
      labels: m.labels,
      attachment_count: m.attachments.length,
    })),
  });
}
