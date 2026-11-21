"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, AlertCircle, Save, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

interface MedicationFormProps {
  initialData?: {
    id?: string;
    name?: string;
    dosage?: string;
    instructions?: string | null;
    scheduleType?: string;
    daysOfWeek?: string | null;
    reminderTimes?: string;
    startDate?: string;
    endDate?: string | null;
    stockTracking?: boolean;
    stock?: number | null;
    lowStockThreshold?: number | null;
  };
  isEdit?: boolean;
}

const WEEKDAYS = [
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
  { id: 0, label: "Sunday" },
];

export default function MedicationForm({
  initialData,
  isEdit = false,
}: MedicationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Helper for today's default YYYY-MM-DD
  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  const [name, setName] = useState(
    initialData?.name || searchParams?.get("name") || ""
  );
  const [dosage, setDosage] = useState(
    initialData?.dosage || searchParams?.get("dosage") || ""
  );
  const [instructions, setInstructions] = useState(
    initialData?.instructions || searchParams?.get("instructions") || ""
  );
  const [scheduleType, setScheduleType] = useState<"DAILY" | "SPECIFIC_DAYS">(
    (initialData?.scheduleType as any) ||
      (searchParams?.get("scheduleType") as any) ||
      "DAILY"
  );

  // Selected weekdays
  const [selectedDays, setSelectedDays] = useState<number[]>(() => {
    const rawDays = initialData?.daysOfWeek || searchParams?.get("daysOfWeek");
    if (rawDays) {
      return rawDays
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    }
    return [1, 2, 3, 4, 5]; // Default Mon-Fri
  });

  // Reminder times list
  const [reminderTimes, setReminderTimes] = useState<string[]>(() => {
    const rawTimes =
      initialData?.reminderTimes || searchParams?.get("reminderTimes");
    if (rawTimes) {
      try {
        const parsed = JSON.parse(rawTimes);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return ["08:00"];
  });

  const [startDate, setStartDate] = useState(
    initialData?.startDate || getTodayISO()
  );
  const [endDate, setEndDate] = useState(initialData?.endDate || "");

  // Stock tracking
  const [stockTracking, setStockTracking] = useState(
    Boolean(
      initialData?.stockTracking || searchParams?.get("stock") !== null
    )
  );
  const [stock, setStock] = useState<string>(() => {
    if (initialData?.stock !== undefined && initialData?.stock !== null) {
      return String(initialData.stock);
    }
    const qStock = searchParams?.get("stock");
    if (qStock) return qStock;
    return "30";
  });
  const [lowStockThreshold, setLowStockThreshold] = useState<string>(() => {
    if (
      initialData?.lowStockThreshold !== undefined &&
      initialData?.lowStockThreshold !== null
    ) {
      return String(initialData.lowStockThreshold);
    }
    const qThresh = searchParams?.get("lowStockThreshold");
    if (qThresh) return qThresh;
    return "5";
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleDay = (dayId: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const handleTimeChange = (index: number, val: string) => {
    const updated = [...reminderTimes];
    updated[index] = val;
    setReminderTimes(updated);
  };

  const addTimeSlot = () => {
    setReminderTimes((prev) => [...prev, "12:00"]);
  };

  const removeTimeSlot = (index: number) => {
    if (reminderTimes.length <= 1) return;
    setReminderTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Medication name is required.";
    if (!dosage.trim())
      errors.dosage = "Dosage text is required (e.g. '1 tablet', '5 ml').";
    if (!startDate) errors.startDate = "Start date is required.";

    if (endDate && endDate < startDate) {
      errors.endDate = "End date cannot be earlier than start date.";
    }

    if (reminderTimes.length === 0) {
      errors.reminderTimes = "At least one reminder time is required.";
    } else {
      // Check for duplicates
      const trimmedTimes = reminderTimes.map((t) => t.trim()).filter(Boolean);
      const unique = new Set(trimmedTimes);
      if (unique.size !== trimmedTimes.length) {
        errors.reminderTimes = "Duplicate reminder times are not allowed.";
      }
    }

    if (scheduleType === "SPECIFIC_DAYS" && selectedDays.length === 0) {
      errors.days = "Please select at least one day of the week.";
    }

    if (stockTracking) {
      const stockNum = Number(stock);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        errors.stock = "Stock must be a non-negative whole number (0 or higher).";
      }

      const threshNum = Number(lowStockThreshold);
      if (isNaN(threshNum) || !Number.isInteger(threshNum) || threshNum < 0) {
        errors.lowStockThreshold =
          "Threshold must be a non-negative whole number (0 or higher).";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) {
      setFormError("Please fix the highlighted errors before saving.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      dosage: dosage.trim(),
      instructions: instructions.trim() || null,
      scheduleType,
      daysOfWeek:
        scheduleType === "SPECIFIC_DAYS" ? selectedDays.join(",") : null,
      reminderTimes: reminderTimes.map((t) => t.trim()).sort(),
      startDate,
      endDate: endDate ? endDate : null,
      stockTracking,
      stock: stockTracking ? parseInt(stock, 10) : null,
      lowStockThreshold: stockTracking ? parseInt(lowStockThreshold, 10) : 5,
    };

    try {
      const url = isEdit
        ? `/api/medications/${initialData?.id}`
        : "/api/medications";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || "Failed to save medication.");
      } else {
        router.push("/medications");
        router.refresh();
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred while saving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-8"
      noValidate
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <Link
            href="/medications"
            className="inline-flex items-center space-x-1 text-sm font-bold text-sky-700 hover:text-sky-900 mb-2 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Medication List</span>
          </Link>
          <h1 className="text-3xl font-black text-slate-900">
            {isEdit ? "Edit Medication" : "Add New Medication"}
          </h1>
          {isEdit && (
            <p className="text-sm font-medium text-slate-600 mt-1">
              Changes apply prospectively. Past dose records and adherence
              history remain safely preserved.
            </p>
          )}
        </div>

        {!isEdit && (
          <Link
            href="/ai"
            className="hidden sm:flex items-center space-x-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-sm rounded-xl border border-amber-300 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Auto-fill with AI</span>
          </Link>
        )}
      </div>

      {!isEdit && (
        <Link
          href="/ai"
          className="sm:hidden flex items-center justify-between p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 font-bold text-sm"
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Auto-fill from notes with AI</span>
          </div>
          <span className="text-xs text-sky-700 underline">Try &rarr;</span>
        </Link>
      )}

      {formError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border-2 border-rose-500 rounded-xl text-rose-900 font-bold flex items-center space-x-3"
        >
          <AlertCircle className="w-6 h-6 flex-shrink-0 text-rose-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* 1. Basic Details */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 border-b pb-2">
          1. Medication Information
        </h2>

        {/* Medication Name */}
        <div>
          <label
            htmlFor="med-name"
            className="block text-base font-bold text-slate-900 mb-1"
          >
            Medication Name <span className="text-rose-600">*</span>
          </label>
          <input
            id="med-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aspirin, Metformin, Lisinopril"
            className="w-full text-lg p-3 rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none"
          />
          {fieldErrors.name && (
            <p className="text-rose-600 font-bold text-sm mt-1">
              {fieldErrors.name}
            </p>
          )}
        </div>

        {/* Dosage */}
        <div>
          <label
            htmlFor="med-dosage"
            className="block text-base font-bold text-slate-900 mb-1"
          >
            Dosage Description <span className="text-rose-600">*</span>
          </label>
          <input
            id="med-dosage"
            type="text"
            required
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g. 1 tablet (100mg), 5 ml, 2 capsules"
            className="w-full text-lg p-3 rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none"
          />
          {fieldErrors.dosage && (
            <p className="text-rose-600 font-bold text-sm mt-1">
              {fieldErrors.dosage}
            </p>
          )}
        </div>

        {/* Instructions */}
        <div>
          <label
            htmlFor="med-instructions"
            className="block text-base font-bold text-slate-900 mb-1"
          >
            Instructions or Notes (Optional)
          </label>
          <input
            id="med-instructions"
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Take with a meal, Drink plenty of water"
            className="w-full text-lg p-3 rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none"
          />
        </div>
      </div>

      {/* 2. Schedule */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 border-b pb-2">
          2. Schedule & Reminders
        </h2>

        {/* Schedule Type */}
        <div>
          <label className="block text-base font-bold text-slate-900 mb-2">
            Schedule Frequency
          </label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 text-base font-bold cursor-pointer p-3 border-2 rounded-xl flex-1 bg-slate-50 border-slate-300 hover:border-sky-500">
              <input
                type="radio"
                name="scheduleType"
                value="DAILY"
                checked={scheduleType === "DAILY"}
                onChange={() => setScheduleType("DAILY")}
                className="w-5 h-5 text-sky-600"
              />
              <span>Every Day</span>
            </label>

            <label className="flex items-center space-x-2 text-base font-bold cursor-pointer p-3 border-2 rounded-xl flex-1 bg-slate-50 border-slate-300 hover:border-sky-500">
              <input
                type="radio"
                name="scheduleType"
                value="SPECIFIC_DAYS"
                checked={scheduleType === "SPECIFIC_DAYS"}
                onChange={() => setScheduleType("SPECIFIC_DAYS")}
                className="w-5 h-5 text-sky-600"
              />
              <span>Selected Days of Week</span>
            </label>
          </div>
        </div>

        {/* Weekday Pickers */}
        {scheduleType === "SPECIFIC_DAYS" && (
          <div className="p-4 bg-sky-50 border-2 border-sky-200 rounded-xl space-y-2">
            <span className="block text-sm font-bold text-slate-900">
              Select Active Days: <span className="text-rose-600">*</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const isSelected = selectedDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
                      isSelected
                        ? "bg-sky-700 text-white border-sky-800 shadow-sm"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.days && (
              <p className="text-rose-600 font-bold text-sm mt-1">
                {fieldErrors.days}
              </p>
            )}
          </div>
        )}

        {/* Reminder Times */}
        <div className="space-y-2">
          <label className="block text-base font-bold text-slate-900">
            Reminder Times <span className="text-rose-600">*</span>
          </label>
          <div className="space-y-3">
            {reminderTimes.map((time, idx) => (
              <div key={idx} className="flex items-center space-x-3">
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => handleTimeChange(idx, e.target.value)}
                  className="text-xl font-bold p-3 border-2 border-slate-300 rounded-xl focus:border-sky-600 focus:outline-none"
                />
                {reminderTimes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTimeSlot(idx)}
                    className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-300"
                    title="Remove reminder time"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addTimeSlot}
            className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-300 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Reminder Time</span>
          </button>
          {fieldErrors.reminderTimes && (
            <p className="text-rose-600 font-bold text-sm mt-1">
              {fieldErrors.reminderTimes}
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label
              htmlFor="med-start-date"
              className="block text-base font-bold text-slate-900 mb-1"
            >
              Start Date <span className="text-rose-600">*</span>
            </label>
            <input
              id="med-start-date"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-base font-bold p-3 rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none"
            />
            {fieldErrors.startDate && (
              <p className="text-rose-600 font-bold text-sm mt-1">
                {fieldErrors.startDate}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="med-end-date"
              className="block text-base font-bold text-slate-900 mb-1"
            >
              End Date (Optional)
            </label>
            <input
              id="med-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-base font-bold p-3 rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none"
            />
            {fieldErrors.endDate && (
              <p className="text-rose-600 font-bold text-sm mt-1">
                {fieldErrors.endDate}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Stock Inventory */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 border-b pb-2">
          3. Stock & Inventory Tracking
        </h2>

        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={stockTracking}
            onChange={(e) => setStockTracking(e.target.checked)}
            className="w-6 h-6 text-sky-600 rounded mt-0.5"
          />
          <div>
            <span className="font-bold text-base text-slate-900 block">
              Track Dose Stock for this Medication
            </span>
            <span className="text-sm text-slate-600 block">
              MediTrack will count doses remaining and warn you when stock runs
              low.
            </span>
          </div>
        </label>

        {stockTracking && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border-2 border-slate-200 rounded-xl">
            <div>
              <label
                htmlFor="med-stock"
                className="block text-sm font-bold text-slate-900 mb-1"
              >
                Remaining Stock (Doses)
              </label>
              <input
                id="med-stock"
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full text-lg font-bold p-3 rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none"
              />
              {fieldErrors.stock && (
                <p className="text-rose-600 font-bold text-sm mt-1">
                  {fieldErrors.stock}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="med-threshold"
                className="block text-sm font-bold text-slate-900 mb-1"
              >
                Low-Stock Warning Threshold
              </label>
              <input
                id="med-threshold"
                type="number"
                min="0"
                step="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full text-lg font-bold p-3 rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none"
              />
              {fieldErrors.lowStockThreshold && (
                <p className="text-rose-600 font-bold text-sm mt-1">
                  {fieldErrors.lowStockThreshold}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form Submission */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-4">
        <Link
          href="/medications"
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center space-x-2 px-8 py-3 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-black text-lg rounded-xl shadow-md focus:outline-none focus:ring-4 focus:ring-sky-400"
        >
          <Save className="w-5 h-5" />
          <span>{isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Medication"}</span>
        </button>
      </div>
    </form>
  );
}
