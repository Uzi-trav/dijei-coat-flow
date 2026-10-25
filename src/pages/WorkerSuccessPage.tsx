import { Link, useLocation, Navigate } from "react-router-dom";
import { Check, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface SuccessState {
  recordNumber?: string;
}

export default function WorkerSuccessPage() {
  const location = useLocation();
  const { t } = useTranslation();
  const recordNumber = (location.state as SuccessState | null)?.recordNumber;

  if (!recordNumber) return <Navigate to="/" replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-lg space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="success-title">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Check aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 id="success-title" className="text-2xl font-semibold">{t("worker.successTitle")}</h1>
          <p className="text-muted-foreground">{t("worker.successBody")}</p>
          <p className="font-medium tabular-nums">{recordNumber}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link to="/">{t("worker.backHome")}</Link></Button>
          <Button asChild variant="outline">
            <Link to="/dashboard/history"><ClipboardList aria-hidden="true" /> {t("worker.openHistory")}</Link>
          </Button>
        </div>
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">{t("app.localNotice")}</p>
      </section>
    </main>
  );
}
