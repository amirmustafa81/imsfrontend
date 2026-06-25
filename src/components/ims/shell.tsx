"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthBypassEnabled, useAuth } from "@/lib/auth";

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

type NotificationPreview = {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
};

const NAV_GROUPS: SidebarGroup[] = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", href: "/", icon: "bi-speedometer2" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Item Master", href: "/items", icon: "bi-box" },
      { label: "Receipts (GRN)", href: "/inventory-receipts", icon: "bi-truck" },
      { label: "Stock Balances", href: "/stock", icon: "bi-stack" },
      { label: "Issue / Return / Transfer", href: "/issues-returns", icon: "bi-arrow-left-right" },
    ],
  },
  {
    title: "Assets",
    items: [
      { label: "Fixed Asset Register", href: "/assets", icon: "bi-tags" },
      { label: "Tag Print Log", href: "/tag-print-log", icon: "bi-qr-code" },
    ],
  },
  {
    title: "Specialized",
    items: [
      { label: "Project Inventory", href: "/projects", icon: "bi-journal-text" },
      { label: "Laboratory Inventory", href: "/lab", icon: "bi-eyedropper" },
      { label: "IT Assets", href: "/it-assets", icon: "bi-pc-display-horizontal" },
      { label: "Controlled Stationery", href: "/controlled-stationery", icon: "bi-journal-check" },
    ],
  },
  {
    title: "Compliance",
    items: [
      { label: "Physical Verification", href: "/verification", icon: "bi-clipboard-check" },
      { label: "Disposal / Write-Off", href: "/disposals", icon: "bi-trash3" },
      { label: "Asset Investigations", href: "/asset-investigations", icon: "bi-search" },
      { label: "Maintenance Records", href: "/maintenance-records", icon: "bi-tools" },
      { label: "Asset Movements", href: "/asset-movements", icon: "bi-arrow-up-right-circle" },
      { label: "Audit Log", href: "/audit-logs", icon: "bi-shield-check" },
    ],
  },
  {
    title: "Reports & Docs",
    items: [
      { label: "Reports", href: "/reports", icon: "bi-bar-chart" },
      { label: "Export History", href: "/export-history", icon: "bi-cloud-arrow-up" },
      { label: "Documents", href: "/documents", icon: "bi-folder2-open" },
      { label: "ERP Sync Logs", href: "/erp-sync-logs", icon: "bi-arrow-repeat" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Master Data", href: "/master-data", icon: "bi-database-gear" },
      { label: "ERP Import", href: "/import", icon: "bi-upload" },
      { label: "Depreciation", href: "/depreciation", icon: "bi-percent" },
      { label: "Stock Movements", href: "/transfers", icon: "bi-diagram-3" },
      { label: "System Settings", href: "/system-settings", icon: "bi-gear" },
      { label: "User Delegations", href: "/user-delegations", icon: "bi-person-check" },
      { label: "Users", href: "/users", icon: "bi-people" },
      { label: "Roles", href: "/roles", icon: "bi-shield-lock" },
    ],
  },
];

