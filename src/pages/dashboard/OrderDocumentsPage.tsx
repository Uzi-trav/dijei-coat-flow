import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, FileDown, FileSpreadsheet, Printer, Save, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoStoreError, getDemoData, updateDemoRecordDocuments, type DemoWorkRecord, type OrderDocuments, type ProjectSpecSnapshot } from "@/lib/demoStore";
import { searchProjects } from "@/lib/projectSearch";
import { useTranslation } from "react-i18next";

type DocumentType = "workPaper" | "invoice";

function localDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function initializeDocument(record: DemoWorkRecord, specification: ProjectSpecSnapshot | undefined): OrderDocuments {
  const stages = specification?.coating_stages ?? [];
  const topCoat = stages.find((stage) => stage.stage === "top");
  const bottomCoat = stages.find((stage) => stage.stage === "bottom");
  return {
    supplierName: "Dijei Coat",
    supplierAddress: "",
    supplierPhone: "",
    supplierEmail: "",
    projectName: record.project_name_snapshot,
    productName: record.items.map((item) => item.item_name_snapshot).join(", "),
    partNumber: record.items.map((item) => item.part_number).filter(Boolean).join(", "),
    lotNumber: record.lot_number,
    quantity: record.items.map((item) => String(item.quantity)).join(", "),
    unit: record.items.map((item) => item.unit).join(", "),
    customerName: "",
    customerAddress: "",
    invoiceNumber: record.record_number,
    invoiceDate: record.work_date || localDate(),
    paymentTerms: "",
    currency: "KRW",
    shipTo: "",
    dimensions: "",
    firstCoatName: topCoat?.specification ?? "",
    firstCoatThickness: topCoat?.thickness_text ?? "",
    secondCoatName: bottomCoat?.specification ?? "",
    secondCoatThickness: bottomCoat?.thickness_text ?? "",
    inspectorName: record.inspector_label === "로컬 데모" ? "" : record.inspector_label || "",
    additionalDetails: record.notes ?? "",
    invoiceLines: [
      ...record.items.map((item) => ({
      description: item.item_name_snapshot,
      partNumber: item.part_number ?? "",
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: 0,
      })),
      ...Array.from({ length: Math.max(0, 2 - record.items.length) }, () => ({
        description: "",
        partNumber: "",
        quantity: 0,
        unit: "",
        unitPrice: 0,
      })),
    ],
    discount: 0,
    taxRate: 0,
    shipping: 0,
  };
}

function mergeSavedDocument(record: DemoWorkRecord, specification: ProjectSpecSnapshot | undefined): OrderDocuments {
  const defaults = initializeDocument(record, specification);
  const saved = structuredClone(record.documents ?? {});
  const stages = specification?.coating_stages ?? [];
  const topSpecification = stages.find((stage) => stage.stage === "top")?.specification;
  const bottomSpecification = stages.find((stage) => stage.stage === "bottom")?.specification;
  const savedCoatsAreReversed = Boolean(
    topSpecification &&
      bottomSpecification &&
      topSpecification !== bottomSpecification &&
      record.documents?.firstCoatName === bottomSpecification &&
      record.documents?.secondCoatName === topSpecification,
  );
  return {
    ...defaults,
    ...saved,
    firstCoatName: savedCoatsAreReversed ? defaults.firstCoatName : record.documents?.firstCoatName || defaults.firstCoatName,
    firstCoatThickness: savedCoatsAreReversed ? defaults.firstCoatThickness : record.documents?.firstCoatThickness || defaults.firstCoatThickness,
    secondCoatName: savedCoatsAreReversed ? defaults.secondCoatName : record.documents?.secondCoatName || defaults.secondCoatName,
    secondCoatThickness: savedCoatsAreReversed ? defaults.secondCoatThickness : record.documents?.secondCoatThickness || defaults.secondCoatThickness,
    inspectorName: record.documents?.inspectorName ?? defaults.inspectorName,
  };
}

