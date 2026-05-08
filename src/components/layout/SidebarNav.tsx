import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Settings,
} from "lucide-react";
import type { Role } from "@/types/database";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, roles: ["superadmin", "admin", "editor"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["superadmin"] },
];

export function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const { role } = useAuth();
  const location = useLocation();

  const filtered = navItems.filter(
    (item) => role && item.roles.includes(role)
  );

  return (
    <nav className="flex flex-col gap-1 p-2">
      {filtered.map((item) => {
        const active =
          item.href === "/dashboard"
            ? location.pathname === "/dashboard"
            : location.pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