export function ImsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isLoginPage = pathname === "/login";
  const isActive = (href: string) => pathname === href;

  const roleLabel = user?.roles?.[0]?.name ?? "User";
  const userName = user?.name ?? "User";
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  useEffect(() => {
    if (!isAuthBypassEnabled && !loading && !isAuthenticated && !isLoginPage) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoginPage, loading, router]);

  const loadNotifications = useCallback(async () => {
    if (loading || !isAuthenticated) return;

    setNotificationLoading(true);
    try {
      const [listResponse, countResponse] = await Promise.all([
        api.get<{ data: NotificationPreview[] }>("/notifications", {
          params: { is_read: "0" },
        }),
        api.get<{ unread_count: number }>("/notifications/unread-count"),
      ]);

      setNotifications((listResponse.data?.data ?? []).slice(0, 5));
      setUnreadCount(Number(countResponse.data?.unread_count ?? 0));
      setNotificationError("");
    } catch {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationError("Unable to load notifications.");
    } finally {
      setNotificationLoading(false);
    }
  }, [isAuthenticated, loading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  const handleLogout = useCallback(async () => {
    await logout();
    if (isAuthBypassEnabled) {
      router.replace("/");
      return;
    }

    router.replace("/login");
  }, [logout, router]);

  const openNotifications = () => {
    setAccountOpen(false);
    setNotificationOpen((current) => !current);
    void loadNotifications();
  };

  const markAllNotificationsRead = async () => {
    if (loading || !isAuthenticated) return;

    try {
      await api.post("/notifications/read-all", {});
      await loadNotifications();
    } catch {
      setNotificationError("Unable to mark notifications as read.");
    }
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isAuthBypassEnabled && (loading || !isAuthenticated)) {
    return (
      <main className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <div className="fw-semibold">Loading IMS workspace...</div>
        </div>
      </main>
    );
  }

  return (
    <div className="ims-shell min-vh-100 text-body">
      <aside className={`ims-sidebar ${collapsed ? "is-collapsed" : ""}`}>
        <Link className="ims-sidebar-brand text-decoration-none" href="/">
          <i className="bi bi-buildings fs-3" />
          <span className="ims-sidebar-brand-text">
            <span className="fw-bold d-block lh-sm">UoH IMS</span>
            <span className="d-block small">Inventory Management</span>
          </span>
        </Link>

        <nav className="ims-sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="ims-nav-group" key={group.title}>
              <div className="ims-nav-title">{group.title}</div>
              <div className="list-group list-group-flush">
                {group.items.map((item) => (
                  <Link
                    href={item.href}
                    className={`ims-nav-link list-group-item list-group-item-action border-0 d-flex align-items-center gap-2 ${
                      isActive(item.href) ? "active" : ""
                    }`}
                    key={item.label}
                    title={item.label}
                  >
                    <i className={`bi ${item.icon}`} />
                    <span className="ims-nav-label text-truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="ims-main">
        <header className="ims-topbar">
          <div className="d-flex align-items-center gap-3 flex-grow-1">
            <button
              className="btn btn-outline-secondary ims-icon-button"
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              aria-label="Toggle navigation"
            >
              <i className="bi bi-list" />
            </button>
            <div className="input-group ims-global-search">
              <span className="input-group-text bg-white">
                <i className="bi bi-search" />
              </span>
              <input className="form-control" placeholder="Search items, assets, tags, GRN..." />
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="ims-notification-menu position-relative">
              <button
                className="btn btn-outline-secondary ims-icon-button position-relative"
                type="button"
                aria-label="Notifications"
                aria-expanded={notificationOpen}
                aria-haspopup="menu"
                onClick={openNotifications}
              >
                <i className="bi bi-bell" />
                {unreadCount > 0 ? (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationOpen ? (
                <div className="ims-notification-dropdown shadow-lg" role="menu">
                  <div className="d-flex align-items-start justify-content-between gap-3 px-3 py-3 border-bottom">
                    <div>
                      <div className="fw-bold">Notifications</div>
                      <div className="small text-secondary">{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</div>
                    </div>
                    <Link className="small fw-semibold text-decoration-none" href="/notifications" onClick={() => setNotificationOpen(false)}>
                      View all
                    </Link>
                  </div>

                  <div className="ims-notification-list">
                    {notificationLoading ? (
                      <div className="px-3 py-4 text-center small text-secondary">
                        <span className="spinner-border spinner-border-sm me-2" role="status" />
                        Loading notifications...
                      </div>
                    ) : notificationError ? (
                      <div className="px-3 py-4 small text-danger">{notificationError}</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-3 py-4 text-center small text-secondary">
                        <i className="bi bi-check2-circle d-block fs-4 mb-1 text-success" />
                        No unread notifications.
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <Link
                          className="ims-notification-item text-decoration-none"
                          href="/notifications"
                          key={notification.id}
                          onClick={() => setNotificationOpen(false)}
                        >
                          <span className="ims-notification-dot" />
                          <span className="min-w-0">
                            <span className="d-block fw-semibold text-body text-truncate">{notification.title}</span>
                            <span className="d-block small text-secondary text-truncate">{notification.message}</span>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>

                  {unreadCount > 0 ? (
                    <button className="ims-notification-action" type="button" onClick={markAllNotificationsRead}>
                      <i className="bi bi-check2-all" />
                      Mark all as read
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="ims-account-menu position-relative">
              <button
                className="ims-user-menu btn border-0 d-flex align-items-center gap-2"
                type="button"
                onClick={() => {
                  setNotificationOpen(false);
                  setAccountOpen((current) => !current);
                }}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <span className="ims-avatar">{initials}</span>
                <span className="text-start lh-sm">
                  <span className="fw-semibold d-block">{userName}</span>
                  <span className="small text-secondary">{roleLabel}</span>
                </span>
                <i className={`bi bi-chevron-${accountOpen ? "up" : "down"} small text-secondary`} />
              </button>

              {accountOpen ? (
                <div className="ims-account-dropdown shadow-lg" role="menu">
                  <div className="d-flex align-items-center gap-2 px-3 py-3 border-bottom">
                    <span className="ims-avatar ims-avatar-lg">{initials}</span>
                    <div className="min-w-0">
                      <div className="fw-semibold text-truncate">{userName}</div>
                      <div className="small text-secondary text-truncate">{roleLabel}</div>
                    </div>
                  </div>

                  <button className="ims-account-action text-danger" type="button" role="menuitem" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="ims-content">
          {children}
        </div>
      </div>
    </div>
  );
}
