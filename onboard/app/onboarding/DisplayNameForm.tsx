"use client";

import { useState } from "react";

export default function DisplayNameForm({
  email,
  initialDisplayName,
}: {
  email: string;
  initialDisplayName: string | null;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [saved, setSaved] = useState<string | null>(initialDisplayName);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    if (res.ok) {
      setSaved(data.displayName);
    } else {
      setError(data.error ?? "Failed to save display name");
    }
  }

  return (
    <div className="mb-8">
      <p className="mb-3 text-gray-600">
        Signed in as{" "}
        <span className="font-medium text-gray-900" data-testid="member-name">
          {saved ?? email}
        </span>
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          type="submit"
        >
          Save name
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
