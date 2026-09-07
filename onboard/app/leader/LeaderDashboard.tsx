"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Progress = { step1: boolean; step2: boolean; step3: boolean } | null;
type Member = {
  id: number;
  email: string;
  displayName: string | null;
  progress: Progress;
};
type Invitation = { id: number; email: string; used: boolean };

function progressLabel(p: Progress): string {
  if (!p) return "0/3";
  return `${[p.step1, p.step2, p.step3].filter(Boolean).length}/3`;
}

export default function LeaderDashboard({
  initialMembers,
  invitations,
}: {
  initialMembers: Member[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  // Live progress updates over SSE.
  useEffect(() => {
    const source = new EventSource("/api/leader/stream");
    source.onmessage = (event) => {
      setMembers(JSON.parse(event.data));
    };
    return () => source.close();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSent("");
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setSent(`Invitation sent to ${email}`);
      setEmail("");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to send invitation");
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Invite a member</h2>
      <form onSubmit={invite} className="mb-2 flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          type="submit"
        >
          Invite
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {sent && <p className="mb-4 text-sm text-green-700">{sent}</p>}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Invitations</h2>
      {invitations.length === 0 ? (
        <p className="text-gray-500">No invitations yet.</p>
      ) : (
        <ul className="divide-y rounded border" data-testid="invitation-list">
          {invitations.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span>{inv.email}</span>
              <span className="text-sm text-gray-500">
                {inv.used ? "Accepted" : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Member progress</h2>
      {members.length === 0 ? (
        <p className="text-gray-500">No members yet.</p>
      ) : (
        <ul className="divide-y rounded border" data-testid="member-list">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between px-4 py-3"
              data-testid={`member-${member.email}`}
            >
              {/* The testids stay keyed on the email — it is the stable
                  identifier — while the label falls back to it only when the
                  member has not set a display name. */}
              <span>{member.displayName ?? member.email}</span>
              <span
                className="font-mono text-sm"
                data-testid={`progress-${member.email}`}
              >
                {progressLabel(member.progress)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
