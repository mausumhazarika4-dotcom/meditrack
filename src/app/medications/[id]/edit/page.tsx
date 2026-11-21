"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MedicationForm from "@/components/MedicationForm";
import { RefreshCw } from "lucide-react";

export default function EditMedicationPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/medications/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.medication);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-800">
          Medication not found
        </h2>
      </div>
    );
  }

  return <MedicationForm initialData={data} isEdit={true} />;
}
