"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(data.redirect);
    } else {
      setError(data.error ?? "Failed to create account");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        className="rounded border px-3 py-2"
        type="password"
        placeholder="Choose a password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        className="rounded bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700"
        type="submit"
      >
        Create account
      </button>
    </form>
  );
}
