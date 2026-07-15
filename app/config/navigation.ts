export type NavItem = {
  label: string;
  href: string;
};

export function getNavigation(access?: string): NavItem[] {
  const level = String(access || "Team").trim().toLowerCase();

  if (level === "master") {
    return [
      { label: "Operations", href: "/" },
      { label: "Company Task Center", href: "/tasks" },
      { label: "Task Scheduler", href: "/scheduler" },
      { label: "Properties", href: "/properties" },
      { label: "Team", href: "/team" },
      { label: "AI Center", href: "/ai" },
      { label: "Reports", href: "/reports" },
      { label: "Settings", href: "/settings" },
    ];
  }

  if (level === "supervisor") {
    return [
      { label: "Operations", href: "/" },
      { label: "Company Task Center", href: "/tasks" },
      { label: "Task Scheduler", href: "/scheduler" },
      { label: "Team", href: "/team" },
      { label: "Shift Report", href: "/reports" },
    ];
  }

  return [
    { label: "Operations", href: "/" },
    { label: "My Tasks", href: "/" },
    { label: "Quick Action", href: "/" },
    { label: "My Performance", href: "/performance" },
  ];
}