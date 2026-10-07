"use client";

import { useState } from "react";

const STEPS = [
  { key: "step1", label: "Read the employee handbook" },
  { key: "step2", label: "Set up your development environment" },
  { key: "step3", label: "Meet your team" },
  { key: "step4", label: "Complete your first task" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];
type Progress = Record<StepKey, boolean>;

export default function Checklist({ initial }: { initial: Progress }) {
  const [progress, setProgress] = useState<Progress>(initial);

  async function toggle(step: StepKey, checked: boolean) {
    setProgress((p) => ({ ...p, [step]: checked }));
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, checked }),
    });
  }

  const done = STEPS.filter((s) => progress[s.key]).length;

  return (
    <div>
      <p className="mb-4 text-gray-600" data-testid="onboarding-summary">
        {done}/{STEPS.length} steps completed
      </p>
      <ul className="flex flex-col gap-3">
        {STEPS.map((step) => (
          <li key={step.key} className="rounded border px-4 py-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                data-testid={`checkbox-${step.key}`}
                checked={progress[step.key]}
                onChange={(e) => toggle(step.key, e.target.checked)}
              />
              <span>{step.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
