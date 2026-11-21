import fs from "fs";
import path from "path";

// Timeout for Gemini calls (15 seconds)
const GEMINI_TIMEOUT_MS = 15000;
const PRIMARY_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.5-flash";

/**
 * Safely resolves the Gemini API key from process.env or .env.local.
 * Never logs or exposes the key value.
 */
export function getGeminiApiKey(): string {
  let key = process.env.GEMINI_API_KEY?.trim();
  if (key) return key;

  // Fallback to reading .env.local file directly on the server if process.env hasn't loaded it yet
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
      if (match && match[1]) {
        key = match[1].trim().replace(/^["']|["']$/g, "");
        if (key) {
          process.env.GEMINI_API_KEY = key;
          return key;
        }
      }
    }
  } catch (err) {
    // Suppress filesystem errors, don't expose error details
  }

  throw new Error("GEMINI_API_KEY is not configured on the server.");
}

export interface GeminiOptions {
  systemInstruction?: string;
  prompt: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Reusable server-side utility to call Google Gemini API with timeouts,
 * request validation, model fallback, and structured error handling.
 */
export async function callGemini(options: GeminiOptions): Promise<string> {
  const {
    systemInstruction,
    prompt,
    jsonMode = false,
    temperature = 0.3,
    maxTokens = 1000,
  } = options;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Prompt cannot be empty.");
  }

  if (prompt.length > 5000) {
    throw new Error("Prompt exceeds maximum allowed character length (5000).");
  }

  const apiKey = getGeminiApiKey();

