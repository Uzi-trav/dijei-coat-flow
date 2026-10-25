import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./SidebarNav";
import { Topbar } from "./Topbar";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AppLayout() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
      <div className="flex min-w-0 items-center gap-3">
        {collapsed ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground" aria-label="Dijei Coat">DC</span>
        ) : (
          <img src="/dijei-coat-logo.png" alt="Dijei Coat" className="h-auto max-h-12 w-full max-w-[190px] object-contain" />
        )}
      </div>
    </div>
      <SidebarNav collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className="hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:block"
        style={{ width: collapsed ? 68 : 248 }}
      >
        {sidebarContent}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-3 top-3 z-40 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col">
        <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <div className="flex flex-wrap items-center justify-center gap-x-2 border-b border-border bg-accent/50 px-5 py-2 text-center text-xs text-muted-foreground">
          <span className="font-medium text-accent-foreground">{t("app.localDemo")}</span>
          <span>{t("app.localNotice")}</span>
        </div>
        <main className="flex-1 px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