function resolveProjectSpecification(
  record: DemoWorkRecord,
  projects: ReturnType<typeof getDemoData>["projects"],
): ProjectSpecSnapshot | undefined {
  const exactName = (value: string) =>
    value.trim().toLocaleLowerCase() === record.project_name_snapshot.trim().toLocaleLowerCase();
  const projectById = projects.find((project) => project.id === record.project_id);
  const exactProject = projectById ?? projects.find((project) => exactName(project.name));
  const searchMatches = exactProject ? [] : searchProjects(projects, record.project_name_snapshot);
  const matchedProject = exactProject ?? (searchMatches.length === 1 ? searchMatches[0] : undefined);
  const snapshot = record.project_spec_snapshot;
  if (!matchedProject) return snapshot;

  const projectStages = matchedProject.coating_stages ?? [];
  const snapshotStages = snapshot?.coating_stages ?? [];
  const mergedStages = new Map(snapshotStages.map((stage) => [stage.stage, stage]));
  for (const stage of projectStages) {
    const previous = mergedStages.get(stage.stage);
    mergedStages.set(stage.stage, previous ? {
      ...previous,
      ...stage,
      scope: stage.scope || previous.scope,
      specification: stage.specification || previous.specification,
      paint_code: stage.paint_code || previous.paint_code,
      color: stage.color || previous.color,
      finish: stage.finish || previous.finish,
      thickness_text: stage.thickness_text || previous.thickness_text,
    } : stage);
  }

  return {
    source_project_id: matchedProject.id,
    source_row: matchedProject.source_row ?? snapshot?.source_row ?? null,
    verification_status: matchedProject.verification_status ?? snapshot?.verification_status,
    maker: matchedProject.maker || snapshot?.maker || "",
    coating_stages: [...mergedStages.values()],
    thickness_text: matchedProject.thickness_text || snapshot?.thickness_text || "",
    notes: matchedProject.notes?.join("\n") || snapshot?.notes || "",
    source_text: matchedProject.source_text || snapshot?.source_text || "",
  };
}

function formatAmount(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
  return currency.trim() ? `${currency.trim()} ${formatted}` : formatted;
}

