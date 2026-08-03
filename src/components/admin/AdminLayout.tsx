// ============================================================================
// File: src/components/admin/AdminLayout.tsx
// Purpose: Admin shell — premium redesigned sidebar + topbar with:
//   A1: Collapsible sidebar groups (expand/collapse nav sections)
//   A2: Sidebar search filter (quick-search nav items)
//   A3: Breadcrumb navigation (Dashboard > Orders > Detail)
//   A4: Command palette (Cmd+K quick-jump to any page)
//   A5: Sticky table headers (applied via Table component wrapper)
//   A6: Page transition animations (framer-motion fade/slide)
// ============================================================================

"use client";

import { useState, useEffect, ReactNode, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Package,
  Tags,
  FolderTree,
  ShoppingCart,
  FileImage,
  ClipboardList,
  Users,
  Ticket,
  Star,
  Megaphone,
  Truck,
  CreditCard,
  BarChart3,
  FileText,
  Settings,
  UserCog,
  LogOut,
  Store,
  Loader2,
  ChevronDown,
  ChevronRight,
  Mailbox,
  Flame,
  Search,
  Command,
  Clock,
  Sun,
  Moon,
  ScrollText,
  HardDrive,
  Database,
  Sparkles,
  Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAdminStore, AdminView } from "./admin-store";
import { AdminNotificationBell } from "./AdminNotificationBell";
import { api, run } from "./api";
import { getInitials } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/lib/permissions";
import { AdminPermissionKey } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";

interface AdminInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  permissions?: string | null;
}

// ---------------------------------------------------------------------------
// NAV GROUPS — all admin navigation items with icons + permission keys
// ---------------------------------------------------------------------------
const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ view: AdminView; icon: any; label: string; permission: AdminPermissionKey }>;
}> = [
  {
    label: "Catalog",
    items: [
      { view: { name: "products" }, icon: Package, label: "Products", permission: "products" },
      { view: { name: "brands" }, icon: Tags, label: "Brands", permission: "brands" },
      { view: { name: "categories" }, icon: FolderTree, label: "Categories", permission: "categories" },
    ],
  },
  {
    label: "Sales",
    items: [
      { view: { name: "orders" }, icon: ShoppingCart, label: "Orders", permission: "orders" },
      { view: { name: "prescriptions" }, icon: FileImage, label: "Prescriptions", permission: "prescriptions" },
      { view: { name: "manual-requests" }, icon: ClipboardList, label: "Manual Requests", permission: "manual-requests" },
      { view: { name: "customers" }, icon: Users, label: "Customers", permission: "customers" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { view: { name: "offers" }, icon: Megaphone, label: "Offers & Banners", permission: "offers" },
      { view: { name: "deals" }, icon: Flame, label: "Today's Deals", permission: "deals" },
      { view: { name: "campaigns" }, icon: Megaphone, label: "Campaigns", permission: "campaigns" },
      { view: { name: "ai-marketing" }, icon: Sparkles, label: "AI Marketing", permission: "ai-marketing" },
      { view: { name: "vouchers" }, icon: Ticket, label: "Vouchers", permission: "vouchers" },
      { view: { name: "newsletter" }, icon: Mailbox, label: "Newsletter", permission: "newsletter" },
      { view: { name: "app-notification-center" }, icon: Bell, label: "Apps Notification's", permission: "app-notifications" },
      { view: { name: "reviews" }, icon: Star, label: "Reviews", permission: "reviews" },
    ],
  },
  {
    label: "Operations",
    items: [
      { view: { name: "delivery-zones" }, icon: Truck, label: "Delivery Zones", permission: "delivery-zones" },
      { view: { name: "payment-methods" }, icon: CreditCard, label: "Payment Methods", permission: "payment-methods" },
      { view: { name: "reports" }, icon: BarChart3, label: "Reports", permission: "reports" },
    ],
  },
  {
    label: "System",
    items: [
      { view: { name: "backups" }, icon: HardDrive, label: "Backups", permission: "backups" },
      { view: { name: "database" }, icon: Database, label: "Database", permission: "database" },
      { view: { name: "notification-templates" }, icon: FileText, label: "Templates", permission: "templates" },
      { view: { name: "settings" }, icon: Settings, label: "Settings", permission: "settings" },
      { view: { name: "admins" }, icon: UserCog, label: "Admins", permission: "admins" },
      { view: { name: "error-logs" }, icon: ScrollText, label: "Error Logs", permission: "error-logs" },
    ],
  },
];

// Flatten all nav items for the command palette + sidebar search
const ALL_NAV_ITEMS = [
  { view: { name: "dashboard" } as AdminView, icon: LayoutDashboard, label: "Dashboard", group: "Overview" },
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))),
];

