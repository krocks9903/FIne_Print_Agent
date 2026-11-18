import { NextResponse } from "next/server";
import { redactSensitiveText } from "@fineprint/shared";
import { getMailboxStore } from "@fineprint/mcp-mailbox";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const message = await getMailboxStore().getEmail(id);
  if (!message) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...message,
    from: redactSensitiveText(message.from).text,
    to: message.to.map((t) => redactSensitiveText(t).text),
    subject: redactSensitiveText(message.subject).text,
    snippet: redactSensitiveText(message.snippet).text,
    body_text: redactSensitiveText(message.body_text).text,
  });
}
