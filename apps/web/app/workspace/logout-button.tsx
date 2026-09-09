"use client";

import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    } finally {
      router.push("/auth?mode=sign-in");
      router.refresh();
    }
  }

  return <button disabled={pending} onClick={logout} type="button"><SignOut aria-hidden size={18} />{pending ? "Çıkış yapılıyor…" : "Çıkış yap"}</button>;
}
