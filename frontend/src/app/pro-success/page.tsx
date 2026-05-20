"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { Button } from "@/components/atoms/Button";

/**
 * Post-checkout landing page.
 *
 * Stripe webhooks write the subscription row asynchronously, so we poll
 * /billing/status for up to ~10s until `is_pro` flips true.
 */
export default function ProSuccessPage() {
  const router = useRouter();
  const [state, setState] = useState<"waiting" | "ok" | "timeout">("waiting");

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    async function poll() {
      while (!cancelled && Date.now() - start < 12_000) {
        const r = await api.getSubscriptionStatus();
        if (r.success && r.data?.is_pro) {
          if (!cancelled) setState("ok");
          return;
        }
        await new Promise((res) => setTimeout(res, 1000));
      }
      if (!cancelled) setState("timeout");
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border p-8 text-center">
        {state === "waiting" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <h1 className="mt-6 text-xl font-semibold text-gray-900">Activating Pro…</h1>
            <p className="mt-2 text-sm text-gray-500">
              Stripe is confirming your subscription. This usually takes a few seconds.
            </p>
          </>
        )}
        {state === "ok" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-6 text-xl font-semibold text-gray-900">Welcome to Pro</h1>
            <p className="mt-2 text-sm text-gray-500">
              Smart Clean is enabled on every batch you process from here on.
            </p>
            <Button className="mt-6 w-full" onClick={() => router.push("/")}>
              Continue
            </Button>
          </>
        )}
        {state === "timeout" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="mt-6 text-xl font-semibold text-gray-900">Still activating…</h1>
            <p className="mt-2 text-sm text-gray-500">
              Your payment went through, but it&apos;s taking longer than usual
              for Stripe to confirm. Refresh this page in a minute or continue —
              Pro will turn on once the webhook fires.
            </p>
            <Button variant="secondary" className="mt-6 w-full" onClick={() => router.push("/")}>
              Continue anyway
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
