"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  MessageSquare,
  TrendingUp,
  FileText,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Clock,
  Package,
} from "lucide-react";
import { ChatMessage, ParsedMedicationDraft } from "@/lib/gemini";
import { formatTime12h } from "@/lib/dateUtils";

export default function AiHubPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"chat" | "insights" | "entry">("chat");

  /* ===================== TAB 1: CHAT STATE ===================== */
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your MediTrack Companion. You can ask me about your daily schedule, how your adherence is tracking, or general questions about managing your medication routine.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || chatLoading) return;

    setInputMessage("");
    setChatError(null);

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setChatError(data.error || "Failed to get response from AI assistant.");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (err: any) {
      setChatError(err.message || "Network error. Please try again.");
    } finally {
      setChatLoading(false);
    }
  };

  /* ===================== TAB 2: INSIGHTS STATE ===================== */
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsText, setInsightsText] = useState<string | null>(null);
  const [insightsData, setInsightsData] = useState<any>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await fetch("/api/ai/insights");
      const data = await res.json();
      if (!data.success) {
        setInsightsError(data.error || "Failed to generate insights.");
      } else {
        setInsightsText(data.insights);
        setInsightsData(data);
      }
    } catch (err: any) {
      setInsightsError(err.message || "Failed to load insights.");
    } finally {
      setInsightsLoading(false);
    }
  };

  /* ===================== TAB 3: SMART ENTRY STATE ===================== */
  const [entryInput, setEntryInput] = useState("");
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [parsedDraft, setParsedDraft] = useState<ParsedMedicationDraft | null>(null);

  const handleParseMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryInput.trim() || entryLoading) return;

    setEntryLoading(true);
    setEntryError(null);
    setParsedDraft(null);

    try {
      const res = await fetch("/api/ai/parse-medication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entryInput.trim() }),
      });

      const data = await res.json();
      if (!data.success) {
        setEntryError(data.error || "Failed to extract medication details.");
      } else {
        setParsedDraft(data.draft);
      }
    } catch (err: any) {
      setEntryError(err.message || "Network error while parsing.");
    } finally {
      setEntryLoading(false);
    }
  };

  const handleApplyDraftToForm = () => {
    if (!parsedDraft) return;

    // Encode draft into URL search parameters for the medication form
    const params = new URLSearchParams();
    if (parsedDraft.name) params.set("name", parsedDraft.name);
    if (parsedDraft.dosage) params.set("dosage", parsedDraft.dosage);
    if (parsedDraft.instructions) params.set("instructions", parsedDraft.instructions);
    if (parsedDraft.scheduleType) params.set("scheduleType", parsedDraft.scheduleType);
    if (parsedDraft.daysOfWeek && parsedDraft.daysOfWeek.length > 0) {
      params.set("daysOfWeek", parsedDraft.daysOfWeek.join(","));
    }
    if (parsedDraft.reminderTimes && parsedDraft.reminderTimes.length > 0) {
      params.set("reminderTimes", JSON.stringify(parsedDraft.reminderTimes));
    }
    if (parsedDraft.stock !== null) params.set("stock", String(parsedDraft.stock));
    params.set("lowStockThreshold", String(parsedDraft.lowStockThreshold || 5));

    router.push(`/medications/new?${params.toString()}`);
  };

  /* ===================== TAB 4: SMART REMINDER PREVIEW ===================== */
  const [sampleDueMeds, setSampleDueMeds] = useState<any[]>([]);
  const [smartReminderText, setSmartReminderText] = useState<string | null>(null);
  const [smartReminderLoading, setSmartReminderLoading] = useState(false);

  useEffect(() => {
    fetch("/api/medications")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.medications?.length > 0) {
          setSampleDueMeds(json.medications.slice(0, 3));
        }
      })
      .catch(() => {});
  }, []);

  const handleTestSmartReminder = async (med: any) => {
    setSmartReminderLoading(true);
    setSmartReminderText(null);
    try {
      let times = ["08:00"];
      try {
        times = JSON.parse(med.reminderTimes);
      } catch {}

      const res = await fetch("/api/ai/smart-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationName: med.name,
          dosage: med.dosage,
          reminderTime: times[0] || "08:00",
          instructions: med.instructions,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSmartReminderText(data.reminderText);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSmartReminderLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2 text-sky-700 font-bold text-sm uppercase tracking-wide">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span>Gemini AI Features</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-1">
          MediTrack AI Companion
        </h1>
        <p className="text-slate-600 text-base mt-1">
          Intelligent schedule assistance, adherence insights, and natural-language prescription entry.
        </p>
      </div>

      {/* Safety & Medical Disclaimer Banner */}
      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start space-x-3 text-amber-950">
        <ShieldAlert className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong className="block font-bold mb-0.5">
            Safety First — Informational Guidance Only
          </strong>
          MediTrack AI provides schedule assistance, adherence analysis, and data entry help.
          It <strong>never diagnoses medical conditions, prescribes drugs, or recommends changing dosages</strong>.
          Always follow your doctor's exact prescription.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-slate-200 space-x-2 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab("chat")}
          className={`py-3 px-4 font-bold text-base sm:text-lg border-b-4 transition-all flex items-center space-x-2 whitespace-nowrap focus:outline-none ${
            activeTab === "chat"
              ? "border-sky-600 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>Chat Assistant</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("insights");
            if (!insightsText) fetchInsights();
          }}
          className={`py-3 px-4 font-bold text-base sm:text-lg border-b-4 transition-all flex items-center space-x-2 whitespace-nowrap focus:outline-none ${
            activeTab === "insights"
              ? "border-sky-600 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Adherence Insights</span>
        </button>

        <button
          onClick={() => setActiveTab("entry")}
          className={`py-3 px-4 font-bold text-base sm:text-lg border-b-4 transition-all flex items-center space-x-2 whitespace-nowrap focus:outline-none ${
            activeTab === "entry"
              ? "border-sky-600 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Smart Medication Entry</span>
        </button>
      </div>

      {/* ===================== TAB 1: CHAT ASSISTANT ===================== */}
      {activeTab === "chat" && (
        <div className="space-y-4">
          {/* Quick Prompts */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Suggested Questions
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                "What is my medication schedule today?",
                "How has my adherence been recently?",
                "What are some helpful tips for remembering medications?",
                "Why should certain vitamins be taken with food?",
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={chatLoading}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-300 shadow-sm transition-colors text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Container */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm flex flex-col h-[520px]">
            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm text-base leading-relaxed ${
                      msg.role === "user"
                        ? "bg-sky-700 text-white font-medium rounded-br-none"
                        : "bg-slate-100 text-slate-900 border border-slate-200 rounded-bl-none"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-sky-800 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>MediTrack Companion</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 text-slate-700 rounded-2xl p-4 border border-slate-200 flex items-center space-x-2 text-sm font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}

              {chatError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-sm font-bold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{chatError}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about your schedule, adherence, or medication routines..."
                disabled={chatLoading}
                className="flex-1 p-3 text-base font-medium rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none bg-white"
              />

              <button
                type="submit"
                disabled={chatLoading || !inputMessage.trim()}
                className="px-5 py-3 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm flex items-center space-x-1.5 focus:outline-none focus:ring-4 focus:ring-sky-400"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: ADHERENCE INSIGHTS ===================== */}
      {activeTab === "insights" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Personalized Adherence Analysis
              </h2>
              <p className="text-slate-600 text-sm">
                Evaluates your real medication log over the past 14 days without inventing statistics.
              </p>
            </div>

            <button
              onClick={fetchInsights}
              disabled={insightsLoading}
              className="flex items-center space-x-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm self-start sm:self-auto"
            >
              <RefreshCw className={`w-4 h-4 ${insightsLoading ? "animate-spin" : ""}`} />
              <span>Refresh Insights</span>
            </button>
          </div>

          {insightsError && (
            <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-xl text-rose-900 font-bold flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span>{insightsError}</span>
            </div>
          )}

          {/* Numbers Overview */}
          {insightsData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border-2 border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase block">
                  Adherence Score
                </span>
                <span className="text-3xl font-black text-slate-900 mt-1 block">
                  {insightsData.adherence?.displayPercentage || "—"}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border-2 border-slate-200">
                <span className="text-xs font-bold text-emerald-700 uppercase block">
                  Taken Doses
                </span>
                <span className="text-3xl font-black text-emerald-800 mt-1 block">
                  {insightsData.adherence?.takenDoses ?? 0}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border-2 border-slate-200">
                <span className="text-xs font-bold text-rose-700 uppercase block">
                  Missed Doses
                </span>
                <span className="text-3xl font-black text-rose-800 mt-1 block">
                  {insightsData.adherence?.missedDoses ?? 0}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border-2 border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase block">
                  Active Medicines
                </span>
                <span className="text-3xl font-black text-slate-900 mt-1 block">
                  {insightsData.activeMedicationsCount ?? 0}
                </span>
              </div>
            </div>
          )}

          {/* AI Report Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-sky-800 font-black text-lg border-b pb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Gemini Health Insights Report</span>
            </div>

            {insightsLoading ? (
              <div className="py-12 text-center text-slate-600 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
                <p className="font-bold text-base">
                  Analyzing your real dose patterns and compiling insights...
                </p>
              </div>
            ) : insightsText ? (
              <div className="prose prose-slate max-w-none text-slate-800 text-base leading-relaxed whitespace-pre-wrap">
                {insightsText}
              </div>
            ) : (
              <p className="text-slate-500 text-base py-6 text-center">
                Click "Refresh Insights" to evaluate your medication schedule.
              </p>
            )}
          </div>

          {/* Smart Reminders Preview */}
          {sampleDueMeds.length > 0 && (
            <div className="bg-sky-50 rounded-2xl p-6 border-2 border-sky-200 space-y-4">
              <div className="flex items-center space-x-2 text-sky-950 font-black text-lg">
                <Clock className="w-5 h-5 text-sky-700" />
                <span>Smart Friendly Reminder Generator</span>
              </div>
              <p className="text-slate-700 text-sm">
                Test personalized reminder copy for your active medications. AI creates warm, clear reminders without changing dose times.
              </p>

              <div className="flex flex-wrap gap-2">
                {sampleDueMeds.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleTestSmartReminder(m)}
                    disabled={smartReminderLoading}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm rounded-xl border border-slate-300 shadow-sm"
                  >
                    Generate Reminder: {m.name}
                  </button>
                ))}
              </div>

              {smartReminderLoading && (
                <div className="text-sm font-bold text-sky-800 flex items-center space-x-2 pt-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                  <span>Drafting friendly reminder...</span>
                </div>
              )}

              {smartReminderText && (
                <div className="p-4 bg-white rounded-xl border-2 border-sky-300 text-slate-900 text-base font-semibold shadow-sm mt-3">
                  <span className="text-xs font-bold text-sky-700 uppercase block mb-1">
                    Smart Reminder Preview:
                  </span>
                  "{smartReminderText}"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 3: SMART MEDICATION ENTRY ===================== */}
      {activeTab === "entry" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Natural-Language Medication Extractor
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                Type or paste notes from your prescription, doctor's discharge summary, or pill bottle. Gemini will extract structured fields for your review before saving.
              </p>
            </div>

            <form onSubmit={handleParseMedication} className="space-y-4">
              <textarea
                rows={4}
                value={entryInput}
                onChange={(e) => setEntryInput(e.target.value)}
                placeholder="Example: Take Metformin 500mg once every morning with breakfast around 8am. The bottle contains 60 tablets."
                className="w-full text-base p-4 rounded-xl border-2 border-slate-300 focus:border-sky-600 focus:outline-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium">Try example:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEntryInput(
                        "Lisinopril 10 mg once daily at 9am with water. 30 tablets remaining."
                      )
                    }
                    className="text-xs text-sky-700 hover:text-sky-900 font-bold underline"
                  >
                    Daily blood pressure
                  </button>
                  <span className="text-xs text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEntryInput(
                        "Calcium plus Vitamin D, 2 softgels every Monday, Wednesday, and Friday at 12:00 PM after lunch."
                      )
                    }
                    className="text-xs text-sky-700 hover:text-sky-900 font-bold underline"
                  >
                    Specific weekdays
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={entryLoading || !entryInput.trim()}
                  className="flex items-center space-x-2 px-6 py-3 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-sky-400"
                >
                  {entryLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Extracting Details...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-amber-300" />
                      <span>Extract Draft Data</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {entryError && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 font-bold flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span>{entryError}</span>
              </div>
            )}
          </div>

          {/* Draft Preview & Review Card */}
          {parsedDraft && (
            <div className="bg-sky-50 rounded-2xl p-6 sm:p-8 border-2 border-sky-400 shadow-md space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-200 pb-4">
                <div className="flex items-center space-x-2 text-sky-950">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-2xl font-black">
                    Extracted Draft Prescription
                  </h3>
                </div>
                <span className="text-xs font-bold text-sky-800 bg-white px-3 py-1 rounded-full border border-sky-300 uppercase">
                  Pending Your Review
                </span>
              </div>

              {parsedDraft.confidenceNotes && (
                <p className="text-sm font-semibold text-slate-700">
                  {parsedDraft.confidenceNotes}
                </p>
              )}

              {/* Field Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-sky-200 space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase block">
                    Medication Name
                  </span>
                  <span className="text-xl font-bold text-slate-900 block">
                    {parsedDraft.name || (
                      <span className="text-amber-600 italic">Not specified</span>
                    )}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-sky-200 space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase block">
                    Dosage
                  </span>
                  <span className="text-xl font-bold text-slate-900 block">
                    {parsedDraft.dosage || (
                      <span className="text-amber-600 italic">Not specified</span>
                    )}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-sky-200 space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase block">
                    Frequency & Times
                  </span>
                  <span className="text-base font-bold text-slate-900 block">
                    {parsedDraft.scheduleType === "DAILY" ? "Every Day" : "Specific Days"} at{" "}
                    {parsedDraft.reminderTimes.map(formatTime12h).join(", ")}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-sky-200 space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase block">
                    Initial Stock Count
                  </span>
                  <span className="text-base font-bold text-slate-900 block">
                    {parsedDraft.stock !== null
                      ? `${parsedDraft.stock} doses`
                      : "Not specified"}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              {parsedDraft.instructions && (
                <div className="bg-white p-4 rounded-xl border border-sky-200">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Special Instructions
                  </span>
                  <p className="text-slate-800 text-base font-medium">
                    {parsedDraft.instructions}
                  </p>
                </div>
              )}

              {/* Missing fields notification */}
              {parsedDraft.missingFields && parsedDraft.missingFields.length > 0 && (
                <div className="p-3 bg-amber-100 border border-amber-300 rounded-xl text-amber-900 text-sm">
                  <strong>Please note:</strong> The following fields were not in your note and can be filled during review:{" "}
                  {parsedDraft.missingFields.join(", ")}.
                </div>
              )}

              {/* Review & Confirm Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-sky-200">
                <span className="text-sm font-semibold text-slate-700">
                  Review and make any adjustments on the standard form before saving to database.
                </span>

                <button
                  onClick={handleApplyDraftToForm}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-base rounded-xl shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-400"
                >
                  <span>Review & Save to Schedule</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