// Title map for breadcrumbs
const TITLE_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Products",
  "product-edit": "Edit Product",
  brands: "Brands",
  categories: "Categories",
  orders: "Orders",
  "order-detail": "Order Detail",
  prescriptions: "Prescriptions",
  "prescription-detail": "Prescription Detail",
  "manual-requests": "Manual Requests",
  "manual-request-detail": "Manual Request Detail",
  customers: "Customers",
  "customer-detail": "Customer Detail",
  vouchers: "Vouchers",
  "delivery-zones": "Delivery Zones",
  "payment-methods": "Payment Methods",
  reviews: "Reviews",
  offers: "Offers & Banners",
  deals: "Today's Deals",
  notifications: "Notifications",
  "notification-templates": "Notification Templates",
  "app-notification-center": "Apps Notification's",
  newsletter: "Newsletter",
  settings: "Settings",
  admins: "Admins",
  reports: "Reports",
  backups: "Backups",
  database: "Database",
  campaigns: "Campaigns",
  "error-logs": "Error Logs",
  "ai-marketing": "AI Marketing",
};

// Breadcrumb parent map (child → parent view name)
const BREADCRUMB_PARENT: Record<string, string> = {
  "product-edit": "products",
  "order-detail": "orders",
  "prescription-detail": "prescriptions",
  "manual-request-detail": "manual-requests",
  "customer-detail": "customers",
  "notification-templates": "notifications",
};

function roleLabel(role: string) {
  return role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1);
}

// ---------------------------------------------------------------------------
// A2: SIDEBAR SEARCH FILTER
// ---------------------------------------------------------------------------

function SidebarSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-3 pb-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search navigation..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 border-border/60 bg-muted/40 pl-8 text-xs admin-search focus-visible:ring-1 focus-visible:ring-primary/30"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A1: COLLAPSIBLE SIDEBAR GROUPS + NAV LIST
// ---------------------------------------------------------------------------

