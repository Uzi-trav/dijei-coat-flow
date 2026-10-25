import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoStoreError, getDemoData, refreshDemoData, type DemoWorkRecord } from "@/lib/demoStore";

interface HistoryState {
  records: DemoWorkRecord[];
  error: string | null;
}

function readHistory(): HistoryState {
  try {
    return { records: getDemoData().records, error: null };
  } catch (error) {
    return {
      records: [],
      error: error instanceof DemoStoreError ? error.code : "STORAGE_ERROR",
    };
  }
}

export default function WorkHistoryPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [history, setHistory] = useState(readHistory);
  const savedRecordId = (location.state as { savedRecordId?: string } | null)?.savedRecordId;
  const savedRecord = history.records.find((record) => record.id === savedRecordId);

  async function refreshHistory() {
    try {
      await refreshDemoData();
      setHistory(readHistory());
    } catch (error) {
      setHistory({
        records: [],
        error: error instanceof DemoStoreError ? error.code : "REMOTE_ERROR",
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{t("history.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("history.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("history.description")}</p>
        </div>
        <Button variant="outline" onClick={() => void refreshHistory()}><RefreshCw /> {t("common.refresh")}</Button>
      </div>

      {savedRecord && (
        <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4 text-sm" role="status">
          {t("history.saved", { recordNumber: savedRecord.record_number })}
        </div>
      )}
      {history.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          {t("history.readError", { error: t(`demoErrors.${history.error}`) })}
        </div>
      )}
      {!history.error && history.records.length === 0 ? (
        <Card>
          <CardHeader><CardTitle>{t("history.emptyTitle")}</CardTitle><CardDescription>{t("history.emptyDescription")}</CardDescription></CardHeader>
          <CardContent><Button onClick={() => navigate("/dashboard/new-record")}>{t("history.createRecord")}</Button></CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.records.map((record) => (
            <Card key={record.id}>
              <CardHeader className="gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {t("record.orderNameValue", {
                      project: record.display_name ?? record.project_name_snapshot,
                      item: record.order_item_name ?? record.items[0]?.item_name_snapshot ?? "",
                      count: record.total_item_count ?? record.items.reduce((total, item) => total + item.quantity, 0),
                      unit: record.items[0]?.unit ?? "EA",
                    })}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {record.record_number}{record.lot_number ? ` · LOT ${record.lot_number}` : ""}
                    {record.work_date ? ` · ${record.work_date}` : ""}
                  </CardDescription>
                </div>
                <time className="text-sm text-muted-foreground" dateTime={record.created_at}>
                  {new Date(record.created_at).toLocaleString(i18n.resolvedLanguage === "en" ? "en-US" : "ko-KR")}
                </time>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="no-print flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/history/${record.id}/documents`)}>
                    <FileText />{t("history.createDocuments")}
                  </Button>
                </div>
                {record.project_spec_snapshot && (
                  <section className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <div>
                      <h3 className="font-medium">{t("history.specificationSnapshot")}</h3>
                      <p className="text-xs text-amber-700 dark:text-amber-300">{t("history.unverifiedSnapshot")}</p>
                    </div>
                    <p className="text-sm">{t("record.maker")}: {record.project_spec_snapshot.maker || t("record.makerNotListed")}</p>
                    {record.project_spec_snapshot.coating_stages
                      .filter((stage) => stage.stage !== "other")
                      .map((stage, index) => (
                        <div key={index}>
                          <p className="text-sm">
                            {t(`record.stage.${stage.stage}`)}{stage.scope ? ` · ${stage.scope}` : ""}: {stage.specification}
                          </p>
                          <p className="text-sm">{t("record.coatMeasure")}: {stage.thickness_text || t("record.coatMeasureNotListed")}</p>
                        </div>
                      ))}
                    {record.project_spec_snapshot.thickness_text && (
                      <p className="text-sm">{t("record.thickness")}: {record.project_spec_snapshot.thickness_text}</p>
                    )}
                    {record.project_spec_snapshot.notes && (
                      <p className="whitespace-pre-wrap text-sm">{t("record.specificationNotes")}: {record.project_spec_snapshot.notes}</p>
                    )}
                    <p className="text-sm">
                      {t("record.totalCoatMeasure")}: {record.project_spec_snapshot.thickness_text || t("record.coatMeasureNotListed")}
                    </p>
                  </section>
                )}
                <div className="divide-y rounded-md border">
                  {record.items.map((item) => (
                    <div key={item.id} className="flex flex-col justify-between gap-1 p-3 sm:flex-row sm:items-center">
                      <span className="font-medium">
                        {item.item_name_snapshot}
                        {item.part_number ? <span className="ml-2 text-sm font-normal text-muted-foreground">({item.part_number})</span> : null}
                        {item.proposed_new_item && <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">{t("history.proposedItem")}</span>}
                      </span>
                      <span className="text-sm tabular-nums">{Number(item.quantity).toLocaleString()} {item.unit}</span>
                      {item.notes && <span className="basis-full text-sm text-muted-foreground">{item.notes}</span>}
                    </div>
                  ))}
                </div>
                {record.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t("history.notes", { notes: record.notes })}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
