"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  X,
  RotateCcw,
  Clock8,
  PlusCircle,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Package,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatTime12h, formatFriendlyDate } from "@/lib/dateUtils";
import { useReminders } from "@/context/ReminderContext";

export default function TodayDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { refreshReminders } = useReminders();

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/today");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err: any) {
      console.error("Failed to load today schedule:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();

    const onFocus = () => {
      fetchSchedule();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchSchedule]);

  const handleDoseAction = async (
    action: "take" | "skip" | "undo" | "snooze",
    doseId: string,
    snoozeMinutes = 10
  ) => {
    setActionInProgress(doseId);
    setActionError(null);
    try {
      const res = await fetch("/api/schedule/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, doseId, snoozeMinutes }),
      });
      const resJson = await res.json();
      if (!resJson.success) {
        setActionError(resJson.error || "Action failed. Please try again.");
      } else {
        await fetchSchedule();
        await refreshReminders();
      }
    } catch (e: any) {
      setActionError(e.message || "Network error. Please try again.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      await fetch("/api/demo/load", { method: "POST" });
      await fetchSchedule();
      await refreshReminders();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600">
        <RefreshCw className="w-10 h-10 animate-spin text-sky-600 mb-4" />
        <p className="text-xl font-bold">Loading today's schedule...</p>
      </div>
    );
  }

  const { todayDateStr, summary, doses = [], timezone } = data || {};

  return (
    <div className="space-y-6">
      {/* Top Header: Date, Timezone & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-sky-700 font-bold text-sm tracking-wide uppercase">
            <Calendar className="w-4 h-4" />
            <span>Today's Schedule</span>
            {timezone && (
              <span className="text-slate-400 font-medium normal-case">
                • Timezone: {timezone}
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-1">
            {formatFriendlyDate(todayDateStr)}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchSchedule();
            }}
            className="flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-300"
            title="Refresh schedule"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/medications/new"
            className="flex items-center space-x-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-sky-400"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Add Medication</span>
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 border-2 border-rose-500 rounded-xl text-rose-900 font-bold flex items-center space-x-2">
          <AlertCircle className="w-6 h-6 flex-shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Scheduled */}
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">
            Total Doses
          </span>
          <span className="text-3xl font-black text-slate-900 mt-2">
            {summary?.total ?? 0}
          </span>
        </div>

        {/* Taken */}
        <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-300 shadow-sm flex flex-col justify-between">
          <span className="text-sm font-bold text-emerald-800 uppercase tracking-wide">
            Taken
          </span>
          <span className="text-3xl font-black text-emerald-900 mt-2">
            {summary?.taken ?? 0}
          </span>
        </div>

        {/* Remaining (Upcoming + Due) */}
        <div className="bg-sky-50 p-4 rounded-2xl border-2 border-sky-300 shadow-sm flex flex-col justify-between">
          <span className="text-sm font-bold text-sky-800 uppercase tracking-wide">
            Remaining
          </span>
          <span className="text-3xl font-black text-sky-900 mt-2">
            {summary?.remaining ?? 0}
          </span>
        </div>

        {/* Missed */}
        <div className="bg-rose-50 p-4 rounded-2xl border-2 border-rose-300 shadow-sm flex flex-col justify-between">
          <span className="text-sm font-bold text-rose-800 uppercase tracking-wide">
            Missed
          </span>
          <span className="text-3xl font-black text-rose-900 mt-2">
            {summary?.missed ?? 0}
          </span>
        </div>

        {/* Skipped */}
        <div className="bg-slate-100 p-4 rounded-2xl border-2 border-slate-300 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            Skipped
          </span>
          <span className="text-3xl font-black text-slate-900 mt-2">
            {summary?.skipped ?? 0}
          </span>
        </div>
      </div>

      {/* Today's Dose List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
          <span>Doses for Today</span>
          <span className="text-sm font-semibold text-slate-500">
            ({doses.length} scheduled)
          </span>
        </h2>

        {doses.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 sm:p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-sky-100 text-sky-700 rounded-2xl mx-auto flex items-center justify-center">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">
              No medications scheduled for today
            </h3>
            <p className="text-slate-600 max-w-md mx-auto text-base">
              Add your daily prescription medications or load demo data to see
              how reminders and tracking work.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                href="/medications/new"
                className="px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-sky-400"
              >
                Add First Medication
              </Link>
              <button
                onClick={handleLoadDemo}
                className="flex items-center space-x-2 px-6 py-3 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded-xl border border-amber-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-300"
              >
                <Sparkles className="w-5 h-5" />
                <span>Load Demo Data</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {doses.map((dose: any) => {
              const isWorking = actionInProgress === dose.id;
              const hasLowStock =
                dose.medication?.stockTracking &&
                dose.medication?.stock !== null &&
                dose.medication?.stock <= (dose.medication?.lowStockThreshold ?? 5);

              return (
                <div
                  key={dose.id}
                  className={`bg-white rounded-2xl p-5 border-2 transition-all shadow-sm ${
                    dose.derivedStatus === "DUE"
                      ? "border-amber-500 ring-2 ring-amber-400"
                      : dose.derivedStatus === "MISSED"
                      ? "border-rose-400 bg-rose-50/20"
                      : dose.derivedStatus === "TAKEN"
                      ? "border-emerald-300 bg-emerald-50/20"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left details */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-2xl font-black text-slate-950">
                          {dose.medNameSnapshot}
                        </span>
                        <span className="text-lg font-bold text-slate-600">
                          — {dose.dosageSnapshot}
                        </span>
                        <StatusBadge
                          status={dose.derivedStatus}
                          isSnoozed={dose.isSnoozed}
                          snoozedUntil={dose.snoozedUntil}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-700">
                        <span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 font-bold text-slate-900">
                          Scheduled: {formatTime12h(dose.reminderTime)}
                        </span>

                        {dose.instructionsSnapshot && (
                          <span className="text-slate-600 bg-sky-50 px-3 py-1 rounded-lg border border-sky-200">
                            Instructions: {dose.instructionsSnapshot}
                          </span>
                        )}

                        {dose.takenAt && (
                          <span className="text-emerald-800 font-bold">
                            Recorded Taken at:{" "}
                            {new Date(dose.takenAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}

                        {dose.medication?.stockTracking && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              hasLowStock
                                ? "bg-rose-100 text-rose-900 border-rose-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>
                              Stock: {dose.medication.stock ?? 0} doses left
                              {hasLowStock ? " (LOW STOCK)" : ""}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                      {/* Mark as Taken */}
                      {dose.canTake && (
                        <button
                          disabled={isWorking}
                          onClick={() => handleDoseAction("take", dose.id)}
                          className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black text-base rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-400"
                        >
                          <Check className="w-5 h-5" />
                          <span>Mark as Taken</span>
                        </button>
                      )}

                      {/* Snooze 10m (available when due and not snoozed) */}
                      {dose.canSnooze && (
                        <button
                          disabled={isWorking}
                          onClick={() => handleDoseAction("snooze", dose.id, 10)}
                          className="flex items-center space-x-1.5 px-4 py-2.5 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-950 font-bold text-base rounded-xl border border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-300"
                          title="Remind me again in 10 minutes"
                        >
                          <Clock8 className="w-5 h-5" />
                          <span>Snooze 10m</span>
                        </button>
                      )}

                      {/* Skip */}
                      {dose.canSkip && (
                        <button
                          disabled={isWorking}
                          onClick={() => handleDoseAction("skip", dose.id)}
                          className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold text-base rounded-xl border border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-300"
                        >
                          <X className="w-5 h-5" />
                          <span>Skip</span>
                        </button>
                      )}

                      {/* Undo (for Taken or Skipped) */}
                      {dose.canUndo && (
                        <button
                          disabled={isWorking}
                          onClick={() => handleDoseAction("undo", dose.id)}
                          className="flex items-center space-x-1.5 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 text-sky-900 font-bold text-base rounded-xl border border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-300"
                          title="Undo action and return status to scheduled"
                        >
                          <RotateCcw className="w-5 h-5" />
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
