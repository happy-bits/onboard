"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
      }}
    >
      Log out
    </button>
  );
}
