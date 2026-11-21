import React from "react";
import { Info } from "lucide-react";

export default function MedicalDisclaimer() {
  return (
    <footer className="mt-12 py-6 border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-start space-x-3 bg-white p-4 rounded-xl border border-slate-200">
          <Info className="w-6 h-6 text-sky-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="font-bold text-slate-900 block mb-1">
              Important Health Notice
            </strong>
            MediTrack helps track medication schedules. It does not provide
            medical advice. Follow your prescription and consult a healthcare
            professional about missed doses or medication changes.
          </p>
        </div>
      </div>
    </footer>
  );
}
