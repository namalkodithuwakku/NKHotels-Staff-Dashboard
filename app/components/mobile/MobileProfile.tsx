"use client";

import ThemeSwitcher from "../theme/ThemeSwitcher";

type MobileProfileProps = {
  staff: any;
  shift: any;
  onLogout: () => void;
};

export default function MobileProfile({
  staff,
  shift,
  onLogout,
}: MobileProfileProps) {
  const role = staff?.role || staff?.access || "Team";
  const shiftLabel = shift?.shift || "No active shift";
  const nextShift = shift?.nextShift || "Not scheduled";

  return (
    <section className="mobile-page">
      <div className="mobile-profile-hero">
        <div className="mobile-profile-avatar">
          {String(staff?.name || "N").slice(0, 1).toUpperCase()}
        </div>

        <div>
          <span>TEAM PROFILE</span>
          <h2>{staff?.name || "Team Member"}</h2>
          <p>{role}</p>
        </div>
      </div>

      <div className="mobile-profile-list">
        <article>
          <span>Current status</span>
          <strong>{shift?.status || "Checking"}</strong>
        </article>

        <article>
          <span>Current shift</span>
          <strong>{shiftLabel}</strong>
        </article>

        <article>
          <span>Next shift</span>
          <strong>{nextShift}</strong>
        </article>

        <article className="mobile-theme-row">
          <div>
            <span>Appearance</span>
            <strong>Day / Night theme</strong>
          </div>
          <ThemeSwitcher />
        </article>
      </div>

      <button type="button" className="mobile-logout-button" onClick={onLogout}>
        Log out
      </button>

      <p className="mobile-version">N K Hotel OS · Version 1.0</p>
    </section>
  );
}
