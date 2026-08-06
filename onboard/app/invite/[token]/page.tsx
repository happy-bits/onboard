import { prisma } from "@/lib/db";
import { now } from "@/lib/clock";
import AcceptInvitation from "./AcceptInvitation";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invitation || invitation.usedAt || invitation.expiresAt < now()) {
    return (
      <main className="mx-auto mt-24 max-w-sm p-6">
        <h1 className="mb-4 text-2xl font-bold">Invitation not valid</h1>
        <p className="text-gray-600">
          This invitation link is invalid, has expired, or has already been
          used.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-2 text-2xl font-bold">Join {invitation.team.name}</h1>
      <p className="mb-6 text-gray-600">
        Create an account for <strong>{invitation.email}</strong> to join the
        team.
      </p>
      <AcceptInvitation token={token} />
    </main>
  );
}
