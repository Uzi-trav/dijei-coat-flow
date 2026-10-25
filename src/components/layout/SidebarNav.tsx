import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ClipboardList, LayoutDashboard, Plus, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "nav.overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "nav.newRecord", href: "/dashboard/new-record", icon: Plus },
  { label: "nav.history", href: "/dashboard/history", icon: ClipboardList },
  { label: "nav.masterData", href: "/dashboard/projects-items", icon: Settings2 },
];

export function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <nav className="flex flex-col gap-1 px-3 py-5">
      {navItems.map((item) => {
        const active =
          item.href === "/dashboard"
            ? location.pathname === "/dashboard"
            : location.pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
            {!collapsed && <span>{t(item.label)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
