"use client";

import { useEffect, useState } from "react";

export type StaffSession = {
  name: string;
  role: string;
  whatsapp: string;
  access: string;
};

const STORAGE_KEY = "NKH_STAFF_SESSION";

export function useAuth() {
  const [staff, setStaff] = useState<StaffSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        setStaff(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    setReady(true);
  }, []);

  function login(staffData: StaffSession) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staffData));
    setStaff(staffData);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setStaff(null);
  }

  return { staff, ready, login, logout };
}