"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthBypassEnabled, useAuth } from "@/lib/auth";
import { formatNotificationType } from "@/lib/notifications";

type SidebarItem = {
  label: string;
  href: string;
  icon: string;
  permissions: string[];
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
      { label: "Dashboard", href: "/", icon: "bi-speedometer2", permissions: ["dashboard.view"] },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Item Master", href: "/items", icon: "bi-box", permissions: ["master-data.view"] },
      { label: "Receipts (GRN)", href: "/inventory-receipts", icon: "bi-truck", permissions: ["inventory-receipts.view"] },
      { label: "Stock Balances", href: "/stock", icon: "bi-stack", permissions: ["stock.view"] },
      { label: "Issue / Return / Transfer", href: "/issues-returns", icon: "bi-arrow-left-right", permissions: ["issues-returns.view"] },
    ],
  },
  {
    title: "Assets",
    items: [
      { label: "Fixed Asset Register", href: "/assets", icon: "bi-tags", permissions: ["assets.view"] },
      { label: "Tag Print Log", href: "/tag-print-log", icon: "bi-qr-code", permissions: ["asset-tags.view"] },
    ],
  },
  {
    title: "Specialized",
    items: [
      { label: "Project Inventory", href: "/projects", icon: "bi-journal-text", permissions: ["research-projects.view"] },
      { label: "Laboratory Inventory", href: "/lab", icon: "bi-eyedropper", permissions: ["inventory-receipts.view", "stock.view"] },
      { label: "IT Assets", href: "/it-assets", icon: "bi-pc-display-horizontal", permissions: ["assets.view"] },
      { label: "Controlled Stationery", href: "/controlled-stationery", icon: "bi-journal-check", permissions: ["controlled-stationery.view"] },
    ],
  },
  {
    title: "Compliance",
    items: [
      { label: "Physical Verification", href: "/verification", icon: "bi-clipboard-check", permissions: ["verification.view"] },
      { label: "Disposal / Write-Off", href: "/disposals", icon: "bi-trash3", permissions: ["disposal.view"] },
      { label: "Asset Investigations", href: "/asset-investigations", icon: "bi-search", permissions: ["audit.view"] },
      { label: "Maintenance Records", href: "/maintenance-records", icon: "bi-tools", permissions: ["maintenance.view"] },
      { label: "Asset Movements", href: "/asset-movements", icon: "bi-arrow-up-right-circle", permissions: ["assets.view", "transfers.view"] },
      { label: "Audit Log", href: "/audit-logs", icon: "bi-shield-check", permissions: ["audit.view"] },
    ],
  },
  {
    title: "Reports & Docs",
    items: [
      { label: "Reports", href: "/reports", icon: "bi-bar-chart", permissions: ["reports.view"] },
      { label: "Export History", href: "/export-history", icon: "bi-cloud-arrow-up", permissions: ["reports.export"] },
      { label: "Documents", href: "/documents", icon: "bi-folder2-open", permissions: ["reports.view"] },
      { label: "ERP Sync Logs", href: "/erp-sync-logs", icon: "bi-arrow-repeat", permissions: ["erp-sync.view"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Master Data", href: "/master-data", icon: "bi-database-gear", permissions: ["master-data.view"] },
      { label: "ERP Import", href: "/import", icon: "bi-upload", permissions: ["erp-sync.create", "erp-sync.update"] },
      { label: "Depreciation", href: "/depreciation", icon: "bi-percent", permissions: ["depreciation.view"] },
      { label: "Stock Movements", href: "/transfers", icon: "bi-diagram-3", permissions: ["transfers.view"] },
      { label: "System Settings", href: "/system-settings", icon: "bi-gear", permissions: ["settings.view"] },
      { label: "User Delegations", href: "/user-delegations", icon: "bi-person-check", permissions: ["users.update", "roles.update"] },
      { label: "Users", href: "/users", icon: "bi-people", permissions: ["users.view"] },
      { label: "Roles", href: "/roles", icon: "bi-shield-lock", permissions: ["roles.view"] },
    ],
  },
];

export function ImsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission, isAuthenticated, loading, logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isLoginPage = pathname === "/login";
  const isActive = (href: string) => pathname === href;
  const visibleNavGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => hasPermission(item.permissions)),
      })).filter((group) => group.items.length > 0),
    [hasPermission],
  );

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

  const loadUnreadCount = useCallback(async () => {
    if (loading || !isAuthenticated) return;

    try {
      const response = await api.get<{ unread_count: number }>("/notifications/unread-count");
      setUnreadCount(Number(response.data?.unread_count ?? 0));
    } catch {
      setUnreadCount(0);
    }
  }, [isAuthenticated, loading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUnreadCount();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUnreadCount, pathname]);

  const loadNotificationPreview = useCallback(async () => {
    if (loading || !isAuthenticated) return;

    setNotificationLoading(true);
    try {
      const response = await api.get<{ data: NotificationPreview[] }>("/notifications", {
        params: { is_read: "0" },
      });
      setNotifications((response.data?.data ?? []).slice(0, 5));
      setNotificationError("");
      await loadUnreadCount();
    } catch {
      setNotifications([]);
      setNotificationError("Unable to load notifications.");
    } finally {
      setNotificationLoading(false);
    }
  }, [isAuthenticated, loadUnreadCount, loading]);

  const handleLogout = useCallback(async () => {
    await logout();
    if (isAuthBypassEnabled) {
      router.replace("/");
      return;
    }

    router.replace("/login");
  }, [logout, router]);

  const openNotificationMenu = () => {
    setAccountOpen(false);
    setNotificationOpen((current) => !current);
    void loadNotificationPreview();
  };

  const markNotificationRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`, {});
      await loadNotificationPreview();
    } catch {
      setNotificationError("Unable to mark notification as read.");
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.post("/notifications/read-all", {});
      await loadNotificationPreview();
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
          {visibleNavGroups.map((group) => (
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
                title="Open notifications"
                onClick={openNotificationMenu}
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
                        <div className="ims-notification-item" key={notification.id} role="menuitem">
                          <span className="ims-notification-dot" />
                          <span className="min-w-0 flex-grow-1">
                            <span className="d-block fw-semibold text-body text-truncate">{notification.title}</span>
                            <span className="d-block small text-secondary text-truncate">{notification.message}</span>
                            <span className="d-block small text-secondary text-truncate">{formatNotificationType(notification.notification_type)}</span>
                          </span>
                          <button
                            className="btn btn-sm btn-outline-primary flex-shrink-0"
                            type="button"
                            onClick={() => markNotificationRead(notification.id)}
                          >
                            Read
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="d-flex border-top">
                    <button className="ims-notification-action border-end" type="button" onClick={markAllNotificationsRead} disabled={unreadCount === 0}>
                      <i className="bi bi-check2-all" />
                      Mark all read
                    </button>
                    <Link className="ims-notification-action text-decoration-none" href="/notifications" onClick={() => setNotificationOpen(false)}>
                      <i className="bi bi-box-arrow-up-right" />
                      Open page
                    </Link>
                  </div>
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
