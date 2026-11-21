"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { playReminderSound } from "@/lib/sound";

export interface DueReminder {
  id: string;
  medicationName: string;
  dosage: string;
  reminderTime: string;
  scheduledTime: string;
  instructions: string | null;
  snoozedUntil: string | null;
  isSnoozed: boolean;
}

interface ReminderContextType {
  dueReminders: DueReminder[];
  hasNotificationSupport: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  requestNotificationPermission: () => Promise<void>;
  reminderSoundEnabled: boolean;
  setReminderSoundEnabled: (enabled: boolean) => void;
  largeTextEnabled: boolean;
  setLargeTextEnabled: (enabled: boolean) => void;
  snoozeDose: (doseId: string, minutes?: number) => Promise<void>;
  markDoseTaken: (doseId: string) => Promise<void>;
  markDoseSkipped: (doseId: string) => Promise<void>;
  refreshReminders: () => Promise<void>;
  dismissBannerReminder: (doseId: string) => void;
}

const ReminderContext = createContext<ReminderContextType | null>(null);

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const [hasNotificationSupport, setHasNotificationSupport] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const [reminderSoundEnabled, setReminderSoundEnabledState] = useState(true);
  const [largeTextEnabled, setLargeTextEnabledState] = useState(false);

  // In-memory set of dose IDs that have already triggered a browser notification or chime in this session
  const notifiedDoseIdsRef = useRef<Set<string>>(new Set());
  // User manually dismissed from in-app banner for this session
  const dismissedDoseIdsRef = useRef<Set<string>>(new Set());

  // Check browser notification support on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setHasNotificationSupport(true);
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }

    // Load local preferences
    const savedSound = localStorage.getItem("meditrack_sound");
    if (savedSound !== null) {
      setReminderSoundEnabledState(savedSound === "true");
    }
    const savedLargeText = localStorage.getItem("meditrack_large_text");
    if (savedLargeText !== null) {
      const isLarge = savedLargeText === "true";
      setLargeTextEnabledState(isLarge);
      if (isLarge) {
        document.documentElement.classList.add("large-text-mode");
      }
    }

    // Auto-detect browser timezone and sync with server settings if default
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz) {
        fetch("/api/settings")
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.settings?.timezone === "UTC") {
              fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timezone: browserTz }),
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  const setReminderSoundEnabled = (enabled: boolean) => {
    setReminderSoundEnabledState(enabled);
    localStorage.setItem("meditrack_sound", String(enabled));
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderSound: enabled }),
    }).catch(() => {});
  };

  const setLargeTextEnabled = (enabled: boolean) => {
    setLargeTextEnabledState(enabled);
    localStorage.setItem("meditrack_large_text", String(enabled));
    if (enabled) {
      document.documentElement.classList.add("large-text-mode");
    } else {
      document.documentElement.classList.remove("large-text-mode");
    }
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ largeText: enabled }),
    }).catch(() => {});
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch (err) {
        console.error("Failed to request notification permission:", err);
      }
    }
  };

  const refreshReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/today");
      const data = await res.json();
      if (!data.success) return;

      const now = new Date();
      // Filter doses that are currently DUE and not snoozed
      const activeDueDoses: DueReminder[] = (data.doses || [])
        .filter((d: any) => d.derivedStatus === "DUE" && !d.isSnoozed)
        .map((d: any) => ({
          id: d.id,
          medicationName: d.medNameSnapshot,
          dosage: d.dosageSnapshot,
          reminderTime: d.reminderTime,
          scheduledTime: d.scheduledTime,
          instructions: d.instructionsSnapshot,
          snoozedUntil: d.snoozedUntil,
          isSnoozed: d.isSnoozed,
        }));

      setDueReminders(activeDueDoses);

      // Check for newly due doses that haven't triggered alert yet
      for (const dueDose of activeDueDoses) {
        if (!notifiedDoseIdsRef.current.has(dueDose.id)) {
          notifiedDoseIdsRef.current.add(dueDose.id);

          // 1. Play chime if enabled
          if (reminderSoundEnabled) {
            playReminderSound();
          }

          // 2. Trigger browser notification if permitted
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification(`Medicine Reminder: ${dueDose.medicationName}`, {
                body: `Scheduled for ${dueDose.reminderTime}. Dosage: ${dueDose.dosage}${
                  dueDose.instructions ? ` (${dueDose.instructions})` : ""
                }`,
                icon: "/favicon.ico",
                tag: `med-dose-${dueDose.id}`,
              });
            } catch (err) {
              console.error("Browser notification dispatch failed:", err);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error refreshing reminders:", e);
    }
  }, [reminderSoundEnabled]);

  // Handle snooze
  const snoozeDose = async (doseId: string, minutes: number = 10) => {
    try {
      await fetch("/api/schedule/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snooze", doseId, snoozeMinutes: minutes }),
      });
      // Remove from notified set so when snooze expires it notifies again!
      notifiedDoseIdsRef.current.delete(doseId);
      await refreshReminders();
    } catch (err) {
      console.error("Failed to snooze dose:", err);
    }
  };

  // Handle take
  const markDoseTaken = async (doseId: string) => {
    try {
      await fetch("/api/schedule/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "take", doseId }),
      });
      await refreshReminders();
    } catch (err) {
      console.error("Failed to mark taken:", err);
    }
  };

  // Handle skip
  const markDoseSkipped = async (doseId: string) => {
    try {
      await fetch("/api/schedule/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip", doseId }),
      });
      await refreshReminders();
    } catch (err) {
      console.error("Failed to mark skipped:", err);
    }
  };

  const dismissBannerReminder = (doseId: string) => {
    dismissedDoseIdsRef.current.add(doseId);
    setDueReminders((prev) => prev.filter((d) => d.id !== doseId));
  };

  // Set up periodic check (every 25 seconds) and event listeners for focus & visibilitychange
  useEffect(() => {
    refreshReminders();

    const intervalId = setInterval(() => {
      refreshReminders();
    }, 25000);

    const onFocus = () => {
      refreshReminders();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshReminders();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshReminders]);

  return (
    <ReminderContext.Provider
      value={{
        dueReminders: dueReminders.filter((d) => !dismissedDoseIdsRef.current.has(d.id)),
        hasNotificationSupport,
        notificationPermission,
        requestNotificationPermission,
        reminderSoundEnabled,
        setReminderSoundEnabled,
        largeTextEnabled,
        setLargeTextEnabled,
        snoozeDose,
        markDoseTaken,
        markDoseSkipped,
        refreshReminders,
        dismissBannerReminder,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx) {
    throw new Error("useReminders must be used within a ReminderProvider");
  }
  return ctx;
}
