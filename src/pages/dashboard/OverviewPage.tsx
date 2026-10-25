import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoStoreError, getDemoData, refreshDemoData, type DemoStore } from "@/lib/demoStore";

interface DashboardState {
  data: DemoStore | null;
  error: string | null;
}

function readDashboardState(): DashboardState {
  try {
    return { data: getDemoData(), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof DemoStoreError ? error.code : "STORAGE_ERROR",
    };
  }
}

export default function OverviewPage() {
  const { t } = useTranslation();
  const [state, setState] = useState(readDashboardState);
  const today = new Date();
  const todayCount = state.data?.records.filter((record) => {
    const createdAt = new Date(record.created_at);
    return createdAt.getFullYear() === today.getFullYear()
      && createdAt.getMonth() === today.getMonth()
      && createdAt.getDate() === today.getDate();
  }).length ?? 0;

  async function reload() {
    try {
      await refreshDemoData();
      setState(readDashboardState());
    } catch (error) {
      setState({
        data: null,
        error: error instanceof DemoStoreError ? error.code : "REMOTE_ERROR",
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{t("overview.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("overview.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void reload()}><RefreshCw /> {t("common.refresh")}</Button>
          <Button asChild>
            <Link to="/dashboard/new-record">
              <Plus />
              {t("overview.newRecord")}
            </Link>
          </Button>
        </div>
      </div>

      {state.error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm shadow-sm" role="alert">
          <span>{t("overview.readError", { error: t(`demoErrors.${state.error}`) })}</span>
          <Button variant="outline" size="sm" onClick={() => void reload()}>{t("common.retry")}</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-3 border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{t("overview.totalRecords")}</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">{state.data?.records.length ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{t("overview.savedInBrowser")}</CardContent>
        </Card>
        <Card className="gap-3 border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{t("overview.todayRecords")}</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">{state.data ? todayCount : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{t("overview.deviceDate")}</CardContent>
        </Card>
      </div>

      {state.data?.records.length === 0 && (
        <Card className="gap-4 border-border shadow-sm">
          <CardHeader className="border-b border-border pb-5">
            <CardTitle>{t("overview.emptyTitle")}</CardTitle>
            <CardDescription>{t("overview.emptyDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/dashboard/projects-items">{t("overview.addMasterData")}</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard/new-record" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t("overview.createRecord")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="link" className="px-0">
          <Link to="/dashboard/history" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {t("overview.viewHistory")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
