"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Pill,
  PlusCircle,
  Archive,
  RotateCcw,
  Edit,
  Package,
  AlertTriangle,
  Clock,
  Check,
  RefreshCw,
  Plus,
} from "lucide-react";
import { formatTime12h } from "@/lib/dateUtils";

const WEEKDAYS = [
  { id: 0, label: "Sun" },
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
];

export default function MedicationsListPage() {
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refillModalMed, setRefillModalMed] = useState<any | null>(null);
  const [refillAmount, setRefillAmount] = useState<string>("30");
  const [refillError, setRefillError] = useState<string | null>(null);
  const [archiveConfirmMed, setArchiveConfirmMed] = useState<any | null>(null);

  const fetchMedications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/medications?archived=${activeTab === "archived"}`
      );
      const json = await res.json();
      if (json.success) {
        setMedications(json.medications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  const handleRefillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refillModalMed) return;
    setRefillError(null);

    const qty = parseInt(refillAmount, 10);
    if (isNaN(qty) || qty <= 0) {
      setRefillError("Please enter a valid positive number of doses.");
      return;
    }

    try {
      const res = await fetch(`/api/medications/${refillModalMed.id}/refill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      const data = await res.json();
      if (!data.success) {
        setRefillError(data.error || "Refill failed");
      } else {
        setRefillModalMed(null);
        fetchMedications();
      }
    } catch (err: any) {
      setRefillError(err.message || "Failed to refill");
    }
  };

  const handleArchiveToggle = async (med: any, shouldArchive: boolean) => {
    try {
      const res = await fetch(`/api/medications/${med.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: shouldArchive ? "archive" : "unarchive" }),
      });
      const data = await res.json();
      if (data.success) {
        setArchiveConfirmMed(null);
        fetchMedications();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatScheduleSummary = (med: any) => {
    let times: string[] = [];
    try {
      times = JSON.parse(med.reminderTimes);
    } catch {}

    const formattedTimes = times.map(formatTime12h).join(", ");

    if (med.scheduleType === "DAILY") {
      return `Every day at ${formattedTimes}`;
    }

    // Specific weekdays
    const daysArr = (med.daysOfWeek || "")
      .split(",")
      .map((d: string) => parseInt(d.trim(), 10))
      .filter((n: number) => !isNaN(n));

    const dayLabels = daysArr
      .map((id: number) => WEEKDAYS.find((w) => w.id === id)?.label)
      .filter(Boolean)
      .join(", ");

    return `${dayLabels || "Selected days"} at ${formattedTimes}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
            Medication List
          </h1>
          <p className="text-slate-600 text-base mt-1">
            Manage your prescriptions, reminder times, and dose inventory.
          </p>
        </div>

        <Link
          href="/medications/new"
          className="flex items-center space-x-2 px-5 py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-sky-400 self-start sm:self-auto"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Add New Medication</span>
        </Link>
      </div>

      {/* Tabs: Active vs Archived */}
      <div className="flex border-b-2 border-slate-200 space-x-4">
        <button
          onClick={() => setActiveTab("active")}
          className={`py-3 px-4 font-black text-lg border-b-4 transition-all focus:outline-none ${
            activeTab === "active"
              ? "border-sky-600 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Active Medications
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          className={`py-3 px-4 font-black text-lg border-b-4 transition-all focus:outline-none ${
            activeTab === "archived"
              ? "border-sky-600 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Archived Medications
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      ) : medications.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 sm:p-12 text-center space-y-4">
          <Pill className="w-14 h-14 text-slate-400 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900">
            {activeTab === "active"
              ? "No active medications found"
              : "No archived medications"}
          </h2>
          <p className="text-slate-600 max-w-md mx-auto">
            {activeTab === "active"
              ? "Add your medications to begin tracking doses and receiving daily reminders."
              : "When you archive medications you no longer take, they will safely appear here with their past history preserved."}
          </p>
          {activeTab === "active" && (
            <Link
              href="/medications/new"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl shadow-sm"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Add Medication</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {medications.map((med) => {
            const isLowStock =
              med.stockTracking &&
              med.stock !== null &&
              med.stock <= (med.lowStockThreshold ?? 5);

            return (
              <div
                key={med.id}
                className={`bg-white rounded-2xl p-6 border-2 shadow-sm space-y-4 flex flex-col justify-between ${
                  med.archived
                    ? "border-slate-300 opacity-80"
                    : isLowStock
                    ? "border-amber-400 ring-2 ring-amber-300"
                    : "border-slate-200"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-2xl font-black text-slate-950">
                        {med.name}
                      </h2>
                      <p className="text-base font-bold text-slate-600">
                        Dosage: {med.dosage}
                      </p>
                    </div>

                    {med.isDemo && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-xs font-bold uppercase">
                        Demo
                      </span>
                    )}
                  </div>

                  <div className="text-sm space-y-1 text-slate-700">
                    <p className="flex items-center space-x-1.5 font-bold">
                      <Clock className="w-4 h-4 text-sky-600" />
                      <span>{formatScheduleSummary(med)}</span>
                    </p>

                    {med.instructions && (
                      <p className="text-slate-600 pl-5">
                        • {med.instructions}
                      </p>
                    )}

                    <p className="text-slate-500 pl-5 text-xs">
                      Active from {med.startDate}{" "}
                      {med.endDate ? `until ${med.endDate}` : "(ongoing)"}
                    </p>
                  </div>

                  {/* Stock tracking indicator */}
                  {med.stockTracking && (
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        isLowStock
                          ? "bg-amber-50 border-amber-400 text-amber-950"
                          : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Package className="w-5 h-5 flex-shrink-0 text-slate-600" />
                        <div>
                          <span className="font-bold text-sm block">
                            Remaining Stock: {med.stock ?? 0} doses
                          </span>
                          {isLowStock && (
                            <span className="text-xs font-black text-amber-800 flex items-center space-x-1">
                              <AlertTriangle className="w-3.5 h-3.5 inline" />
                              <span>Low Stock Warning (Threshold: {med.lowStockThreshold})</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setRefillModalMed(med);
                          setRefillAmount("30");
                          setRefillError(null);
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-lg border border-slate-300 shadow-sm flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Refill</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    href={`/medications/${med.id}`}
                    className="text-sky-700 hover:text-sky-900 font-bold text-sm underline"
                  >
                    View Details
                  </Link>

                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/medications/${med.id}/edit`}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-lg flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </Link>

                    {med.archived ? (
                      <button
                        onClick={() => handleArchiveToggle(med, false)}
                        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold text-sm rounded-lg flex items-center space-x-1 border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Unarchive</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setArchiveConfirmMed(med)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-900 font-bold text-sm rounded-lg flex items-center space-x-1 border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      >
                        <Archive className="w-4 h-4" />
                        <span>Archive</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Refill Modal */}
      {refillModalMed && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-slate-200 space-y-4">
            <h3 className="text-2xl font-black text-slate-900">
              Refill {refillModalMed.name}
            </h3>
            <p className="text-slate-600 text-sm">
              Current stock: <strong>{refillModalMed.stock ?? 0} doses</strong>.
              Enter how many scheduled doses you want to add to inventory.
            </p>

            {refillError && (
              <div className="p-3 bg-rose-50 text-rose-900 border border-rose-300 rounded-lg text-sm font-bold">
                {refillError}
              </div>
            )}

            <form onSubmit={handleRefillSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Doses to Add
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={refillAmount}
                  onChange={(e) => setRefillAmount(e.target.value)}
                  className="w-full text-xl font-bold p-3 border-2 border-slate-300 rounded-xl focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRefillModalMed(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl shadow-sm"
                >
                  Add Doses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {archiveConfirmMed && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-slate-200 space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center">
              <Archive className="w-6 h-6" />
            </div>

            <h3 className="text-2xl font-black text-slate-900">
              Archive {archiveConfirmMed.name}?
            </h3>

            <p className="text-slate-700 text-base leading-relaxed">
              Archiving stops all future reminders for this medication.
              <strong className="block mt-2 text-slate-900">
                All past dose records, adherence data, and history will be safely preserved.
              </strong>
            </p>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setArchiveConfirmMed(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={() => handleArchiveToggle(archiveConfirmMed, true)}
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl shadow-sm"
              >
                Yes, Archive Medication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
