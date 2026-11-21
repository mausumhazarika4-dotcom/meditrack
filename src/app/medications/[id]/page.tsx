"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Archive,
  RotateCcw,
  Package,
  Clock,
  Plus,
  RefreshCw,
} from "lucide-react";
import { formatTime12h } from "@/lib/dateUtils";

export default function MedicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [med, setMed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refillQty, setRefillQty] = useState("30");
  const [refillLoading, setRefillLoading] = useState(false);

  const fetchMed = () => {
    fetch(`/api/medications/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setMed(json.medication);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMed();
  }, [id]);

  const handleRefill = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(refillQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    setRefillLoading(true);
    try {
      const res = await fetch(`/api/medications/${id}/refill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      const data = await res.json();
      if (data.success) {
        fetchMed();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefillLoading(false);
    }
  };

  const handleArchiveToggle = async (shouldArchive: boolean) => {
    try {
      const res = await fetch(`/api/medications/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: shouldArchive ? "archive" : "unarchive" }),
      });
      const data = await res.json();
      if (data.success) {
        fetchMed();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!med) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-800">
          Medication not found
        </h2>
      </div>
    );
  }

  let reminderTimes: string[] = [];
  try {
    reminderTimes = JSON.parse(med.reminderTimes);
  } catch {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/medications"
        className="inline-flex items-center space-x-1 text-sm font-bold text-sky-700 hover:text-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Medication List</span>
      </Link>

      {/* Main card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900">{med.name}</h1>
              {med.archived && (
                <span className="bg-slate-200 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-full uppercase">
                  Archived
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-slate-600 mt-1">
              Dosage: {med.dosage}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href={`/medications/${med.id}/edit`}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center space-x-1.5"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Link>

            {med.archived ? (
              <button
                onClick={() => handleArchiveToggle(false)}
                className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold rounded-xl flex items-center space-x-1.5 border border-emerald-300"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Unarchive</span>
              </button>
            ) : (
              <button
                onClick={() => handleArchiveToggle(true)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-900 font-bold rounded-xl flex items-center space-x-1.5 border border-rose-300"
              >
                <Archive className="w-4 h-4" />
                <span>Archive</span>
              </button>
            )}
          </div>
        </div>

        {/* Schedule & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
              Schedule & Reminders
            </h3>
            <p className="font-bold text-base text-slate-900">
              Type: {med.scheduleType === "DAILY" ? "Every Day" : "Selected Days"}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {reminderTimes.map((t) => (
                <span
                  key={t}
                  className="bg-white px-3 py-1 rounded-lg border border-slate-300 font-bold text-sm text-slate-800 shadow-sm"
                >
                  {formatTime12h(t)}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 pt-1">
              Active: {med.startDate}{" "}
              {med.endDate ? `to ${med.endDate}` : "(Ongoing)"}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
              Instructions & Notes
            </h3>
            <p className="font-medium text-base text-slate-800">
              {med.instructions || "No special instructions recorded."}
            </p>
          </div>
        </div>

        {/* Stock management */}
        {med.stockTracking && (
          <div className="p-5 bg-sky-50 rounded-xl border-2 border-sky-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider block">
                  Inventory & Stock
                </span>
                <span className="text-2xl font-black text-sky-950">
                  {med.stock ?? 0} doses remaining
                </span>
                <span className="text-xs text-slate-600 block">
                  Low-stock alert triggers at {med.lowStockThreshold ?? 5} doses or fewer
                </span>
              </div>
            </div>

            <form
              onSubmit={handleRefill}
              className="flex items-center space-x-2 pt-2 border-t border-sky-200"
            >
              <label htmlFor="refill-input" className="text-sm font-bold text-slate-800">
                Quick Refill:
              </label>
              <input
                id="refill-input"
                type="number"
                min="1"
                step="1"
                value={refillQty}
                onChange={(e) => setRefillQty(e.target.value)}
                className="w-24 p-2 font-bold text-base border-2 border-slate-300 rounded-lg focus:border-sky-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={refillLoading}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg text-sm shadow-sm flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add Stock</span>
              </button>
            </form>
          </div>
        )}

        {/* Recent doses list */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            Recent Dose History
          </h2>
          {med.doses?.length === 0 ? (
            <p className="text-slate-500 text-sm">No doses recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
              {med.doses?.map((dose: any) => (
                <div
                  key={dose.id}
                  className="p-3.5 bg-white flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {dose.scheduledDate} at {formatTime12h(dose.reminderTime)}
                    </span>
                    {dose.takenAt && (
                      <span className="text-xs text-emerald-700 block">
                        Taken at: {new Date(dose.takenAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-black text-xs px-2.5 py-1 rounded-full border ${
                      dose.status === "TAKEN"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : dose.status === "SKIPPED"
                        ? "bg-slate-100 text-slate-800 border-slate-300"
                        : "bg-amber-100 text-amber-900 border-amber-300"
                    }`}
                  >
                    {dose.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
