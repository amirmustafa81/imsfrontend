"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { usePathname } from "next/navigation";

type SidebarItem = {
  label: string;
  href: string;
  icon: string;
  planned?: boolean;
};

type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

const NAV_GROUPS: SidebarGroup[] = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", href: "/", icon: "bi-speedometer2" },
      { label: "Issue / Return / Transfer", href: "/issues-returns", icon: "bi-arrow-left-right" },
      { label: "Audit Logs", href: "/audit-logs", icon: "bi-journal-text" },
      { label: "Reports", href: "/reports", icon: "bi-graph-up" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Inventory Receipt", href: "/inventory-receipts", icon: "bi-receipt" },
      { label: "Item Master", href: "/items", icon: "bi-box-seam", planned: true },
      { label: "Stock Balances", href: "/stock", icon: "bi-boxes", planned: true },
      { label: "Controlled Stationery", href: "/controlled-stationery", icon: "bi-journal-check" },
    ],
  },
  {
    title: "Assets",
    items: [
      { label: "Fixed Assets", href: "/assets", icon: "bi-layers" },
      { label: "Tag Print Queue", href: "/tag-print-log", icon: "bi-printer", planned: true },
      { label: "Disposal", href: "/disposals", icon: "bi-trash" },
      { label: "Depreciation", href: "/depreciation", icon: "bi-percent" },
    ],
  },
  {
    title: "Specialized",
    items: [
      { label: "Project Inventory", href: "/projects", icon: "bi-folder2-open", planned: true },
      { label: "Laboratory Inventory", href: "/lab", icon: "bi-flask", planned: true },
      { label: "IT Assets", href: "/it-assets", icon: "bi-pc-display", planned: true },
      { label: "Physical Verification", href: "/verification", icon: "bi-check2-square" },
    ],
  },
  {
    title: "Compliance",
    items: [
      { label: "Write Off", href: "/disposals", icon: "bi-clipboard-check" },
      { label: "Stock Movements", href: "/transfers", icon: "bi-diagram-3" },
    ],
  },
  {
    title: "Admin",
    items: [{ label: "Master Data", href: "/master-data", icon: "bi-database-gear" }],
  },
  {
    title: "System",
    items: [
      { label: "Import", href: "/import", icon: "bi-upload", planned: true },
      { label: "Export History", href: "/export-history", icon: "bi-cloud-arrow-up", planned: true },
    ],
  },
];

export function ImsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [department, setDepartment] = useState("Information Technology");

  const isActive = (href: string) => pathname === href;

  const roleLabel = "Procurement Officer";
  const userName = "IMS Operator";

  return (
    <div className="min-vh-100 bg-body-tertiary text-body">
      <header className="bg-white border-bottom px-3 py-2">
        <div className="d-flex align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              type="button"
              onClick={() => setCollapsed((current) => !current)}
            >
              <i className="bi bi-list" />
            </button>
            <Link className="d-flex align-items-center gap-2 text-decoration-none" href="/">
              <i className="bi bi-box-seam text-primary fs-5" />
              <span className="fw-semibold">UOH IMS</span>
            </Link>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="small text-secondary">{userName}</div>
            <span className="badge text-bg-light text-dark border">{roleLabel}</span>

            <select
              className="form-select form-select-sm"
              style={{ width: 220 }}
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option>Information Technology</option>
              <option>Finance</option>
              <option>Academic</option>
              <option>Research</option>
            </select>

            <button className="btn btn-sm btn-outline-secondary" type="button">
              <i className="bi bi-bell" />
            </button>
            <button className="btn btn-sm btn-outline-secondary" type="button">
              <i className="bi bi-search" />
            </button>
          </div>
        </div>
      </header>

      <div className="d-flex">
        <aside
          className="bg-white border-end"
          style={{ width: collapsed ? 72 : 250, minHeight: "calc(100vh - 57px)" }}
        >
          <div className="p-2">
            {NAV_GROUPS.map((group) => (
              <div className="mb-2" key={group.title}>
                <div className="small text-uppercase text-secondary fw-semibold px-2 py-1">{group.title}</div>
                <div className="list-group list-group-flush">
                  {group.items.map((item) =>
                    item.planned ? (
                      <div
                        className="list-group-item list-group-item-action border-0 px-2 py-2 d-flex align-items-center gap-2 opacity-75"
                        key={item.label}
                      >
                        <i className={`bi ${item.icon} text-secondary`} />
                        <span className="small text-truncate" title={item.label}>
                          {item.label}
                          <span className="badge text-bg-warning ms-1">Planned</span>
                        </span>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className={`list-group-item list-group-item-action border-0 px-2 py-2 d-flex align-items-center gap-2 ${
                          isActive(item.href) ? "active text-bg-primary text-white" : ""
                        }`}
                        key={item.label}
                      >
                        <i className={`bi ${item.icon}`} />
                        <span className="small text-truncate">{item.label}</span>
                      </Link>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-grow-1">
          {children}
        </main>
      </div>
    </div>
  );
}
