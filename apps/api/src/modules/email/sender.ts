import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Transactional e-mail boundary (report 45). Only password-reset messages use
 * it today. Choosing and configuring a real provider (and its sender address
 * and domain records) is an owner decision; until then `EMAIL_PROVIDER=none`
 * keeps password reset switched off and its routes unreachable.
 */
export type EmailMessage = { to: string; subject: string; text: string };

export interface EmailSender {
  readonly id: "log";
  send(message: EmailMessage): Promise<void>;
}

export type EmailLog = { info(payload: Record<string, unknown>, message: string): void };

/**
 * Development and test provider (refused in production by the configuration):
 * the message is written to the structured log and, when `outboxFile` is set,
 * appended to that file as one JSON line, where local tooling and the
 * end-to-end tests pick the link up. Nothing leaves the machine.
 */
export function createLogEmailSender(log: EmailLog, outboxFile?: string): EmailSender {
  return {
    id: "log",
    async send(message) {
      log.info({ category: "email", event: "email_logged", to: message.to, subject: message.subject, text: message.text }, "email_logged");
      if (!outboxFile) return;
      await mkdir(dirname(outboxFile), { recursive: true });
      await appendFile(outboxFile, `${JSON.stringify({ ...message, at: new Date().toISOString() })}\n`, { encoding: "utf8", mode: 0o600 });
    },
  };
}
