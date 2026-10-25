import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Menu, PencilLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function WorkerHomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label={t("worker.homeLabel")}>
          <img src="/dijei-coat-logo.png" alt="Dijei Coat" className="h-auto max-h-12 w-[190px] object-contain" />
        </Link>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("worker.openMenu")}>
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Dijei Coat</SheetTitle>
              <SheetDescription>{t("worker.menuDescription")}</SheetDescription>
            </SheetHeader>
            <nav className="px-4" aria-label={t("worker.mainMenu")}>
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-12 items-center rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("worker.admin")}
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
        <section className="space-y-8" aria-labelledby="worker-home-title">
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary">{t("worker.eyebrow")}</p>
            <h1 id="worker-home-title" className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("worker.title")}
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              {t("worker.subtitle")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild size="lg" className="h-16 justify-start gap-4 px-5 text-base shadow-sm">
              <Link to="/scan">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-foreground/15">
                  <Camera className="h-5 w-5" aria-hidden="true" />
                </span>
                {t("worker.scan")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-16 justify-start gap-4 px-5 text-base">
              <Link to="/work/review">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                  <PencilLine className="h-5 w-5" aria-hidden="true" />
                </span>
                {t("worker.manual")}
              </Link>
            </Button>
          </div>

          <div className="border-t border-border pt-5 text-sm text-muted-foreground">
            {t("worker.reviewReminder")}
          </div>
        </section>
      </main>
    </div>
  );
}
