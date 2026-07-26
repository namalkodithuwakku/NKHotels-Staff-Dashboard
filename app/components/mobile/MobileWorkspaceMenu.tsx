"use client";

import { useState } from "react";
import { Grid2X2, LogOut, X } from "lucide-react";

type Item = { key: string; label: string; short?: string };

export default function MobileWorkspaceMenu({
  items,
  primaryKeys,
  activeKey,
  counts = {},
  onSelect,
  onLogout,
}: {
  items: Item[];
  primaryKeys: string[];
  activeKey: string;
  counts?: Record<string, number | undefined>;
  onSelect: (key: string) => void;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const primary = primaryKeys.map(key => items.find(item => item.key === key)).filter(Boolean) as Item[];
  const more = items.filter(item => !primaryKeys.includes(item.key));
  const moreActive = more.some(item => item.key === activeKey);

  function choose(key: string) {
    onSelect(key);
    setOpen(false);
  }

  return <>
    <nav className="staff-mobile-nav pwa-mobile-nav" aria-label="Mobile workspace">
      {primary.map(item => <button key={item.key} className={activeKey === item.key ? "active" : ""} onClick={() => choose(item.key)}>
        <span className={`nav-mark nav-${item.key}`} />
        <small>{item.short || item.label.split(" ")[0]}</small>
        {Boolean(counts[item.key]) && <b>{counts[item.key]}</b>}
      </button>)}
      <button className={moreActive || open ? "active" : ""} onClick={() => setOpen(true)}>
        <Grid2X2 className="pwa-more-icon" aria-hidden="true" />
        <small>More</small>
        {more.some(item => Boolean(counts[item.key])) && <b>•</b>}
      </button>
    </nav>
    {open && <div className="mobile-more-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="mobile-more-sheet" onMouseDown={event => event.stopPropagation()}>
        <header><div><small>NKH DASHBOARD</small><h2>More tools</h2></div><button onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></header>
        <div className="mobile-more-grid">{more.map(item => <button key={item.key} className={activeKey === item.key ? "active" : ""} onClick={() => choose(item.key)}>
          <span className={`nav-mark nav-${item.key}`} />
          <strong>{item.label}</strong>
          {Boolean(counts[item.key]) && <b>{counts[item.key]}</b>}
        </button>)}</div>
        {onLogout && <button className="mobile-more-logout" onClick={onLogout}>
          <LogOut size={17} aria-hidden="true" />
          Log out
        </button>}
      </section>
    </div>}
  </>;
}
