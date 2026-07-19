"use client";

import { useState } from "react";

export default function ScheduledTasks({ onCreate }: { onCreate: () => void }) {
  const [tab, setTab] = useState("Today"); const tabs = ["Today", "Tomorrow", "This Week", "Later", "Recurring"];
  return <div className="scheduled-workspace"><div className="workspace-tools"><div className="segmented">{tabs.map(x => <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>{x}</button>)}</div><button className="primary-action" onClick={onCreate}>＋ Schedule Task</button></div><div className="workspace-empty scheduled-empty"><span>◷</span><strong>No scheduled work for {tab.toLowerCase()}</strong><p>Future and recurring work stays here until it becomes relevant to the shift.</p><button onClick={onCreate}>Create scheduled task</button></div><div className="safety-note"><strong>Safe release behavior</strong><p>The existing scheduler API remains unchanged. Automatic due-task transfer should be connected only after its Apps Script execution history and duplicate protection are verified.</p></div></div>;
}
