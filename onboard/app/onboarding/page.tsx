import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import Checklist from "./Checklist";
import DisplayNameForm from "./DisplayNameForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "MEMBER") redirect("/");

  const progress = await prisma.onboardingProgress.findUnique({
    where: { userId: user.id },
  });

  return (
    <main className="mx-auto mt-12 max-w-lg p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your onboarding</h1>
        <LogoutButton />
      </div>
      <DisplayNameForm
        email={user.email}
        initialDisplayName={user.displayName}
      />
      <Checklist
        initial={{
          step1: progress?.step1 ?? false,
          step2: progress?.step2 ?? false,
          step3: progress?.step3 ?? false,
        }}
      />
    </main>
  );
}
