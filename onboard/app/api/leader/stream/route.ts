import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// SSE stream of the leader's team progress. Polls the database and pushes
// a snapshot whenever it changes.

export async function GET() {
  const user = await currentUser();
  if (user?.role !== "LEADER") {
    return new Response("Forbidden", { status: 403 });
  }
  const team = await prisma.team.findUnique({ where: { leaderId: user.id } });
  if (!team) {
    return new Response("No team", { status: 400 });
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval>;
  let lastPayload = "";

  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        try {
          const members = await prisma.user.findMany({
            where: { teamId: team.id, role: "MEMBER" },
            orderBy: { id: "asc" },
            select: { id: true, email: true, progress: true },
          });
          const payload = JSON.stringify(members);
          if (payload !== lastPayload) {
            lastPayload = payload;
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }
        } catch {
          clearInterval(timer);
          try {
            controller.close();
          } catch {}
        }
      };
      await push();
      timer = setInterval(push, 300);
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