function NavList({ admin, searchQuery }: { admin: AdminInfo; searchQuery: string }) {
  const view = useAdminStore((s) => s.view);
  const navigate = useAdminStore((s) => s.navigate);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Fetch lightweight badge counts
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: () => api.get<{ pendingOrders: number; lowStock: number; pendingPrescriptions: number; pendingManualRequests: number; unreadNotifications: number }>("/api/admin/counts"),
    refetchInterval: 30 * 1000,
  });

  const badgeFor = (viewName: string): number | null => {
    if (!counts) return null;
    switch (viewName) {
      case "orders": return counts.pendingOrders || null;
      case "products": return counts.lowStock || null;
      case "prescriptions": return counts.pendingPrescriptions || null;
      case "manual-requests": return counts.pendingManualRequests || null;
      default: return null;
    }
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isVisible = (item: { permission: AdminPermissionKey }) => hasPermission(admin, item.permission);

  // When searching, show all items flat (ignore group collapse)
  const isSearching = searchQuery.trim().length > 0;
  const query = searchQuery.toLowerCase().trim();

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (!isVisible(item)) return false;
      if (!isSearching) return true;
      return item.label.toLowerCase().includes(query);
    }),
  })).filter((g) => g.items.length > 0);

  // Dashboard is always visible (if permitted)
  const showDashboard = hasPermission(admin, "dashboard") && (!isSearching || "dashboard".includes(query));

  return (
    <SidebarContent>
      {/* Dashboard — always at top, outside groups */}
      {showDashboard && (
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={view.name === "dashboard"}
                onClick={() => navigate({ name: "dashboard" })}
                tooltip="Dashboard"
                className="transition-premium"
              >
                <LayoutDashboard />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}

      {/* Collapsible nav groups */}
      {visibleGroups.map((g) => {
        const isCollapsed = collapsedGroups.has(g.label) && !isSearching;
        return (
          <Collapsible
            key={g.label}
            open={!isCollapsed}
            // When searching, all groups are forced open so matches are visible.
            // Don't call toggleGroup during search — it would silently mutate
            // the collapsed state and cause unexpected expand/collapse when the
            // search is cleared.
            onOpenChange={() => !isSearching && toggleGroup(g.label)}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer select-none hover:bg-sidebar-accent/60 transition-colors admin-section-label">
                  <span>{g.label}</span>
                  <ChevronRight className={`ml-auto size-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenu>
                  {g.items.map((item) => {
                    const isActive =
                      view.name === item.view.name ||
                      (item.view.name === "products" && view.name === "product-edit") ||
                      (item.view.name === "orders" && view.name === "order-detail") ||
                      (item.view.name === "prescriptions" && view.name === "prescription-detail") ||
                      (item.view.name === "manual-requests" && view.name === "manual-request-detail") ||
                      (item.view.name === "customers" && view.name === "customer-detail");
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => navigate(item.view)}
                          tooltip={item.label}
                          className="transition-premium"
                        >
                          <item.icon />
                          <span>{item.label}</span>
                          {badgeFor(item.view.name) !== null && (
                            <Badge className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px] font-bold bg-amber-500 text-white hover:bg-amber-500 animate-badge-pulse">
                              {badgeFor(item.view.name)}
                            </Badge>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        );
      })}

      {/* No results when searching */}
      {isSearching && visibleGroups.length === 0 && !showDashboard && (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">
          No navigation items match “{searchQuery}”
        </div>
      )}
    </SidebarContent>
  );
}

// ---------------------------------------------------------------------------
// A3: BREADCRUMB NAVIGATION
// ---------------------------------------------------------------------------

function Breadcrumbs({ viewName, navigate }: { viewName: string; navigate: (v: AdminView) => void }) {
  const crumbs: Array<{ label: string; view?: AdminView }> = [];

  // Always start with Dashboard
  crumbs.push({ label: "Dashboard", view: { name: "dashboard" } });

  // Add parent if this is a detail page
  const parentName = BREADCRUMB_PARENT[viewName];
  if (parentName) {
    crumbs.push({ label: TITLE_MAP[parentName] || parentName, view: { name: parentName } as AdminView });
  }

  // Add current page (not clickable)
  const currentLabel = TITLE_MAP[viewName] || viewName;
  if (viewName !== "dashboard") {
    crumbs.push({ label: currentLabel });
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />}
            {crumb.view && !isLast ? (
              <button
                onClick={() => navigate(crumb.view!)}
                className="hover:text-foreground transition-colors truncate"
              >
                {crumb.label}
              </button>
            ) : (
              <span className={`truncate ${isLast ? "font-semibold text-foreground" : ""}`}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// A4: COMMAND PALETTE (Cmd+K)
// ---------------------------------------------------------------------------

function CommandPalette({ open, onOpenChange, navigate }: { open: boolean; onOpenChange: (v: boolean) => void; navigate: (v: AdminView) => void }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_NAV_ITEMS;
    const q = query.toLowerCase();
    return ALL_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  const handleSelect = (view: AdminView) => {
    navigate(view);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg shadow-premium-xl">
        {/* Accessibility: DialogTitle is required by Radix Dialog for screen
            reader support. Rendered visually-hidden (sr-only). */}
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center border-b border-border/70 px-4 bg-premium-gradient">
          <Search className="size-4 mr-3 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search navigation items"
            className="h-12 border-0 px-0 focus-visible:ring-0 text-sm bg-transparent"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                handleSelect(filtered[0].view);
              }
            }}
          />
          <kbd className="ml-2 shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 scrollbar-premium">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.label}
                onClick={() => handleSelect(item.view)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-premium text-left"
              >
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                  <item.icon className="size-3.5" />
                </span>
                <span className="flex-1 font-medium">{item.label}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.group}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// STORE OPEN TOGGLE
// ---------------------------------------------------------------------------

function StoreOpenToggle() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-store-status"],
    queryFn: () => api.get<{ open: boolean; openStatus: boolean }>("/api/admin/settings/store-status"),
  });

  async function toggle(next: boolean) {
    const r = await run(
      () => api.patch("/api/admin/settings/store-status", { openStatus: next }),
      { success: next ? "Store opened" : "Store closed", error: "Failed to toggle" }
    );
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-store-status"] });
    }
  }

  const isOpen = !!data?.openStatus;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isOpen ? "border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/40" : "border-border bg-muted/30"}`}>
      <Store className={`size-4 ${isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium">Store Status</div>
        <div className={`text-[11px] ${isOpen ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
          {isLoading ? "Loading…" : data?.open ? "Open for orders" : "Closed"}
        </div>
      </div>
      <Switch
        checked={isOpen}
        disabled={isLoading}
        onCheckedChange={toggle}
        aria-label="Toggle store open/close"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SIDEBAR FOOTER
// ---------------------------------------------------------------------------

function SidebarFooterArea({ admin, onLogout }: { admin: AdminInfo; onLogout: () => void }) {
  return (
    <SidebarFooter>
      <StoreOpenToggle />
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent transition-premium">
                <Avatar className="size-8 ring-1 ring-primary/15">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {getInitials(admin.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{admin.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{admin.email}</span>
                </div>
                <ChevronDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-60 shadow-premium-xl">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold">{admin.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{admin.email}</span>
                  <Badge variant="outline" className="mt-1.5 w-fit bg-primary/10 text-primary border-primary/20">
                    {roleLabel(admin.role)}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive focus:bg-destructive/5">
                <LogOut className="size-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

// ---------------------------------------------------------------------------
// MAIN ADMIN LAYOUT
// ---------------------------------------------------------------------------

export function AdminLayout({
  admin,
  onLogout,
  children,
}: {
  admin: AdminInfo;
  onLogout: () => void;
  children: ReactNode;
}) {
  const view = useAdminStore((s) => s.view);
  const navigate = useAdminStore((s) => s.navigate);
  const back = useAdminStore((s) => s.back);
  const canGoBack = useAdminStore((s) => s.canGoBack());

  // A2: Sidebar search state
  const [searchQuery, setSearchQuery] = useState("");

  // A4: Command palette state
  const [cmdOpen, setCmdOpen] = useState(false);

  // A4: Keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // E7: Restore saved dark mode preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("admin-theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Current date for the topbar widget (B6: date widget)
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-2 py-3">
            <div className="relative shrink-0">
              <img src="/logo.png" alt="PMS" className="size-9 rounded-lg object-cover ring-1 ring-primary/10 shadow-premium-sm" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight truncate">Admin Panel</div>
              <div className="text-[11px] text-muted-foreground truncate">PMS Console</div>
            </div>
          </div>
        </SidebarHeader>

        {/* A2: Sidebar Search Filter */}
        <SidebarSearch value={searchQuery} onChange={setSearchQuery} />

        <NavList admin={admin} searchQuery={searchQuery} />
        <SidebarFooterArea admin={admin} onLogout={onLogout} />
      </Sidebar>

      <SidebarInset>
        {/* Topbar with breadcrumbs + command palette trigger + date widget */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 bg-background/95 backdrop-blur-md px-4 shadow-premium-sm">
          <SidebarTrigger />

          {/* A3: Breadcrumb Navigation */}
          <div className="flex-1 min-w-0">
            <Breadcrumbs viewName={view.name} navigate={navigate} />
          </div>

          {/* A4: Command palette trigger button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex gap-1.5 text-muted-foreground hover:text-foreground transition-premium"
          >
            <Command className="size-3.5" />
            <span className="text-xs">Search</span>
            <kbd className="ml-1 rounded border bg-muted px-1 py-0.5 text-[9px] font-mono">⌘K</kbd>
          </Button>

          {/* B6: Date widget */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>{dateStr}</span>
          </div>

          {/* E7: Dark mode toggle — `relative` on the button is required so the
              absolutely-positioned Moon icon anchors to the button, not the
              sticky header ancestor. */}
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8 hover:bg-accent transition-premium"
            onClick={() => {
              const isDark = document.documentElement.classList.contains("dark");
              if (isDark) {
                document.documentElement.classList.remove("dark");
                localStorage.setItem("admin-theme", "light");
              } else {
                document.documentElement.classList.add("dark");
                localStorage.setItem("admin-theme", "dark");
              }
            }}
            title="Toggle dark mode"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <AdminNotificationBell />

          {/* Mobile back button */}
          {canGoBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={back}
              className="sm:hidden text-muted-foreground"
            >
              Back
            </Button>
          )}

          {/* Role badge (desktop) */}
          <Badge variant="outline" className="hidden md:flex bg-primary/10 text-primary border-primary/20 font-medium">
            {roleLabel(admin.role)}
          </Badge>

          <Button variant="outline" size="sm" onClick={onLogout} className="hidden md:flex transition-premium">
            <LogOut className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onLogout}>
            <LogOut className="size-4" />
          </Button>
        </header>

        {/* A6: Page transition animations — the key includes the view name AND
            any id field so navigating between two records of the same type
            (e.g. order-detail → different order-detail) re-triggers the
            fade/slide animation. Covers all detail views: product-edit,
            order-detail, prescription-detail, manual-request-detail,
            customer-detail. */}
        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={view.name + ("id" in view ? (view as any).id ?? "" : "")}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="animate-page-enter"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </SidebarInset>

      {/* A4: Command Palette Dialog */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} navigate={navigate} />
    </SidebarProvider>
  );
}

/** Wrapper to fetch admin from /me on mount; renders children only when logged in. */
export function AdminGuard({
  onLoggedOut,
  children,
}: {
  onLoggedOut: () => void;
  children: (admin: AdminInfo) => ReactNode;
}) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get<AdminInfo>("/api/admin-auth/me")
      .then((a) => mounted && setAdmin(a))
      .catch(() => mounted && onLoggedOut())
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [onLoggedOut]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!admin) return null;
  return <>{children(admin)}</>;
}

export async function doLogout() {
  await run(() => api.post("/api/admin-auth/logout"), { success: "Signed out" });
}
