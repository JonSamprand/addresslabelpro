"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/services/api";

/**
 * Right side of the header: user email, Pro badge / manage billing, sign out.
 * Renders nothing until a user is known, to avoid flashing "sign in" during
 * the middleware redirect dance.
 */
export function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    api.getSubscriptionStatus().then((r) => {
      if (r.success && r.data) setIsPro(Boolean(r.data.is_pro));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const openPortal = async () => {
    setLoadingPortal(true);
    const r = await api.createPortal();
    if (r.success && r.data?.url) window.location.href = r.data.url;
    else setLoadingPortal(false);
  };

  if (!email) return null;

  return (
    <div className="flex items-center gap-3">
      {isPro && (
        <span className="text-xs font-semibold uppercase tracking-wide text-green-800 bg-green-100 px-2 py-0.5 rounded">
          Pro
        </span>
      )}
      <span className="text-sm text-gray-600 hidden sm:inline">{email}</span>
      {isPro && (
        <button
          className="text-sm text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline disabled:opacity-50"
          onClick={openPortal}
          disabled={loadingPortal}
        >
          Manage billing
        </button>
      )}
      <form action="/auth/signout" method="post">
        <button className="text-sm text-gray-600 hover:text-gray-900" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
