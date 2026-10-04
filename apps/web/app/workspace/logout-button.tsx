"use client";

import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "../../components/locale-provider";
import { defineCopy } from "../../lib/i18n";

const copy = defineCopy({
  tr: { signingOut: "Çıkış yapılıyor…", signOut: "Çıkış yap" },
  en: { signingOut: "Signing out…", signOut: "Sign out" },
});

export function LogoutButton() {
  const router = useRouter();
  const t = copy[useLocale()];
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

  return <button disabled={pending} onClick={logout} type="button"><SignOut aria-hidden size={18} />{pending ? t.signingOut : t.signOut}</button>;
}
