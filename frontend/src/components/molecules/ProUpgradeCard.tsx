"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { Button } from "@/components/atoms/Button";

interface Pricing {
  price_id: string;
  enabled: boolean;
  product_name: string;
}

interface ProUpgradeCardProps {
  totalRows: number;
  onUpgrade: () => void;
  loading?: boolean;
  isPaid?: boolean;
}

export function ProUpgradeCard({ totalRows, onUpgrade, loading, isPaid }: ProUpgradeCardProps) {
  const [pricing, setPricing] = useState<Pricing | null>(null);

  useEffect(() => {
    api.getPricing().then((r) => {
      if (r.success && r.data) setPricing(r.data);
    });
  }, []);

  if (isPaid) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm">✓</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">Pro subscription active</p>
          <p className="text-xs text-green-700">Smart Clean runs on every batch.</p>
        </div>
      </div>
    );
  }

  if (!pricing?.enabled) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
              Pro
            </span>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            {pricing.product_name} — unlimited Smart Clean
          </h3>
          <ul className="mt-2 text-sm text-gray-600 space-y-1">
            <li>• AI-powered cleanup on every batch you upload</li>
            <li>• Extracts apartments, infers country, fixes casing</li>
            <li>• Cancel anytime in the billing portal</li>
            <li>• Will apply to this {totalRows.toLocaleString()}-row batch too</li>
          </ul>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end">
          <Button onClick={onUpgrade} loading={loading} size="sm">
            Upgrade to Pro
          </Button>
        </div>
      </div>
    </div>
  );
}
