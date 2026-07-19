"use client";

export default function MobileToday() {
  return (
    <section className="mobile-page mobile-placeholder-page">
      <div className="mobile-page-heading">
        <span>DAILY OPERATIONS</span>
        <h2>Today</h2>
        <p>One view for arrivals, departures and room activity across all properties.</p>
      </div>

      <div className="mobile-coming-soon-card">
        <div className="mobile-coming-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
        </div>

        <span>COMING SOON</span>
        <h3>Today’s Operations</h3>
        <p>
          Total arrivals, departures, in-house guests, room blocks and
          property-level activity will appear here.
        </p>

        <div className="mobile-preview-grid">
          <div>
            <strong>—</strong>
            <span>Arrivals</span>
          </div>
          <div>
            <strong>—</strong>
            <span>Departures</span>
          </div>
          <div>
            <strong>—</strong>
            <span>In House</span>
          </div>
          <div>
            <strong>—</strong>
            <span>Room Blocks</span>
          </div>
        </div>
      </div>
    </section>
  );
}
