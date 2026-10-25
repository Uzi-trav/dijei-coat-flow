import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import NotFoundPage from "@/pages/NotFoundPage";
import WorkerHomePage from "@/pages/WorkerHomePage";
import ScanWorkPaperPage from "@/pages/ScanWorkPaperPage";
import WorkerSuccessPage from "@/pages/WorkerSuccessPage";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import OverviewPage from "@/pages/dashboard/OverviewPage";
import NewWorkRecordPage from "@/pages/dashboard/NewWorkRecordPage";
import WorkHistoryPage from "@/pages/dashboard/WorkHistoryPage";
import ProjectsItemsPage from "@/pages/dashboard/ProjectsItemsPage";
import { DemoStoreError, initializeDemoData } from "@/lib/demoStore";
const OrderDocumentsPage = lazy(() => import("@/pages/dashboard/OrderDocumentsPage"));

export default function App() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSharedData = useCallback(async () => {
    try {
      await initializeDemoData();
      setLoadError(null);
    } catch (error) {
      console.error("Unable to initialize shared app data:", error);
      setLoadError(error instanceof DemoStoreError ? `demoErrors.${error.code}` : "app.connectionFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void initializeDemoData()
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Unable to initialize shared app data:", error);
        setLoadError(error instanceof DemoStoreError ? `demoErrors.${error.code}` : "app.connectionFailed");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PwaInstallPrompt />
      {loading ? (
        <main className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">
          {t("app.loadingShared")}
        </main>
      ) : loadError ? (
        <main className="grid min-h-screen place-items-center p-6">
          <section className="max-w-lg space-y-4 text-center">
            <h1 className="text-2xl font-semibold">{t("app.connectionTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("app.connectionFailed", { error: t(loadError) })}
            </p>
            <Button onClick={() => {
              setLoading(true);
              setLoadError(null);
              void loadSharedData();
            }}>{t("common.retry")}</Button>
          </section>
        </main>
      ) : (
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      )}
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WorkerHomePage />} />
      <Route path="/scan" element={<ScanWorkPaperPage />} />
      <Route path="/work/review" element={<NewWorkRecordPage />} />
      <Route path="/work/success" element={<WorkerSuccessPage />} />

      <Route path="/dashboard" element={<AppLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="new-record" element={<NewWorkRecordPage />} />
        <Route path="history" element={<WorkHistoryPage />} />
        <Route path="history/:recordId/documents" element={<Suspense fallback={null}><OrderDocumentsPage /></Suspense>} />
        <Route path="projects-items" element={<ProjectsItemsPage />} />
      </Route>

      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/signup" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
