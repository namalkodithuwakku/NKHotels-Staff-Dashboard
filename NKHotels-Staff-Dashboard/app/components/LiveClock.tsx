"use client";

import { useEffect, useState } from "react";

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function LiveClock() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setMounted(true);

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="live-clock">
      <span>{greeting(now.getHours())}</span>

      <strong>
        {now.toLocaleTimeString("en-LK", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })}
      </strong>

      <small>
        {now.toLocaleDateString("en-LK", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        })}
      </small>
    </div>
  );
}