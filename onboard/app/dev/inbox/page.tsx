import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Dev inbox for the fake email service: shows every "sent" email.

export default async function InboxPage() {
  const emails = await prisma.email.findMany({ orderBy: { id: "desc" } });

  return (
    <main className="mx-auto mt-12 max-w-2xl p-6">
      <h1 className="mb-8 text-2xl font-bold">Dev inbox</h1>
      {emails.length === 0 ? (
        <p className="text-gray-500">No emails sent yet.</p>
      ) : (
        <ul className="flex flex-col gap-4" data-testid="email-list">
          {emails.map((email) => (
            <li
              key={email.id}
              className="rounded border p-4"
              data-testid={`email-${email.id}`}
            >
              <p className="text-sm text-gray-500">
                To: <span data-testid="email-to">{email.to}</span> ·{" "}
                {email.sentAt.toISOString()}
              </p>
              <p className="font-semibold">{email.subject}</p>
              <p className="mt-2 text-sm whitespace-pre-wrap" data-testid="email-body">
                {email.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