  const payload: any = {
    contents: [
      {
        parts: [{ text: prompt.trim() }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (jsonMode) {
    payload.generationConfig.responseMimeType = "application/json";
  }

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const tryCall = async (modelName: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.error?.message || `HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No response received from AI model.");
      }

      return text;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await tryCall(PRIMARY_MODEL);
  } catch (err: any) {
    // If primary model failed with 404 or not found, try fallback
    const msg = String(err?.message || "");
    if (msg.includes("404") || msg.includes("not found") || msg.includes("no longer available")) {
      return await tryCall(FALLBACK_MODEL);
    }
    throw err;
  }
}

/* =======================================================================
   CAPABILITY 1: AI ASSISTANT (Conversational)
   ======================================================================= */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UserScheduleContext {
  todayDateStr: string;
  timezone: string;
  medications: {
    name: string;
    dosage: string;
    instructions: string | null;
    scheduleSummary: string;
    stockRemaining: number | null;
  }[];
  todayDoses: {
    medName: string;
    dosage: string;
    time: string;
    status: string;
  }[];
}

export async function chatWithAssistant(
  history: ChatMessage[],
  newMessage: string,
  context?: UserScheduleContext
): Promise<string> {
  const contextSnippet = context
    ? `
PATIENT'S RECORDED MEDICATIONS & TODAY'S SCHEDULE (GROUND TRUTH):
Current Date: ${context.todayDateStr} (${context.timezone})
Active Prescriptions:
${
  context.medications.length > 0
    ? context.medications
        .map(
          (m) =>
            `- ${m.name} (${m.dosage}): ${m.scheduleSummary}. Notes: ${m.instructions || "None"}. Stock: ${
              m.stockRemaining !== null ? `${m.stockRemaining} doses left` : "Not tracked"
            }`
        )
        .join("\n")
    : "No medications registered yet."
}

Today's Schedule Log:
${
  context.todayDoses.length > 0
    ? context.todayDoses
        .map((d) => `- ${d.time}: ${d.medName} (${d.dosage}) - Status: ${d.status}`)
        .join("\n")
    : "No doses scheduled for today."
}
`
    : "";

  const systemInstruction = `You are "MediTrack Companion", a friendly, caring, and reliable AI assistant integrated into the MediTrack medication reminder web application.
Your goal is to help users—especially elderly patients and caregivers—organize, understand, and adhere to their daily medication schedules.

KEY RULES:
1. Warm, accessible tone: Speak clearly, kindly, with short, easy-to-read paragraphs.
2. Ground truth: Use ONLY the provided medication context to answer questions about their schedule, times, stock, and adherence. Never invent medications or doses that aren't listed.
3. General health information: You may explain general health concepts (e.g., why food is helpful with certain vitamins, the importance of hydration), but:
4. STRICT MEDICAL BOUNDARY:
   - You MUST NEVER diagnose conditions.
   - You MUST NEVER prescribe medications or recommend changing dosages.
   - You MUST NEVER tell a patient to take a double dose to make up for a missed dose.
   - Always include a gentle reminder to consult their doctor or pharmacist for medical decisions.
5. If the user asks you to add or modify a medication, let them know you can help draft it or they can use the "Add Medication" tab.

${contextSnippet}`;

  // Build conversational transcript
  const transcript = history
    .slice(-6) // keep last 6 messages for context
    .map((m) => `${m.role === "user" ? "User" : "MediTrack Companion"}: ${m.content}`)
    .join("\n\n");

  const fullPrompt = transcript
    ? `${transcript}\n\nUser: ${newMessage}\n\nMediTrack Companion:`
    : `User: ${newMessage}\n\nMediTrack Companion:`;

  return await callGemini({
    systemInstruction,
    prompt: fullPrompt,
    temperature: 0.4,
    maxTokens: 800,
  });
}

/* =======================================================================
   CAPABILITY 2: AI INSIGHTS (Adherence & Patterns)
   ======================================================================= */

export interface InsightsData {
  adherencePercentage: number | null;
  displayPercentage: string;
  totalScheduled: number;
  takenCount: number;
  skippedCount: number;
  missedCount: number;
  lowStockMedications: string[];
  activeMedicationsCount: number;
  recentDosesSample: {
    date: string;
    time: string;
    medName: string;
    status: string;
  }[];
}

export async function generateAdherenceInsights(data: InsightsData): Promise<string> {
  const systemInstruction = `You are the MediTrack Insights Engine. Your job is to analyze real patient medication adherence data and provide an encouraging, constructive, and easy-to-read summary for the user and their caregiver.

RULES:
1. Base all insights STRICTLY on the real numbers provided. Never invent doses, adherence rates, or imaginary medicines.
2. Tone: Warm, encouraging, empathetic, and constructive. Never shame or scold for missed or skipped doses.
3. Structure your response into 3 concise bullet sections:
   - 🌟 Adherence Summary (celebrate successes, mention their adherence percentage)
   - 📊 Observation / Timing Patterns (mention patterns like morning vs evening, low stock warnings if applicable)
   - 💡 Practical Tip (a simple habit like pairing with breakfast or water, or refilling low stock)
4. Include a brief one-sentence disclaimer at the very end: "This analysis is informational and not medical advice."`;

  const prompt = `Here is the patient's verified medication adherence data:
- Active Medications: ${data.activeMedicationsCount}
- Adherence Score: ${data.displayPercentage}
- Dose Outcomes: Taken: ${data.takenCount}, Skipped: ${data.skippedCount}, Missed: ${data.missedCount} (Total eligible opportunities: ${data.totalScheduled})
- Low Stock Medications: ${data.lowStockMedications.length > 0 ? data.lowStockMedications.join(", ") : "All stocks sufficient"}
- Recent Doses Log Sample (last 7 days):
${data.recentDosesSample.slice(0, 10).map((d) => `  * ${d.date} at ${d.time}: ${d.medName} [${d.status}]`).join("\n") || "  * No recent records"}

Please generate a helpful, encouraging insights report for this user.`;

  return await callGemini({
    systemInstruction,
    prompt,
    temperature: 0.3,
    maxTokens: 600,
  });
}

/* =======================================================================
   CAPABILITY 3: AI ENTRY (Natural Language Extraction)
   ======================================================================= */

export interface ParsedMedicationDraft {
  name: string | null;
  dosage: string | null;
  instructions: string | null;
  scheduleType: "DAILY" | "SPECIFIC_DAYS";
  daysOfWeek: number[] | null;
  reminderTimes: string[];
  stock: number | null;
  lowStockThreshold: number;
  confidenceNotes: string;
  missingFields: string[];
}

export async function parseMedicationNaturalLanguage(
  inputDescription: string
): Promise<ParsedMedicationDraft> {
  const systemInstruction = `You are a medical data extraction engine for MediTrack.
Your job is to read unstructured, natural-language notes from a user or doctor prescription, and extract structured draft medication fields.

CRITICAL RULES:
1. ONLY extract information explicitly stated or clearly implied by standard conventions (e.g., "morning" -> "08:00", "night" -> "20:00", "twice daily" -> ["08:00", "20:00"]).
2. NEVER guess missing prescription details. If something is unknown (like dosage amount, frequency, or stock), set it to null or empty.
3. Days of week mapping: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.
4. Output MUST be valid JSON adhering strictly to this schema:
{
  "name": string or null,
  "dosage": string or null (e.g. "1 tablet", "500 mg", "10 ml"),
  "instructions": string or null (e.g. "Take after meals with water"),
  "scheduleType": "DAILY" or "SPECIFIC_DAYS",
  "daysOfWeek": array of integers [0-6] or null,
  "reminderTimes": array of "HH:mm" 24-hour strings (e.g. ["08:00"]),
  "stock": integer or null,
  "lowStockThreshold": integer (default 5),
  "confidenceNotes": string explaining what was found,
  "missingFields": array of strings listing required or important fields that the user must still provide or verify (e.g. ["name", "dosage", "reminderTimes"])
}`;

  const prompt = `Extract structured medication draft data from this user text:
"${inputDescription.trim()}"`;

  const rawJson = await callGemini({
    systemInstruction,
    prompt,
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 500,
  });

  try {
    const parsed = JSON.parse(rawJson);
    return {
      name: parsed.name || null,
      dosage: parsed.dosage || null,
      instructions: parsed.instructions || null,
      scheduleType: parsed.scheduleType === "SPECIFIC_DAYS" ? "SPECIFIC_DAYS" : "DAILY",
      daysOfWeek: Array.isArray(parsed.daysOfWeek) ? parsed.daysOfWeek : null,
      reminderTimes: Array.isArray(parsed.reminderTimes) && parsed.reminderTimes.length > 0
        ? parsed.reminderTimes
        : ["08:00"],
      stock: typeof parsed.stock === "number" && parsed.stock >= 0 ? parsed.stock : null,
      lowStockThreshold: typeof parsed.lowStockThreshold === "number" ? parsed.lowStockThreshold : 5,
      confidenceNotes: parsed.confidenceNotes || "Extracted from your notes. Please review before saving.",
      missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [],
    };
  } catch (err) {
    throw new Error("Could not parse structured medication draft from AI output.");
  }
}

/* =======================================================================
   CAPABILITY 4: SMART REMINDERS (Personalized Reminder Copy)
   ======================================================================= */

export interface DoseReminderContext {
  medicationName: string;
  dosage: string;
  reminderTime: string;
  instructions: string | null;
}

export async function generatePersonalizedReminder(
  context: DoseReminderContext
): Promise<string> {
  const systemInstruction = `You are MediTrack's reminder companion.
Generate a warm, friendly, concise 1-sentence reminder for an elderly patient whose medicine is due right now.
RULES:
1. Must be exactly 1 to 2 short sentences.
2. Mention the medication name, dosage, and food/water instructions if any.
3. Be respectful, encouraging, and clear.
4. NEVER change the dose time, dosage amount, or advise taking more medicine.`;

  const prompt = `Medication: ${context.medicationName}
Dosage: ${context.dosage}
Scheduled Time: ${context.reminderTime}
Instructions: ${context.instructions || "None recorded"}`;

  return await callGemini({
    systemInstruction,
    prompt,
    temperature: 0.6,
    maxTokens: 100,
  });
}
