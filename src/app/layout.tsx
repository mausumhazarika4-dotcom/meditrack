import type { Metadata } from "next";
import "./globals.css";
import { ReminderProvider } from "@/context/ReminderContext";
import Navbar from "@/components/Navbar";
import ReminderBanner from "@/components/ReminderBanner";
import MedicalDisclaimer from "@/components/MedicalDisclaimer";

export const metadata: Metadata = {
  title: "MediTrack — Smart Medicine Reminder",
  description:
    "Accessible, reliable medication tracking and schedule reminders for seniors and daily health management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-sky-200">
        <ReminderProvider>
          <Navbar />
          <ReminderBanner />
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8">
            {children}
          </main>
          <MedicalDisclaimer />
        </ReminderProvider>
      </body>
    </html>
  );
}
