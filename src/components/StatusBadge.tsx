import React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Bell,
  Clock8,
} from "lucide-react";
import { DerivedDoseStatus } from "@/lib/scheduleEngine";

interface StatusBadgeProps {
  status: DerivedDoseStatus;
  isSnoozed?: boolean;
  snoozedUntil?: string | null;
}

export default function StatusBadge({
  status,
  isSnoozed,
  snoozedUntil,
}: StatusBadgeProps) {
  let badgeClasses = "";
  let icon = null;
  let text = "";

  switch (status) {
    case "TAKEN":
      badgeClasses =
        "bg-emerald-100 text-emerald-950 border-2 border-emerald-500";
      icon = <CheckCircle2 className="w-5 h-5 text-emerald-700" />;
      text = "TAKEN";
      break;

    case "SKIPPED":
      badgeClasses =
        "bg-slate-100 text-slate-800 border-2 border-slate-400";
      icon = <XCircle className="w-5 h-5 text-slate-600" />;
      text = "SKIPPED";
      break;

    case "DUE":
      badgeClasses =
        "bg-amber-100 text-amber-950 border-2 border-amber-500 font-black animate-pulse";
      icon = <Bell className="w-5 h-5 text-amber-700" />;
      text = "DUE NOW";
      break;

    case "MISSED":
      badgeClasses =
        "bg-rose-100 text-rose-950 border-2 border-rose-500 font-black";
      icon = <AlertTriangle className="w-5 h-5 text-rose-700" />;
      text = "MISSED";
      break;

    case "UPCOMING":
    default:
      badgeClasses =
        "bg-sky-50 text-sky-950 border-2 border-sky-300";
      icon = <Clock className="w-5 h-5 text-sky-600" />;
      text = "UPCOMING";
      break;
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold tracking-wide shadow-sm ${badgeClasses}`}
        role="status"
      >
        {icon}
        <span>{text}</span>
      </span>

      {isSnoozed && status !== "TAKEN" && status !== "SKIPPED" && (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-xs font-bold"
          title="Reminder snoozed"
        >
          <Clock8 className="w-3.5 h-3.5 text-amber-600" />
          <span>Snoozed</span>
        </span>
      )}
    </div>
  );
}
