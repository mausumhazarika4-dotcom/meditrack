# MediTrack — Smart Medicine Reminder

MediTrack is an accessible, reliable, offline-first web application designed to help users—especially elderly people and caregivers—organize, manage, and track daily medication schedules.

Built for hackathons and real-world daily use, it prioritizes reliable data persistence, exact stock tracking, transactional consistency, and accessible UI with high-contrast text and keyboard focus states.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router, React 18, TypeScript)
- **Database**: PostgreSQL with Prisma ORM (Prisma Postgres on Vercel); local development can use a separate PostgreSQL database
- **Styling & Accessibility**: Tailwind CSS with custom elderly-friendly Large Text mode and visible focus indicators
- **Icons**: Lucide React
- **Audio Alerts**: Web Audio API melodic reminder chime (zero external audio file dependencies)
- **Testing**: Vitest with comprehensive integration and domain test suite

---

## Quick Start & Setup

### 1. Prerequisites
- Node.js (v18+ recommended; tested on v24)
- `pnpm` or `npm`

### 2. Installation
Install the project dependencies:
```bash
pnpm install
# or: npm install
```

### 3. Database Setup
The production schema uses PostgreSQL. Set `DATABASE_URL` to a PostgreSQL connection string before initializing the schema:
```bash
pnpm db:push
pnpm db:generate
```
On Vercel, the Prisma Postgres integration provides `DATABASE_URL` (direct connection) and `DATABASE_URL_POOLED` (pooled application connection). The Vercel build script runs `prisma db push` against the direct `DATABASE_URL` before building. The Prisma client uses `DATABASE_URL_POOLED` for application traffic when available.

### 4. Running the Development Server
```bash
pnpm dev
# or: npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running the Automated Tests
```bash
pnpm test
# or: npx vitest run
```

### 6. Production Build & Run
To compile an optimized production build and run it locally:
```bash
pnpm build
pnpm start
```

---

## Core Features Implemented

1. **Today's Schedule & Dashboard (`/`)**:
   - Shows today's full date and app timezone.
   - Live summary counts: Total Scheduled, Taken, Skipped, Missed, and Remaining (Upcoming + Due).
   - Time-ordered dose cards displaying medication name, dosage snapshot, reminder time, special food instructions, and stock status.
   - Quick action buttons: **Mark as Taken**, **Skip**, **Snooze 10m**, and **Undo** (idempotent; restores stock and resets status).
   - Clear empty states with one-click actions to add a medication or load demo data.

2. **Add & Edit Medications (`/medications/new`, `/medications/[id]/edit`)**:
   - Required medication name and dosage text.
   - Flexible schedules: "Every Day" or "Selected Days of Week" (Mon, Tue, Wed, Thu, Fri, Sat, Sun).
   - Multiple reminder times per active day with duplicate time rejection.
   - Start date (defaults to today) and optional end date validation.
   - Inventory tracking: remaining doses and customizable low-stock alert threshold.
   - Prospective schedule updates: editing a medication never rewrites historical dose records or erases completed logs.

3. **Medication List & Inventory (`/medications`, `/medications/[id]`)**:
   - Tabbed view for Active and Archived medications.
   - Visual low-stock badges when remaining doses fall to or below the configured threshold.
   - Quick Refill action to add stock (transactionally logged with balance history).
   - Safe Archiving with confirmation: stops future scheduled doses while strictly preserving past dose history.

4. **History & Adherence Engine (`/history`)**:
   - Date range filtering (with "Last 7 Days" and "Last 30 Days" shortcuts).
   - Medication and status (Taken, Skipped, Missed) filters.
   - Pure adherence calculation:
     $$\text{Adherence Rate} = \frac{\text{Taken Doses}}{\text{Eligible Scheduled Doses}} \times 100$$
   - Eligible doses include Taken, Skipped, and Missed (>60m overdue).
   - Future doses and doses still within their 60-minute grace period are strictly excluded unless already marked taken/skipped.
   - If no completed dose opportunities exist in the selected range, displays `"No completed dose opportunities yet"` instead of a misleading 0% or NaN.

5. **In-App & Browser Reminders**:
   - High-contrast banner appears at the top of every page whenever a dose is currently DUE.
   - One-click browser notification request (Notification API).
   - Optional gentle reminder chime (Web Audio API synth) with user toggle.
   - 10-minute snooze button that persists across page refreshes and tab switches.
   - Duplicate alert prevention prevents repeated chimes/notifications for the same dose.
   - Auto-checks reminders periodically (every 25 seconds) and on page focus / tab visibility change.

6. **Stock Tracking & Consistency**:
   - Stock is counted in remaining scheduled doses.
   - Marking a dose taken decrements stock by 1 inside an atomic database transaction.
   - Undoing a taken dose restores stock by 1 inside an atomic transaction.
   - Skipping a dose does not reduce stock.
   - Stock cannot go negative.
   - Refills record transactional audit rows (`StockAdjustment`).

7. **Accessibility & Settings (`/settings`)**:
   - Elderly-friendly Large Text toggle (boosts base typography to 19px+ with high-contrast borders and large touch targets).
   - Keyboard accessible with distinct `:focus-visible` outline rings.
   - Explicit timezone selection and persistence.
   - Interactive Demo Data loader and cleaner (only cleans demo records, preserving user data).

---

## Scheduling & Timezone Assumptions

- **Explicit Timezone Handling**: The app defaults to the browser's local timezone (e.g. `Asia/Kolkata`, `America/New_York`) and persists it in `AppSettings`. Doses are calculated using local date boundaries (`YYYY-MM-DD`) and converted to absolute UTC timestamps.
- **Grace Period**: 60 minutes after scheduled reminder time. During this hour, a dose is marked **DUE**.
- **Missed Doses**: More than 60 minutes past scheduled time with no recorded taken or skipped action is marked **MISSED**. *Missed is a tracking label, not medical advice.*
- **Idempotent Occurrence Generation**: Unique compound database constraint `[medicationId, scheduledTime]` guarantees that generating doses repeatedly or refreshing pages never creates duplicate records.

---

## Reminder Limitations

- **MVP Environment**: Reminders, chimes, and browser notifications operate **while the web application remains open in a browser tab**.
- Because this is an offline-first single-user application without third-party push notification services or paid cloud infrastructure, notifications cannot wake up a computer that is shut down or asleep. Settings clearly inform the user of this limitation.
- If browser desktop notifications are denied or unsupported, all in-app banners and audible chimes remain completely functional.

---

## Medical Disclaimer

> **MediTrack helps track medication schedules. It does not provide medical advice. Follow your prescription and consult a healthcare professional about missed doses or medication changes.**


## Vercel deployment notes

- Required server environment variables: `DATABASE_URL`, `DATABASE_URL_POOLED`, and `GEMINI_API_KEY`.
- `DATABASE_URL` is the direct Prisma Postgres connection used by Prisma CLI/schema synchronization.
- `DATABASE_URL_POOLED` is used by the app at runtime to avoid opening too many direct database connections.
- `GEMINI_API_KEY` must remain server-side and must never use a `NEXT_PUBLIC_` prefix.
- The `vercel-build` script synchronizes the Prisma schema with `prisma db push` and then runs `next build`.
- This MVP currently has no authentication or per-user data isolation. Do not store real medication or health information in a publicly accessible deployment; use demo data until access control is implemented.