export default function OrderDocumentsPage() {
  const { recordId = "" } = useParams();
  const { t } = useTranslation();
  const [history] = useState(() => {
    try {
      const data = getDemoData();
      return { records: data.records, projects: data.projects, error: "" };
    } catch (error) {
      return {
        records: [],
        projects: [],
        error: error instanceof DemoStoreError ? t(`demoErrors.${error.code}`) : t("documents.readFailed"),
      };
    }
  });
  const record = history.records.find((entry) => entry.id === recordId);
  const projectSpecification = record ? resolveProjectSpecification(record, history.projects) : undefined;
  const [activeDocument, setActiveDocument] = useState<DocumentType>("workPaper");
  const [documents, setDocuments] = useState<OrderDocuments | null>(
    record ? mergeSavedDocument(record, projectSpecification) : null,
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isPdfWorking, setIsPdfWorking] = useState(false);
  const [preparedShareFile, setPreparedShareFile] = useState<File | null>(null);
  const linesTotal = useMemo(
    () => documents?.invoiceLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) ?? 0,
    [documents],
  );

  if (!record || !documents) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{history.error ? t("documents.readFailed") : t("documents.orderNotFound")}</CardTitle>
          <CardDescription>{history.error || t("documents.orderNotFoundDescription")}</CardDescription>
        </CardHeader>
        <CardContent><Button asChild variant="outline"><Link to="/dashboard/history">{t("documents.backToHistory")}</Link></Button></CardContent>
      </Card>
    );
  }
  const savedRecord = record;

  function update<K extends keyof OrderDocuments>(key: K, value: OrderDocuments[K]) {
    setDocuments((current) => current ? { ...current, [key]: value } : current);
    setPreparedShareFile(null);
    setSaveMessage("");
    setSaveError("");
  }

  async function saveDocuments(): Promise<OrderDocuments | null> {
    if (!documents) return null;
    try {
      await updateDemoRecordDocuments(savedRecord.id, documents);
      setSaveMessage(t("documents.saved"));
      setSaveError("");
      return documents;
    } catch (error) {
      setSaveMessage("");
      setSaveError(error instanceof DemoStoreError ? t(`demoErrors.${error.code}`) : t("documents.saveFailed"));
      return null;
    }
  }

  async function printDocument() {
    if (!await saveDocuments()) return;
    const originalTitle = document.title;
    document.title = `${savedRecord.record_number}-${activeDocument}`;
    window.addEventListener("afterprint", () => {
      document.title = originalTitle;
    }, { once: true });
    window.setTimeout(() => window.print(), 100);
  }

  async function createWorkPaperPdf(): Promise<File | null> {
    if (!await saveDocuments()) return null;
    const paper = document.querySelector<HTMLElement>("#print-document .work-paper");
    if (!paper) {
      throw new Error("Work paper preview is unavailable.");
    }
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(paper, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageMargin = 10;
    const pageWidth = 210 - pageMargin * 2;
    const pageHeight = 297 - pageMargin * 2;
    const pageSliceHeight = Math.floor((canvas.width * pageHeight) / pageWidth);
    let pageIndex = 0;

    for (let y = 0; y < canvas.height; y += pageSliceHeight) {
      const sliceHeight = Math.min(pageSliceHeight, canvas.height - y);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare the PDF page.");
      context.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        pageCanvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        pageMargin,
        pageMargin,
        pageWidth,
        (sliceHeight / canvas.width) * pageWidth,
      );
      pageIndex += 1;
    }

    const blob = pdf.output("blob");
    return new File([blob], `${savedRecord.record_number}-coating-work-paper.pdf`, { type: "application/pdf" });
  }

  function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveWorkPaperPdf() {
    setIsPdfWorking(true);
    setSaveError("");
    try {
      const file = await createWorkPaperPdf();
      if (!file) return;
      downloadFile(file);
      setSaveMessage(t("documents.pdfDownloaded"));
    } catch (error) {
      console.error("Unable to create the coating work paper PDF.", error);
      setSaveMessage("");
      setSaveError(t("documents.pdfFailed"));
    } finally {
      setIsPdfWorking(false);
    }
  }

  async function shareWorkPaperPdf() {
    if (preparedShareFile) {
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [preparedShareFile] })) {
        try {
          await navigator.share({ files: [preparedShareFile], title: savedRecord.record_number });
          setSaveMessage(t("documents.pdfShared"));
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("Unable to share the coating work paper PDF.", error);
          setSaveMessage("");
          setSaveError(t("documents.shareFailed"));
        }
        return;
      }
      downloadFile(preparedShareFile);
      setPreparedShareFile(null);
      setSaveMessage(t("documents.shareFallback"));
      return;
    }

    setIsPdfWorking(true);
    setSaveError("");
    try {
      const file = await createWorkPaperPdf();
      if (!file) return;
      setPreparedShareFile(file);
      setSaveMessage(t("documents.pdfReadyToShare"));
    } catch (error) {
      console.error("Unable to share the coating work paper PDF.", error);
      setSaveMessage("");
      setSaveError(t("documents.shareFailed"));
    } finally {
      setIsPdfWorking(false);
    }
  }

  async function exportInvoiceWorkbook() {
    const saved = documents;
    if (!saved) return;
    if (!await saveDocuments()) return;
    try {
      const XLSX = await import("xlsx");
      const invoiceLines = saved.invoiceLines;
      const detailStartRow = 6;
      const invoiceRows: Array<Array<string | number>> = [
        ["Dijei Coat"],
        [t("documents.payerCompany"), saved.customerName],
        [t("documents.invoiceDate"), saved.invoiceDate],
        [],
        [t("documents.itemName"), t("documents.pricePerPiece"), t("documents.numberOfItems"), t("documents.amount")],
        ...invoiceLines.map((line) => [line.description, line.unitPrice, line.quantity, ""]),
        [t("documents.grandTotal"), "", "", ""],
      ];
      const invoiceSheet = XLSX.utils.aoa_to_sheet(invoiceRows);
      const lastDetailRow = detailStartRow + invoiceLines.length - 1;
      invoiceLines.forEach((_, index) => {
        const row = detailStartRow + index;
        invoiceSheet[`D${row}`] = { t: "n", f: `B${row}*C${row}`, z: '"₩"#,##0.00' };
        invoiceSheet[`B${row}`] = { ...(invoiceSheet[`B${row}`] ?? { t: "n", v: 0 }), z: '"₩"#,##0.00' };
      });
      const totalRow = detailStartRow + invoiceLines.length;
      invoiceSheet[`D${totalRow}`] = { t: "n", f: `SUM(D${detailStartRow}:D${lastDetailRow})`, z: '"₩"#,##0.00' };
      invoiceSheet["!cols"] = [{ wch: 34 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, invoiceSheet, "Invoice");
      XLSX.writeFile(workbook, `${savedRecord.record_number}-invoice.xlsx`);
    } catch {
      setSaveError(t("documents.exportFailed"));
    }
  }

  const currency = documents.currency || "KRW";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{t("documents.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("documents.title")}</h1>
          <p className="mt-2 text-muted-foreground">{record.record_number} · {record.project_name_snapshot}</p>
        </div>
        <Button asChild variant="outline"><Link to="/dashboard/history">{t("documents.backToHistory")}</Link></Button>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" variant={activeDocument === "workPaper" ? "default" : "outline"} onClick={() => setActiveDocument("workPaper")}>{t("documents.workPaper")}</Button>
        <Button type="button" variant={activeDocument === "invoice" ? "default" : "outline"} onClick={() => setActiveDocument("invoice")}>{t("documents.invoice")}</Button>
      </div>

      {activeDocument === "workPaper" && (
        <div className="no-print flex flex-wrap gap-2">
          <Button type="button" onClick={() => void saveWorkPaperPdf()} disabled={isPdfWorking}>
            <FileDown />{isPdfWorking ? t("documents.preparingPdf") : t("documents.savePdf")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void shareWorkPaperPdf()} disabled={isPdfWorking}>
            <Share2 />{isPdfWorking ? t("documents.preparingPdf") : preparedShareFile ? t("documents.openShare") : t("documents.prepareShare")}
          </Button>
          <Button type="button" variant="outline" onClick={printDocument}><Printer />{t("documents.printPdf")}</Button>
        </div>
      )}

      <div className="grid gap-5">
        <Card className="no-print">
          <CardHeader>
            <CardTitle>{activeDocument === "workPaper" ? t("documents.editWorkPaper") : t("documents.editInvoice")}</CardTitle>
            <CardDescription>{activeDocument === "workPaper" ? t("documents.verifyCoatingSpec") : t("documents.editBeforeExport")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {activeDocument === "workPaper" && <div className="space-y-2"><Label htmlFor="supplier">{t("documents.supplier")}</Label><Input id="supplier" value={documents.supplierName} onChange={(event) => update("supplierName", event.target.value)} /></div>}
              {activeDocument === "workPaper" ? (
                <>
                  <div className="space-y-2"><Label htmlFor="work-project">{t("documents.project")}</Label><Input id="work-project" value={documents.projectName} onChange={(event) => update("projectName", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="work-product">{t("documents.product")}</Label><Input id="work-product" value={documents.productName} onChange={(event) => update("productName", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="work-part-number">{t("documents.partNumber")}</Label><Input id="work-part-number" value={documents.partNumber} onChange={(event) => update("partNumber", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="work-lot">{t("documents.lotNumbers")}</Label><Input id="work-lot" value={documents.lotNumber} onChange={(event) => update("lotNumber", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="work-quantity">{t("documents.quantity")}</Label><Input id="work-quantity" value={documents.quantity} onChange={(event) => update("quantity", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="work-unit">{t("documents.unit")}</Label><Input id="work-unit" value={documents.unit} onChange={(event) => update("unit", event.target.value)} /></div>
                  <div className="space-y-2 sm:col-span-2"><Label htmlFor="dimensions">{t("documents.dimensions")}</Label><Input id="dimensions" value={documents.dimensions} onChange={(event) => update("dimensions", event.target.value)} placeholder={t("documents.dimensionsPlaceholder")} /></div>
                  <div className="space-y-2"><Label htmlFor="coat-one">{t("documents.topCoat")}</Label><Input id="coat-one" value={documents.firstCoatName} onChange={(event) => update("firstCoatName", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="coat-one-thickness">{t("documents.topCoatThickness")}</Label><Input id="coat-one-thickness" value={documents.firstCoatThickness} onChange={(event) => update("firstCoatThickness", event.target.value)} placeholder={t("documents.thicknessPlaceholder")} /></div>
                  <div className="space-y-2"><Label htmlFor="coat-two">{t("documents.bottomCoat")}</Label><Input id="coat-two" value={documents.secondCoatName} onChange={(event) => update("secondCoatName", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="coat-two-thickness">{t("documents.bottomCoatThickness")}</Label><Input id="coat-two-thickness" value={documents.secondCoatThickness} onChange={(event) => update("secondCoatThickness", event.target.value)} placeholder={t("documents.thicknessPlaceholder")} /></div>
                  <div className="space-y-2"><Label htmlFor="inspector-name">{t("documents.inspectorName")}</Label><Input id="inspector-name" value={documents.inspectorName} onChange={(event) => update("inspectorName", event.target.value)} /></div>
                </>
              ) : (
                <>
                  <div className="space-y-2"><Label htmlFor="invoice-date">{t("documents.invoiceDate")}</Label><Input id="invoice-date" type="date" value={documents.invoiceDate} onChange={(event) => update("invoiceDate", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="customer">{t("documents.payerCompany")}</Label><Input id="customer" value={documents.customerName} onChange={(event) => update("customerName", event.target.value)} /></div>
                </>
              )}
              {activeDocument === "workPaper" && <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="supplier-address">{t("documents.supplierAddress")}</Label><Input id="supplier-address" value={documents.supplierAddress} onChange={(event) => update("supplierAddress", event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="supplier-phone">{t("documents.supplierPhone")}</Label><Input id="supplier-phone" value={documents.supplierPhone} onChange={(event) => update("supplierPhone", event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="supplier-email">{t("documents.supplierEmail")}</Label><Input id="supplier-email" type="email" value={documents.supplierEmail} onChange={(event) => update("supplierEmail", event.target.value)} /></div>
              </div>}
              {activeDocument === "workPaper" && <div className="space-y-2 sm:col-span-2"><Label htmlFor="additional-details">{t("documents.additionalDetails")}</Label><textarea id="additional-details" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={documents.additionalDetails} onChange={(event) => update("additionalDetails", event.target.value)} /></div>}
            </div>

            {activeDocument === "invoice" && (
              <>
                <div className="space-y-3">
                  <h2 className="font-semibold">{t("documents.invoiceLines")}</h2>
                  {documents.invoiceLines.map((line, index) => (
                    <div key={`${record.items[index]?.id ?? index}`} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                      <div className="space-y-2"><Label htmlFor={`invoice-description-${index}`}>{t("documents.itemName")}</Label><Input id={`invoice-description-${index}`} value={line.description} onChange={(event) => update("invoiceLines", documents.invoiceLines.map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value } : entry))} /></div>
                      <div className="space-y-2"><Label htmlFor={`invoice-price-${index}`}>{t("documents.pricePerPiece")}</Label><Input id={`invoice-price-${index}`} type="number" min="0" step="any" value={line.unitPrice} onChange={(event) => update("invoiceLines", documents.invoiceLines.map((entry, entryIndex) => entryIndex === index ? { ...entry, unitPrice: Math.max(0, Number(event.target.value) || 0) } : entry))} /></div>
                      <div className="space-y-2"><Label htmlFor={`invoice-quantity-${index}`}>{t("documents.numberOfItems")}</Label><Input id={`invoice-quantity-${index}`} type="number" min="0" step="1" value={line.quantity} onChange={(event) => update("invoiceLines", documents.invoiceLines.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: Math.max(0, Number(event.target.value) || 0) } : entry))} /></div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={() => update("invoiceLines", [...documents.invoiceLines, { description: "", partNumber: "", quantity: 0, unit: "", unitPrice: 0 }])}>{t("documents.addInvoiceItem")}</Button>
                </div>
                <dl className="ml-auto grid max-w-sm grid-cols-2 gap-2 text-sm">
                  <dt className="font-semibold">{t("documents.grandTotal")}</dt><dd className="text-right font-semibold">{formatAmount(linesTotal, currency)}</dd>
                </dl>
              </>
            )}

            {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
            {saveMessage && <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">{saveMessage}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={saveDocuments}><Save />{t("documents.save")}</Button>
              {activeDocument === "invoice" && <Button type="button" onClick={() => void exportInvoiceWorkbook()}><FileSpreadsheet />{t("documents.exportExcel")}<Download /></Button>}
            </div>
          </CardContent>
        </Card>

        <section id="print-document" className="document-preview rounded-lg border bg-white p-6 text-slate-900 shadow-sm sm:p-8">
          {activeDocument === "workPaper" ? (
            <WorkPaperPreview record={record} documents={documents} specification={projectSpecification} title={t("documents.workPaper")} />
          ) : (
            <InvoicePreview
              documents={documents}
              total={linesTotal}
              title="Dijei Coat"
            />
          )}
        </section>
      </div>
    </div>
  );
}

function WorkPaperPreview({ record, documents, specification, title }: { record: DemoWorkRecord; documents: OrderDocuments; specification?: ProjectSpecSnapshot; title: string }) {
  const { t } = useTranslation();
  return (
    <div className="work-paper space-y-0">
      <header className="work-paper-header">
        <div className="work-paper-company">{documents.supplierName || "Dijei Coat"}</div>
        <div className="work-paper-heading"><h2>공 정 식 별 표</h2><p>{title} · {record.record_number}</p></div>
      </header>
      <table className="work-paper-table work-paper-fields">
        <tbody>
          <tr><th>{t("documents.project")}</th><td colSpan={3}>{documents.projectName || "\u00a0"}</td></tr>
          <tr><th>{t("documents.maker")}</th><td colSpan={3}>{specification?.maker || "\u00a0"}</td></tr>
          <tr><th>{t("documents.product")}</th><td>{documents.productName || "\u00a0"}</td><th>{t("documents.quantity")}</th><td>{[documents.quantity, documents.unit].filter(Boolean).join(" ") || "\u00a0"}</td></tr>
          <tr><th>{t("documents.partNumber")}</th><td colSpan={3}>{documents.partNumber || "\u00a0"}</td></tr>
          <tr><th>{t("documents.lotNumbers")}</th><td colSpan={3}>{documents.lotNumber || "\u00a0"}</td></tr>
          <tr><th>{t("documents.supplier")}</th><td colSpan={3}>{documents.supplierName || "\u00a0"}</td></tr>
          <tr><th>{t("documents.overallThickness")}</th><td colSpan={3}>{specification?.thickness_text || "\u00a0"}</td></tr>
          <tr><th>{t("documents.dimensions")}</th><td colSpan={3}>{documents.dimensions || "\u00a0"}</td></tr>
          <tr><th>{t("documents.invoiceDate")}</th><td colSpan={3}>{documents.invoiceDate || "\u00a0"}</td></tr>
        </tbody>
      </table>
      <div className="work-paper-section-title">{t("documents.coatingInstructions")}</div>
      <table className="work-paper-table work-paper-coats">
        <thead><tr><th>{t("documents.sequence")}</th><th>{t("documents.coatName")}</th><th>{t("documents.coatThickness")}</th></tr></thead>
        <tbody>
          <PaperRow label={t("documents.topCoat")} value={documents.firstCoatName} extra={documents.firstCoatThickness} />
          <PaperRow label={t("documents.bottomCoat")} value={documents.secondCoatName} extra={documents.secondCoatThickness} />
        </tbody>
      </table>
      <section className="work-paper-special">
        <h3>{t("documents.additionalDetails")}</h3>
        <p>{documents.additionalDetails || "\u00a0"}</p>
      </section>
      <footer className="work-paper-signatures">
        <div><span>{t("documents.inspectedBy")}</span><i>{documents.inspectorName || "\u00a0"}</i></div>
        <div><span>{t("documents.approvedBy")}</span><i /></div>
        <div><span>{t("documents.invoiceDate")}</span><i>{documents.invoiceDate}</i></div>
      </footer>
    </div>
  );
}

function PaperRow({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{value || "\u00a0"}</td>
      {extra !== undefined && <td>{extra || "\u00a0"}</td>}
    </tr>
  );
}

function InvoicePreview({
  documents,
  total,
  title,
}: {
  documents: OrderDocuments;
  total: number;
  title: string;
}) {
  const { t } = useTranslation();
  const currency = documents.currency || "KRW";
  return (
    <div className="simple-invoice">
      <header><h1>{title}</h1><p>{t("documents.invoice")}</p></header>
      <div className="simple-invoice-meta">
        <p><strong>{t("documents.payerCompany")}:</strong> {documents.customerName || "\u00a0"}</p>
        <p><strong>{t("documents.invoiceDate")}:</strong> {documents.invoiceDate || "\u00a0"}</p>
      </div>
      <table>
        <thead><tr><th>{t("documents.itemName")}</th><th>{t("documents.pricePerPiece")}</th><th>{t("documents.numberOfItems")}</th><th>{t("documents.amount")}</th></tr></thead>
        <tbody>
          {documents.invoiceLines.map((line, index) => (
            <tr key={index}>
              <td>{line.description || "\u00a0"}</td>
              <td>{line.unitPrice ? formatAmount(line.unitPrice, currency) : "\u00a0"}</td>
              <td>{line.quantity || "\u00a0"}</td>
              <td>{line.unitPrice && line.quantity ? formatAmount(line.quantity * line.unitPrice, currency) : "\u00a0"}</td>
            </tr>
          ))}
          <tr className="simple-invoice-total"><th colSpan={3}>{t("documents.grandTotal")}</th><td>{formatAmount(total, currency)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
