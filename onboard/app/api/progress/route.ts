import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

const STEPS = ["step1", "step2", "step3", "step4"] as const;

export async function POST(req: Request) {
  const user = await currentUser();
  if (user?.role !== "MEMBER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { step, checked } = await req.json();
  if (!STEPS.includes(step)) {
    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  }
  const progress = await prisma.onboardingProgress.update({
    where: { userId: user.id },
    data: { [step]: Boolean(checked) },
  });
  return NextResponse.json({ progress });
}
