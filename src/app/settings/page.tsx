"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Bell,
  Volume2,
  VolumeX,
  Type,
  Globe,
  Sparkles,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import { useReminders } from "@/context/ReminderContext";
import { playReminderSound } from "@/lib/sound";

export default function SettingsPage() {
  const {
    hasNotificationSupport,
    notificationPermission,
    requestNotificationPermission,
    reminderSoundEnabled,
    setReminderSoundEnabled,
    largeTextEnabled,
    setLargeTextEnabled,
    refreshReminders,
  } = useReminders();

  const [timezone, setTimezone] = useState("UTC");
  const [loadingTz, setLoadingTz] = useState(true);
  const [tzFeedback, setTzFeedback] = useState<string | null>(null);

  // Demo data state
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoFeedback, setDemoFeedback] = useState<string | null>(null);
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.settings?.timezone) {
          setTimezone(json.settings.timezone);
        }
      })
      .finally(() => setLoadingTz(false));
  }, []);

  const handleTimezoneChange = async (newTz: string) => {
    setTimezone(newTz);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: newTz }),
      });
      const data = await res.json();
      if (data.success) {
        setTzFeedback("Timezone updated successfully.");
        setTimeout(() => setTzFeedback(null), 3000);
        refreshReminders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setDemoFeedback(null);
    try {
      const res = await fetch("/api/demo/load", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setDemoFeedback("Demo medications and schedule samples loaded successfully!");
        refreshReminders();
      } else {
        setDemoFeedback(data.error || "Failed to load demo data.");
      }
    } catch (e: any) {
      setDemoFeedback(e.message || "Failed to load demo data.");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setDemoLoading(true);
    setDemoFeedback(null);
    try {
      const res = await fetch("/api/demo/clear", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setDemoFeedback(data.message || "Demo entries cleared. User data preserved.");
        setConfirmClearDemo(false);
        refreshReminders();
      } else {
        setDemoFeedback(data.error || "Failed to clear demo data.");
      }
    } catch (e: any) {
      setDemoFeedback(e.message || "Failed to clear demo data.");
    } finally {
      setDemoLoading(false);
    }
  };

  // Common timezones list
  const commonTimezones = [
    "UTC",
    "Asia/Kolkata",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
          Application Settings & Accessibility
        </h1>
        <p className="text-slate-600 text-base mt-1">
          Configure notifications, gentle sound alerts, high-visibility text,
          and timezones.
        </p>
      </div>

      {/* 1. Reminder Limitations Notice */}
      <div className="p-6 bg-sky-50 border-2 border-sky-300 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2 text-sky-900 font-black text-lg">
          <Info className="w-6 h-6 text-sky-700 flex-shrink-0" />
          <span>How Reminders Work in this Application</span>
        </div>
        <p className="text-slate-800 text-base leading-relaxed">
          MediTrack runs locally in your browser. Reminders, audible chimes, and
          browser pop-up alerts trigger <strong>while this web application is open in a browser tab</strong>.
        </p>
        <p className="text-slate-700 text-sm">
          Because this is an offline-first single-user application without third-party cloud servers or paid push notification infrastructure, alerts cannot wake up a sleeping computer or sound if your browser is closed. Keep this tab open or pinned in your browser to receive continuous alerts.
        </p>
      </div>

      {/* 2. Notifications & Audio Section */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-slate-200 shadow-sm space-y-6">
        <h2 className="text-2xl font-black text-slate-900 border-b pb-3">
          Notifications & Alerts
        </h2>

        {/* Browser Notifications */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="font-bold text-base text-slate-900 block flex items-center space-x-2">
              <Bell className="w-5 h-5 text-sky-700" />
              <span>Browser Desktop Notifications</span>
            </span>
            <span className="text-sm text-slate-600 block mt-1">
              Status:{" "}
              <strong
                className={`uppercase ${
                  notificationPermission === "granted"
                    ? "text-emerald-700 font-black"
                    : notificationPermission === "denied"
                    ? "text-rose-700 font-black"
                    : "text-amber-700 font-bold"
                }`}
              >
                {notificationPermission}
              </strong>
            </span>
            {notificationPermission === "denied" && (
              <p className="text-xs text-rose-700 mt-1">
                Notifications were blocked in your browser settings. In-app banner reminders remain fully active.
              </p>
            )}
          </div>

          <div>
            {hasNotificationSupport ? (
              notificationPermission === "granted" ? (
                <span className="inline-flex items-center space-x-1 px-4 py-2 bg-emerald-100 text-emerald-950 font-bold rounded-xl border border-emerald-300 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-700" />
                  <span>Enabled</span>
                </span>
              ) : (
                <button
                  onClick={requestNotificationPermission}
                  className="px-5 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl shadow-sm text-sm focus:outline-none focus:ring-4 focus:ring-sky-400"
                >
                  Enable Browser Notifications
                </button>
              )
            ) : (
              <span className="text-sm text-slate-500 font-bold">
                Not supported on this browser
              </span>
            )}
          </div>
        </div>

        {/* Reminder Sound Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="font-bold text-base text-slate-900 block flex items-center space-x-2">
              {reminderSoundEnabled ? (
                <Volume2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-400" />
              )}
              <span>Audible Reminder Chime</span>
            </span>
            <span className="text-sm text-slate-600 block mt-1">
              Plays a gentle melodic chime when a dose becomes due.
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => playReminderSound()}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 shadow-sm"
              title="Test the chime sound"
            >
              Test Chime
            </button>

            <button
              onClick={() => setReminderSoundEnabled(!reminderSoundEnabled)}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-all border-2 ${
                reminderSoundEnabled
                  ? "bg-emerald-700 text-white border-emerald-800"
                  : "bg-slate-200 text-slate-700 border-slate-300"
              }`}
            >
              {reminderSoundEnabled ? "Sound: ON" : "Sound: OFF"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Accessibility & Display */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-slate-200 shadow-sm space-y-6">
        <h2 className="text-2xl font-black text-slate-900 border-b pb-3">
          Accessibility & Appearance
        </h2>

        {/* Larger Text Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="font-bold text-base text-slate-900 block flex items-center space-x-2">
              <Type className="w-5 h-5 text-sky-700" />
              <span>Elderly Friendly Large Text Mode</span>
            </span>
            <span className="text-sm text-slate-600 block mt-1">
              Increases the base font size and enhances button visibility across the entire app.
            </span>
          </div>

          <button
            onClick={() => setLargeTextEnabled(!largeTextEnabled)}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all border-2 ${
              largeTextEnabled
                ? "bg-sky-700 text-white border-sky-800"
                : "bg-slate-200 text-slate-700 border-slate-300"
            }`}
          >
            {largeTextEnabled ? "Large Text: ON" : "Large Text: OFF"}
          </button>
        </div>

        {/* Timezone Setting */}
        <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <label className="block text-base font-bold text-slate-900 flex items-center space-x-2">
            <Globe className="w-5 h-5 text-sky-700" />
            <span>Scheduling Timezone</span>
          </label>
          <p className="text-sm text-slate-600">
            Medication reminders and daily schedules are calculated relative to this explicit timezone.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="p-3 font-bold text-base rounded-xl border-2 border-slate-300 focus:border-sky-600 bg-white"
            >
              {!commonTimezones.includes(timezone) && (
                <option value={timezone}>{timezone} (Detected)</option>
              )}
              {commonTimezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {tzFeedback && (
            <p className="text-emerald-700 font-bold text-sm mt-2 flex items-center space-x-1">
              <CheckCircle className="w-4 h-4 inline" />
              <span>{tzFeedback}</span>
            </p>
          )}
        </div>
      </div>

      {/* 4. Demo Data Management */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-slate-200 shadow-sm space-y-4">
        <h2 className="text-2xl font-black text-slate-900 border-b pb-3">
          Demonstration Data
        </h2>
        <p className="text-slate-600 text-sm">
          Load fictional sample medications and scheduled doses to explore
          upcoming, due, taken, skipped, and missed states.
        </p>

        {demoFeedback && (
          <div className="p-3 bg-sky-50 border border-sky-300 text-sky-900 rounded-xl text-sm font-bold">
            {demoFeedback}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleLoadDemo}
            disabled={demoLoading}
            className="flex items-center space-x-2 px-5 py-2.5 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-950 font-bold rounded-xl border border-amber-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-300"
          >
            <Sparkles className="w-5 h-5 text-amber-700" />
            <span>Load Demo Data</span>
          </button>

          <button
            onClick={() => setConfirmClearDemo(true)}
            disabled={demoLoading}
            className="flex items-center space-x-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-sm"
          >
            <Trash2 className="w-4 h-4 text-slate-600" />
            <span>Clear Demo Data</span>
          </button>
        </div>
      </div>

      {/* Clear Demo Confirmation Modal */}
      {confirmClearDemo && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-slate-200 space-y-4">
            <h3 className="text-2xl font-black text-slate-900">
              Clear Demo Medications?
            </h3>
            <p className="text-slate-700 text-sm">
              This will safely remove only sample demo records.
              <strong className="block mt-1 text-slate-900">
                Your personal user-created medications will not be touched.
              </strong>
            </p>
            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setConfirmClearDemo(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleClearDemo}
                className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl shadow-sm"
              >
                Clear Demo Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
