import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/actions";

type AppShellHeaderProps = {
  activePage: "overview" | "website-health";
  hasRuntimeError?: boolean;
  children?: ReactNode;
};

export function AppShellHeader({
  activePage,
  hasRuntimeError = false,
  children,
}: AppShellHeaderProps) {
  return (
    <header className="dashboard-header">
      <div className="header-brand">
        <div className="brand-icon">DB</div>
        <div>
          <div className="brand-name">System Health Dashboard</div>
          <div className="brand-sub">Pick an area and review it fast</div>
        </div>
      </div>

      <div className="header-right">
        <div className={`status-pill ${hasRuntimeError ? "amber" : "green"}`}>
          <span className="pulse" />
          {hasRuntimeError ? "Connection Issue" : "Supabase Connected"}
        </div>
        <div className="toolbar">
          <Link className={activePage === "overview" ? "button" : "button-secondary"} href="/">
            Overview
          </Link>
          <Link
            className={activePage === "website-health" ? "button" : "button-secondary"}
            href="/website-health"
          >
            Website Health
          </Link>
        </div>
        {children}
        <form action={logoutAction}>
          <button className="button-secondary" type="submit">
            Sign Out
          </button>
        </form>
      </div>
    </header>
  );
}
