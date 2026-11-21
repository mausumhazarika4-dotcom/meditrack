"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Pill, Clock, Settings, Bell, Sparkles } from "lucide-react";
import { useReminders } from "@/context/ReminderContext";

export default function Navbar() {
  const pathname = usePathname();
  const { dueReminders } = useReminders();

  const navItems = [
    { href: "/", label: "Today", icon: Calendar },
    { href: "/medications", label: "Medications", icon: Pill },
    { href: "/history", label: "History & Adherence", icon: Clock },
    { href: "/ai", label: "AI Assistant", icon: Sparkles },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Title */}
          <Link
            href="/"
            className="flex items-center space-x-3 text-brand-700 hover:text-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500 rounded-lg p-1"
          >
            <div className="w-12 h-12 bg-sky-600 text-white rounded-xl flex items-center justify-center font-bold text-2xl shadow-sm">
              <Pill className="w-7 h-7" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900 block leading-tight">
                MediTrack
              </span>
              <span className="text-xs font-semibold text-sky-700 uppercase tracking-wider block">
                Smart Medicine Reminder
              </span>
            </div>
          </Link>

          {/* Navigation links */}
          <nav className="flex space-x-2 sm:space-x-3" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const isToday = item.href === "/";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 sm:px-4 py-2.5 rounded-xl font-bold text-base transition-colors relative focus:outline-none focus:ring-4 focus:ring-brand-500 ${
                    isActive
                      ? "bg-sky-700 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="hidden md:inline">{item.label}</span>
                  {isToday && dueReminders.length > 0 && (
                    <span
                      className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-black leading-none text-white bg-rose-600 rounded-full animate-pulse"
                      title={`${dueReminders.length} dose(s) due right now`}
                    >
                      {dueReminders.length}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
