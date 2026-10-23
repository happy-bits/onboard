"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LeaderAdmin({
  leaders,
}: {
  leaders: { id: number; email: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function createLeader(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/leaders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      setEmail("");
      setPassword("");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create leader");
    }
  }

  async function removeLeader(id: number) {
    await fetch(`/api/leaders/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function removeAllLeaders() {
    if (!confirm("Remove ALL leaders and their teams? This cannot be undone.")) return;
    await fetch("/api/leaders", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Create leader</h2>
      <form onSubmit={createLeader} className="mb-8 flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="flex-1 rounded border px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          type="submit"
        >
          Create
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Leaders</h2>
        {leaders.length > 0 && (
          <button
            className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
            onClick={removeAllLeaders}
          >
            Remove all leaders
          </button>
        )}
      </div>
      {leaders.length === 0 ? (
        <p className="text-gray-500">No leaders yet.</p>
      ) : (
        <ul className="divide-y rounded border" data-testid="leader-list">
          {leaders.map((leader) => (
            <li
              key={leader.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span>{leader.email}</span>
              <button
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                onClick={() => removeLeader(leader.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
