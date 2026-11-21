"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { formatTime12h, formatFriendlyDate, addDaysToDateString } from "@/lib/dateUtils";
import StatusBadge from "@/components/StatusBadge";

export default function HistoryPage() {
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  const todayStr = getTodayStr();

  const [startDate, setStartDate] = useState(addDaysToDateString(todayStr, -7));
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedMedId, setSelectedMedId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [medicationsList, setMedicationsList] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load medications list for dropdown filter
  useEffect(() => {
    fetch("/api/medications")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setMedicationsList(json.medications);
      })
      .catch(() => {});
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        medicationId: selectedMedId,
        status: statusFilter,
      });
      const res = await fetch(`/api/history?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setHistoryData(json);
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedMedId, statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const setShortcut = (days: number) => {
    setStartDate(addDaysToDateString(todayStr, -days));
    setEndDate(todayStr);
  };

  const { adherence, doses = [] } = historyData || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
            History & Adherence
          </h1>
          <p className="text-slate-600 text-base mt-1">
            Review past medication events, completion logs, and adherence
            rates.
          </p>
        </div>

        {/* Date shortcuts */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShortcut(7)}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm rounded-xl border border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setShortcut(30)}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm rounded-xl border border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Adherence Card */}
      <div className="bg-gradient-to-br from-sky-900 to-sky-950 text-white rounded-3xl p-6 sm:p-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sky-300 font-bold text-sm uppercase tracking-wider">
              <TrendingUp className="w-5 h-5" />
              <span>Adherence Performance Score</span>
            </div>

            <div className="flex items-baseline space-x-3">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                {adherence?.displayPercentage || "—"}
              </span>
              {adherence?.percentage !== null && (
                <span className="text-sky-200 text-base font-bold">
                  (based on {adherence?.eligibleScheduledDoses} completed dose
                  opportunities)
                </span>
              )}
            </div>

            <p className="text-sm text-sky-200 max-w-xl leading-relaxed">
              Adherence formula:{" "}
              <code className="text-white bg-sky-800/60 px-2 py-0.5 rounded">
                taken doses / (taken + skipped + missed doses) × 100
              </code>
              . Future doses and doses still within their 60-minute grace period
              are strictly excluded until completed or expired.
            </p>
          </div>

          {/* Breakdown numbers */}
          <div className="grid grid-cols-3 gap-3 text-center bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/15">
            <div className="px-3">
              <span className="text-xs font-bold text-emerald-300 uppercase block">
                Taken
              </span>
              <span className="text-2xl font-black text-white">
                {adherence?.takenDoses ?? 0}
              </span>
            </div>
            <div className="px-3 border-x border-white/20">
              <span className="text-xs font-bold text-slate-300 uppercase block">
                Skipped
              </span>
              <span className="text-2xl font-black text-white">
                {adherence?.skippedDoses ?? 0}
              </span>
            </div>
            <div className="px-3">
              <span className="text-xs font-bold text-rose-300 uppercase block">
                Missed
              </span>
              <span className="text-2xl font-black text-white">
                {adherence?.missedDoses ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-slate-800 font-bold">
          <Filter className="w-5 h-5 text-sky-600" />
          <span>Filter Records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2.5 font-bold border-2 border-slate-300 rounded-xl focus:border-sky-600 focus:outline-none"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2.5 font-bold border-2 border-slate-300 rounded-xl focus:border-sky-600 focus:outline-none"
            />
          </div>

          {/* Medication Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Medication
            </label>
            <select
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="w-full p-2.5 font-bold border-2 border-slate-300 rounded-xl focus:border-sky-600 focus:outline-none bg-white"
            >
              <option value="all">All Medications</option>
              {medicationsList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2.5 font-bold border-2 border-slate-300 rounded-xl focus:border-sky-600 focus:outline-none bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="TAKEN">Taken Only</option>
              <option value="SKIPPED">Skipped Only</option>
              <option value="MISSED">Missed Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table / List */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-slate-900 text-lg">
            Dose Records ({doses.length})
          </span>
          <button
            onClick={fetchHistory}
            className="flex items-center space-x-1 text-sm font-bold text-sky-700 hover:text-sky-900"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
            <p className="font-bold text-slate-600 mt-2">Loading logs...</p>
          </div>
        ) : doses.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-xl font-bold text-slate-800">
              No dose records match your filters
            </p>
            <p className="text-slate-500 text-sm">
              Try adjusting the date range or selecting a different status
              filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {doses.map((dose: any) => (
              <div
                key={dose.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-black text-slate-950">
                      {dose.medNameSnapshot}
                    </span>
                    <span className="text-sm font-bold text-slate-600">
                      ({dose.dosageSnapshot})
                    </span>
                    <StatusBadge status={dose.derivedStatus} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <span className="font-bold text-slate-800">
                      Scheduled: {dose.scheduledDate} at{" "}
                      {formatTime12h(dose.reminderTime)}
                    </span>

                    {dose.instructionsSnapshot && (
                      <span>• {dose.instructionsSnapshot}</span>
                    )}

                    {dose.takenAt && (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Taken at:{" "}
                        {new Date(dose.takenAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500 flex-shrink-0">
                  <span>ID: {dose.id.slice(-6)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
