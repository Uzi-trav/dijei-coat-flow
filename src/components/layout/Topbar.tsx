import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { PanelLeft, Sun, Moon, Monitor } from "lucide-react";
import type { Theme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";

interface TopbarProps {
  onToggleSidebar: () => void;
}

const themeIcons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();

  function cycleTheme() {
    const order: Theme[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }

  const ThemeIcon = themeIcons[theme];

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="hidden shrink-0 text-muted-foreground hover:text-foreground md:inline-flex"
      >
        <PanelLeft className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <label className="sr-only" htmlFor="language-select">{t("app.language")}</label>
      <select
        id="language-select"
        aria-label={t("app.language")}
        value={i18n.resolvedLanguage?.startsWith("en") ? "en" : "ko"}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20"
      >
        <option value="ko">{t("app.korean")}</option>
        <option value="en">{t("app.english")}</option>
      </select>
      <Button
        variant="ghost"
        size="icon"
        onClick={cycleTheme}
        title={t("app.theme", { theme })}
        className="text-muted-foreground hover:text-foreground"
      >
        <ThemeIcon className="h-5 w-5" />
      </Button>
    </header>
  );
}
