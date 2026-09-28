/**
 * Fake email service. Keeps sent emails in memory (and logs them) so they can be
 * inspected at /dev/mailbox. Swap for a real provider by implementing `send`.
 */
export class FakeEmailService {
  constructor() {
    this.sent = [];
  }

  async send({ to, subject, text, html }) {
    const email = { id: this.sent.length + 1, to, subject, text, html };
    this.sent.push(email);
    console.log(`[fake-email] to=${to} subject="${subject}"\n${text}`);
    return email;
  }

  clear() {
    this.sent = [];
  }
}
