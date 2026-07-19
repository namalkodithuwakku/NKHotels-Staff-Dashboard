"use client";

type MobilePerformanceProps = {
  stats: any;
  performance: any;
};

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export default function MobilePerformance({
  stats,
  performance,
}: MobilePerformanceProps) {
  const cards = [
    {
      label: "Completion",
      value: `${number(performance?.completionRate ?? stats?.completionRate)}%`,
      note: "Current shift",
    },
    {
      label: "On Time",
      value: `${number(performance?.onTimeRate ?? stats?.onTimeRate)}%`,
      note: "Within target",
    },
    {
      label: "Completed",
      value: number(stats?.completed),
      note: "Visible period",
    },
    {
      label: "Backlog",
      value: number(performance?.backlogTasks ?? stats?.backlogTasks),
      note: "Shift carry-over",
    },
  ];

  return (
    <section className="mobile-page">
      <div className="mobile-page-heading">
        <span>PERSONAL PROGRESS</span>
        <h2>Performance</h2>
        <p>Your current shift and recent operational performance.</p>
      </div>

      <div className="mobile-performance-grid">
        {cards.map((card) => (
          <article key={card.label} className="mobile-performance-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </div>

      <article className="mobile-insight-card">
        <div>
          <span>SHIFT INSIGHT</span>
          <h3>Stay focused on open work</h3>
          <p>
            Complete urgent and active tasks first. Finished work remains
            available below the live queue.
          </p>
        </div>
        <div className="mobile-insight-orb" />
      </article>
    </section>
  );
}
