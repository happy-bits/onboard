export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://onboard:onboard@localhost:55432/onboard',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-change-me',
  // The fake mailbox UI/API is only exposed outside production.
  enableDevMailbox: process.env.NODE_ENV !== 'production',
};
