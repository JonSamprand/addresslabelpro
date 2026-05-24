"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/atoms/Button";

function SignInInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [state, setState] = useState<
    "idle" | "guest-loading" | "sending" | "sent" | "error"
  >("idle");
  const [error, setError] = useState("");

  const continueAsGuest = async () => {
    setState("guest-loading");
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      // Hard reload so the server-side middleware sees the new session cookie
      // and lets us through to the protected page.
      window.location.assign(next);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not start a guest session";
      // Common case: anon sign-ins are disabled in the Supabase project.
      setError(
        msg.toLowerCase().includes("anonymous")
          ? "Guest sign-in isn't enabled on this Supabase project. Enable it under Authentication → Providers → Email → Anonymous Sign-ins."
          : msg,
      );
      setState("error");
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState("sending");
    setError("");
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send link");
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border p-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Sign in to AddressLabelPro
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Try it instantly as a guest. No account needed.
        </p>

        {state === "sent" ? (
          <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="text-sm font-medium text-green-900">Check your email</p>
            <p className="text-xs text-green-700 mt-1">
              We sent a sign-in link to <strong>{email}</strong>. Open it on this
              device to continue.
            </p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="mt-3 text-xs text-green-800 underline"
            >
              Use a different option
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <Button
              type="button"
              onClick={continueAsGuest}
              loading={state === "guest-loading"}
              className="w-full"
            >
              Continue as guest
            </Button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs uppercase tracking-wide text-gray-400">
                or
              </span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            {!emailFormOpen ? (
              <button
                type="button"
                onClick={() => setEmailFormOpen(true)}
                className="w-full text-sm text-blue-700 hover:text-blue-900 underline"
              >
                Sign in with email instead
              </button>
            ) : (
              <form className="space-y-3" onSubmit={sendMagicLink}>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Email</span>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="you@example.com"
                  />
                </label>
                <Button
                  type="submit"
                  loading={state === "sending"}
                  className="w-full"
                  variant="secondary"
                >
                  Send sign-in link
                </Button>
                <p className="text-xs text-gray-500">
                  We&apos;ll email you a one-time sign-in link. No password
                  required.
                </p>
              </form>
            )}

            {error && (
              <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          Guest sessions live in your browser only. Sign in with email to keep
          your jobs across devices.
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
