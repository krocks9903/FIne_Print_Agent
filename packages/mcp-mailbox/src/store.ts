import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CalendarEvent, EmailMessage } from "@fineprint/shared";
import {
  DEMO_CALENDAR,
  DEMO_INBOX,
  MAILBOX_FIXTURES_VERSION,
} from "./fixtures.js";

interface MailboxDb {
  fixtures_version: number;
  emails: EmailMessage[];
  calendar: CalendarEvent[];
}

function emptyDb(): MailboxDb {
  return {
    fixtures_version: MAILBOX_FIXTURES_VERSION,
    emails: structuredClone(DEMO_INBOX),
    calendar: structuredClone(DEMO_CALENDAR),
  };
}

export class MailboxStore {
  private dbPath: string;

  constructor(root = path.join(process.cwd(), "data", "mailbox")) {
    this.dbPath = path.join(root, "mailbox.json");
  }

  private async ensure(): Promise<MailboxDb> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    try {
      const raw = await readFile(this.dbPath, "utf8");
      const db = JSON.parse(raw) as MailboxDb;
      if (db.fixtures_version !== MAILBOX_FIXTURES_VERSION) {
        const fresh = emptyDb();
        await this.save(fresh);
        return fresh;
      }
      if (!Array.isArray(db.emails) || !Array.isArray(db.calendar)) {
        const fresh = emptyDb();
        await this.save(fresh);
        return fresh;
      }
      return db;
    } catch {
      const fresh = emptyDb();
      await this.save(fresh);
      return fresh;
    }
  }

  private async save(db: MailboxDb): Promise<void> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    db.fixtures_version = MAILBOX_FIXTURES_VERSION;
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), "utf8");
  }

  async listEmails(query = ""): Promise<EmailMessage[]> {
    const db = await this.ensure();
    const q = query.trim().toLowerCase();
    if (!q) {
      return db.emails.filter((m) => !m.labels.includes("noise"));
    }
    return db.emails.filter((m) => {
      const hay = `${m.subject} ${m.snippet} ${m.body_text} ${m.from} ${m.labels.join(" ")}`.toLowerCase();
      const tokens = q.split(/\s+or\s+|[\s]+/i).filter(Boolean);
      return tokens.some((t) => hay.includes(t.replace(/[()]/g, "")));
    });
  }

  async getEmail(id: string): Promise<EmailMessage | null> {
    const db = await this.ensure();
    return db.emails.find((m) => m.id === id) ?? null;
  }

  async listCalendar(): Promise<CalendarEvent[]> {
    const db = await this.ensure();
    return [...db.calendar].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  async proposeCalendarEvent(
    input: Omit<CalendarEvent, "id"> & { id?: string }
  ): Promise<CalendarEvent> {
    const db = await this.ensure();
    const event: CalendarEvent = {
      ...input,
      id: input.id ?? randomUUID(),
    };
    const dup = db.calendar.findIndex(
      (e) =>
        e.id === event.id ||
        (e.starts_at === event.starts_at &&
          e.title === event.title &&
          (event.related_scan_id
            ? e.related_scan_id === event.related_scan_id
            : event.related_email_id
              ? e.related_email_id === event.related_email_id
              : false))
    );
    if (dup >= 0) {
      db.calendar[dup] = { ...event, id: db.calendar[dup].id };
      await this.save(db);
      return db.calendar[dup];
    }
    db.calendar.push(event);
    await this.save(db);
    return event;
  }

  async addEmail(
    input: Omit<EmailMessage, "id"> & { id?: string }
  ): Promise<EmailMessage> {
    const db = await this.ensure();
    const email: EmailMessage = {
      ...input,
      id: input.id ?? randomUUID(),
    };
    const existing = db.emails.findIndex((m) => m.id === email.id);
    if (existing >= 0) {
      db.emails[existing] = email;
    } else {
      const remDup = db.emails.findIndex(
        (m) =>
          m.labels.includes("reminder") &&
          m.subject === email.subject &&
          m.thread_id === email.thread_id
      );
      if (remDup >= 0) {
        db.emails[remDup] = { ...email, id: db.emails[remDup].id };
        await this.save(db);
        return db.emails[remDup];
      }
      db.emails.push(email);
    }
    await this.save(db);
    return email;
  }

  async listReminders(): Promise<EmailMessage[]> {
    const db = await this.ensure();
    return db.emails
      .filter((m) => m.labels.includes("reminder"))
      .sort((a, b) => b.received_at.localeCompare(a.received_at));
  }
}

let singleton: MailboxStore | null = null;

export function getMailboxStore(): MailboxStore {
  if (!singleton) {
    const root = process.env.FINEPRINT_MAILBOX_DIR
      ? process.env.FINEPRINT_MAILBOX_DIR
      : path.join(process.cwd(), "data", "mailbox");
    singleton = new MailboxStore(root);
  }
  return singleton;
}

export function resetMailboxStoreForTests(root: string): MailboxStore {
  singleton = new MailboxStore(root);
  return singleton;
}
