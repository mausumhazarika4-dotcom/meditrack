"use client";

import React from "react";
import { useReminders } from "@/context/ReminderContext";
import { Bell, Check, X, Clock8, AlertCircle } from "lucide-react";
import { formatTime12h } from "@/lib/dateUtils";

export default function ReminderBanner() {
  const {
    dueReminders,
    markDoseTaken,
    markDoseSkipped,
    snoozeDose,
    dismissBannerReminder,
  } = useReminders();

  if (dueReminders.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-amber-500 text-slate-950 border-b-4 border-amber-600 shadow-md transition-all"
    >
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6">
        <div className="flex items-center space-x-2 mb-3">
          <Bell className="w-6 h-6 text-slate-950 animate-bounce flex-shrink-0" />
          <h2 className="text-xl font-black tracking-tight">
            Medicine Reminder: You have {dueReminders.length} dose
            {dueReminders.length > 1 ? "s" : ""} due now!
          </h2>
        </div>

        <div className="space-y-3">
          {dueReminders.map((dose) => (
            <div
              key={dose.id}
              className="bg-white rounded-xl p-4 border-2 border-amber-600 text-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
            >
              <div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-xl font-bold text-slate-950">
                    {dose.medicationName}
                  </span>
                  <span className="text-base font-semibold text-slate-600">
                    — {dose.dosage}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-700 mt-1 flex items-center space-x-2">
                  <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                    Scheduled: {formatTime12h(dose.reminderTime)}
                  </span>
                  {dose.instructions && (
                    <span className="text-slate-600">
                      • {dose.instructions}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons with high-contrast, large targets */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => markDoseTaken(dose.id)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-base rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-400"
                >
                  <Check className="w-5 h-5" />
                  <span>Take Now</span>
                </button>

                <button
                  onClick={() => snoozeDose(dose.id, 10)}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-base rounded-lg border border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-300"
                  title="Remind me again in 10 minutes"
                >
                  <Clock8 className="w-5 h-5" />
                  <span>Snooze 10m</span>
                </button>

                <button
                  onClick={() => markDoseSkipped(dose.id)}
                  className="flex items-center space-x-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-300"
                >
                  <X className="w-4 h-4" />
                  <span>Skip</span>
                </button>

                <button
                  onClick={() => dismissBannerReminder(dose.id)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 ml-1"
                  aria-label="Dismiss banner"
                  title="Dismiss banner"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
