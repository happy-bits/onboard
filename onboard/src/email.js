// Fake email service. Writes each message to var/mail/outbox.json (append-only,
// newest last) instead of sending anything. Replace with a real transport later
// by swapping the body of `sendEmail`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAIL_DIR = path.join(ROOT, 'var', 'mail');
export const OUTBOX = path.join(MAIL_DIR, 'outbox.json');

function readOutbox() {
  try {
    return JSON.parse(fs.readFileSync(OUTBOX, 'utf8'));
  } catch {
    return [];
  }
}

export function sendEmail({ to, subject, text }) {
  fs.mkdirSync(MAIL_DIR, { recursive: true });
  const messages = readOutbox();
  messages.push({ to, subject, text });
  fs.writeFileSync(OUTBOX, `${JSON.stringify(messages, null, 2)}\n`);
  return messages.at(-1);
}

export function listEmails() {
  return readOutbox();
}

export function clearEmails() {
  fs.mkdirSync(MAIL_DIR, { recursive: true });
  fs.writeFileSync(OUTBOX, '[]\n');
}
