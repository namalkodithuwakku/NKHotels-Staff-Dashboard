"use client";

import { useEffect, useState } from "react";

export type ShiftInfo = {
  staff: string;
  status: string;
  active: boolean;
  canWork: boolean;
  shift: string;
  scheduledStart: string;
  scheduledEnd: string;
  nextShift: string;
  stats?: {
    assigned: number;
    started: number;
    completed: number;
    pending: number;
    completionRate: number;
    avgResponseMin: number;
  };
};

export function useShift(staffName?: string) {
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadShift() {
    if (!staffName) return;

    try {
      const res = await fetch(`/api/shift?staff=${encodeURIComponent(staffName)}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        setShift(data.shift);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShift();
    const timer = setInterval(loadShift, 60000);
    return () => clearInterval(timer);
  }, [staffName]);

  return { shift, loading, reload: loadShift };
}