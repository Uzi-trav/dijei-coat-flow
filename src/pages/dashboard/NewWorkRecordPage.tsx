import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import {
  getDemoData,
  refreshDemoData,
  addDemoItem,
  DemoStoreError,
  saveDemoWorkRecord,
  type DemoItem,
  type DemoProject,
  type ProjectSpecSnapshot,
} from "@/lib/demoStore";
import type { ProjectCoatingStage } from "@/lib/initialProjectMaster";
import { searchProjects } from "@/lib/projectSearch";
import type { DraftItem, WorkRecordDraft, WorkerFlowState } from "@/lib/workerFlow";

function newDraftItem(key: number): DraftItem {
  return { key, itemId: "", itemName: "", partNumber: "", quantity: "1", unit: "EA", notes: "" };
}

function makeSpecSnapshot(project: DemoProject): ProjectSpecSnapshot {
  return {
    source_project_id: project.id,
    source_row: project.source_row ?? null,
    verification_status: project.verification_status,
    maker: project.maker ?? "",
    coating_stages: structuredClone(project.coating_stages ?? []),
    thickness_text: project.thickness_text ?? "",
    notes: (project.notes ?? []).join("\n"),
    source_text: project.source_text ?? "",
  };
}

function projectFromDraft(projects: DemoProject[], projectId: string): DemoProject | undefined {
  return projects.find((project) => project.id === projectId);
}

function readThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("THUMBNAIL_READ_FAILED"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("THUMBNAIL_DECODE_FAILED"));
      image.onload = () => {
        const scale = Math.min(1, 256 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("THUMBNAIL_CANVAS_UNAVAILABLE"));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function NewWorkRecordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isWorkerFlow = location.pathname === "/work/review";
  const flowState = (location.state as WorkerFlowState | null) ?? {};
  const initialDraft = flowState.draft;
  const [masterData, setMasterData] = useState(() => {
    try {
      const data = getDemoData();
      return {
        projects: data.projects.filter((project) => project.is_active),
        items: data.items.filter((item) => item.is_active),
        error: null as string | null,
      };
    } catch (error) {
      return {
        projects: [] as DemoProject[],
        items: [] as DemoItem[],
        error: error instanceof DemoStoreError ? error.code : "STORAGE_ERROR",
      };
    }
  });
  const [refreshingMaster, setRefreshingMaster] = useState(true);
  const projects = masterData.projects;
  const [items, setItems] = useState<DemoItem[]>(masterData.items);
  useEffect(() => {
    let active = true;
    void refreshDemoData()
      .then((data) => {
        if (!active) return;
        const refreshedMaster = {
          projects: data.projects.filter((project) => project.is_active),
          items: data.items.filter((item) => item.is_active),
          error: null,
        };
        setMasterData(refreshedMaster);
        setItems(refreshedMaster.items);
      })
      .catch((refreshError) => {
        if (!active) return;
        setMasterData((current) => ({
          ...current,
          error: refreshError instanceof DemoStoreError ? refreshError.code : "REMOTE_ERROR",
        }));
      })
      .finally(() => {
        if (active) setRefreshingMaster(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const initialProject = initialDraft ? projectFromDraft(projects, initialDraft.projectId) : undefined;
  const [projectId, setProjectId] = useState(initialDraft?.projectId ?? "");
  const [projectSearch, setProjectSearch] = useState(
    initialDraft?.projectSearch ?? initialProject?.name ?? initialDraft?.projectName ?? "",
  );
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectSpec, setProjectSpec] = useState<ProjectSpecSnapshot | null>(
    initialDraft?.projectSpec ?? (initialProject ? makeSpecSnapshot(initialProject) : null),
  );
  const [lotNumber, setLotNumber] = useState(initialDraft?.lotNumber ?? "");
  const notes = initialDraft?.notes ?? "";
  const [draftItems, setDraftItems] = useState<DraftItem[]>(
    initialDraft?.draftItems ?? [newDraftItem(0)],
  );
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemProjectId, setNewItemProjectId] = useState("");
  const [newItemThumbnail, setNewItemThumbnail] = useState("");
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matchingProjects = useMemo(
    () => (projectSearch.trim()
      ? searchProjects(projects, projectSearch)
      : [...projects].sort((left, right) =>
        (left.source_row ?? Number.MAX_SAFE_INTEGER) - (right.source_row ?? Number.MAX_SAFE_INTEGER)
        || left.name.localeCompare(right.name),
      )),
    [projects, projectSearch],
  );
  const selectedProject = projectFromDraft(projects, projectId);
  const isUnlistedProject = projectId === "__new__";

  async function handleThumbnail(file: File | undefined) {
    if (!file) {
      setNewItemThumbnail("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setItemSaveError(t("record.itemThumbnailImageOnly"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setItemSaveError(t("record.itemThumbnailTooLarge"));
      return;
    }
    try {
      setItemSaveError(null);
      setNewItemThumbnail(await readThumbnail(file));
    } catch {
      setItemSaveError(t("record.itemThumbnailReadError"));
    }
  }

  async function submitNewItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setItemSaveError(null);
    setSavingItem(true);
    try {
      const created = await addDemoItem(newItemName, [], {
        projectId: newItemProjectId,
        thumbnailDataUrl: newItemThumbnail,
      });
      setItems((current) => [...current, created]);
      updateItem(draftItems[0].key, {
        itemId: created.id,
        itemName: created.canonical_name,
        partNumber: created.part_numbers[0] ?? "",
      });
      setItemDialogOpen(false);
      setNewItemName("");
      setNewItemProjectId("");
      setNewItemThumbnail("");
    } catch (error) {
      setItemSaveError(error instanceof DemoStoreError
        ? t(`demoErrors.${error.code}`)
        : t("record.itemSaveError"));
    } finally {
      setSavingItem(false);
    }
  }

  function updateItem(key: number, patch: Partial<DraftItem>) {
    setDraftItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function selectProject(project: DemoProject) {
    const isNewSelection = project.id !== projectId;
    setProjectId(project.id);
    setProjectSearch(project.name);
    setProjectPickerOpen(false);
    if (isNewSelection) {
      setProjectSpec(makeSpecSnapshot(project));
    }
    setError(null);
  }

  function useUnlistedProject() {
    if (!projectSearch.trim()) return;
    setProjectId("__new__");
    setProjectSpec(null);
    setProjectPickerOpen(false);
    setError(null);
  }

  function changeProjectSearch(value: string) {
    setProjectSearch(value);
    if (value !== (selectedProject?.name ?? (isUnlistedProject ? projectSearch : ""))) {
      setProjectId("");
      setProjectSpec(null);
    }
  }

  function updateCoatingStage(stageName: ProjectCoatingStage["stage"], specification: string) {
    setProjectSpec((current) => {
      if (!current) return current;
      const existing = current.coating_stages.find((stage) => stage.stage === stageName);
      const updatedStage: ProjectCoatingStage = existing
        ? { ...existing, specification }
        : {
            stage: stageName,
            scope: null,
            specification,
            paint_code: null,
            color: null,
            finish: null,
            thickness_text: null,
          };
      return {
        ...current,
        coating_stages: existing
          ? current.coating_stages.map((stage) => stage.stage === stageName ? updatedStage : stage)
          : [...current.coating_stages, updatedStage],
      };
    });
  }

  function validate(): string | null {
    if (!projectId) return t("record.validationProject");
    if (isUnlistedProject && !projectSearch.trim()) return t("record.validationProjectName");
    const item = draftItems[0];
    if (!item?.itemId && !item?.itemName.trim()) return t("record.validationItemName", { index: 1 });
    if (!item.quantity || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
      return t("record.validationQuantity", { index: 1 });
    }
    return null;
  }

  function startReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setConfirmed(false);
    setReviewing(true);
  }

  async function submitRecord() {
    if (!confirmed || savingRef.current) {
      if (!confirmed) setError(t("record.confirmBeforeSave"));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
    try {
      const record = await saveDemoWorkRecord({
        projectId,
        projectName: projectSearch,
        lotNumber,
        notes,
        ...(projectSpec ? { projectSpecSnapshot: projectSpec } : {}),
        items: draftItems.slice(0, 1).map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          partNumber: item.partNumber,
          quantity: Number(item.quantity),
          unit: item.unit,
          notes: item.notes,
        })),
      });
      if (isWorkerFlow) {
        navigate("/dashboard/history", { state: { savedRecordId: record.id } });
      } else {
        navigate("/dashboard/history", { state: { savedRecordId: record.id } });
      }
    } catch (submitError) {
      setError(t("record.saveError", {
        error: submitError instanceof DemoStoreError
          ? t(`demoErrors.${submitError.code}`)
          : t("record.storageError"),
      }));
      savingRef.current = false;
      setSaving(false);
    }
  }

  const workerDraft: WorkRecordDraft = {
    projectId,
    projectSearch,
    projectName: isUnlistedProject ? projectSearch : "",
    projectSpec,
    lotNumber,
    notes,
    draftItems,
  };
  const projectLabel = selectedProject?.name ?? (isUnlistedProject ? projectSearch.trim() : "");
  const stageRows = projectSpec?.coating_stages ?? [];
  const orderQuantity = Number(draftItems[0]?.quantity ?? 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {isWorkerFlow && (
        <header className="flex h-12 items-center gap-3 border-b border-border">
          <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
            <Link to="/"><ArrowLeft aria-hidden="true" /></Link>
          </Button>
          <img src="/dijei-coat-logo.png" alt="Dijei Coat" className="h-auto max-h-12 w-[170px] object-contain" />
        </header>
      )}
      <div>
        <p className="text-sm font-medium text-muted-foreground">{t("record.eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {isWorkerFlow ? t("worker.reviewTitle") : t("record.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isWorkerFlow ? t("worker.reviewDescription") : t("record.description")}
        </p>
      </div>

      {isWorkerFlow && flowState.imageDataUrl && (
        <Card className="gap-3">
          <CardContent className="flex flex-wrap items-center gap-4">
            <img src={flowState.imageDataUrl} alt={t("scanner.previewAlt")} className="h-24 w-32 rounded-md border border-border object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t("scanner.imageAttached")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("scanner.ocrUnavailable")}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => navigate("/scan", { state: { draft: workerDraft, imageDataUrl: flowState.imageDataUrl } })}>
              <Camera aria-hidden="true" />{t("scanner.retake")}
            </Button>
          </CardContent>
        </Card>
      )}
      {isWorkerFlow && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm" role="note">
          {t("worker.specificationNotice")}
        </div>
      )}
      {masterData.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          {t("record.localReadError", { error: t(`demoErrors.${masterData.error}`) })}
        </div>
      )}
      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</div>}

      {itemDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingItem) setItemDialogOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="add-catalog-item-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="add-catalog-item-title" className="text-xl font-semibold">{t("record.addCatalogItemTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("record.addCatalogItemDescription")}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={t("common.close")} onClick={() => setItemDialogOpen(false)} disabled={savingItem}><X /></Button>
            </div>
            <form onSubmit={submitNewItem} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="catalog-item-name">{t("record.itemName")} *</Label>
                <Input id="catalog-item-name" value={newItemName} onChange={(event) => setNewItemName(event.target.value)} required maxLength={200} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-item-project">{t("record.relatedProject")} ({t("common.optional")})</Label>
                <select id="catalog-item-project" className="h-11 w-full rounded-md border border-input bg-background px-3 text-base" value={newItemProjectId} onChange={(event) => setNewItemProjectId(event.target.value)}>
                  <option value="">{t("record.noRelatedProject")}</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-item-thumbnail">{t("record.itemThumbnail")}</Label>
                <Input id="catalog-item-thumbnail" type="file" accept="image/*" onChange={(event) => void handleThumbnail(event.target.files?.[0])} />
                {newItemThumbnail && <img src={newItemThumbnail} alt={t("record.itemThumbnailPreview")} className="h-28 w-36 rounded-md border object-cover" />}
                <p className="text-xs text-muted-foreground">{t("record.itemThumbnailHelp")}</p>
              </div>
              {itemSaveError && <p className="text-sm text-destructive" role="alert">{itemSaveError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)} disabled={savingItem}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={savingItem || refreshingMaster || !newItemName.trim()}>{savingItem ? t("record.saving") : t("record.saveItem")}</Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {!reviewing ? (
        <form onSubmit={startReview} className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>1. {t("record.project")}</CardTitle>
              <CardDescription>{t("record.workInfoDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="space-y-2"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setProjectPickerOpen(false);
                  }
                }}
              >
                <Label htmlFor="project">{t("record.project")} <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="project"
                    value={projectSearch}
                    onFocus={() => setProjectPickerOpen(true)}
                    onChange={(event) => {
                      changeProjectSearch(event.target.value);
                      setProjectPickerOpen(true);
                    }}
                    placeholder={t("record.projectSearchPlaceholder")}
                    required
                    autoComplete="off"
                    maxLength={200}
                    aria-expanded={projectPickerOpen}
                    aria-controls="project-options"
                    aria-autocomplete="list"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    aria-label={t("record.openProjectList")}
                    aria-expanded={projectPickerOpen}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setProjectPickerOpen((open) => !open)}
                  >
                    <ChevronDown className={projectPickerOpen ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden="true" />
                  </button>
                </div>
                {selectedProject && <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("record.projectSelected", { name: selectedProject.name })}</p>}
                {isUnlistedProject && <p className="text-sm text-amber-700 dark:text-amber-300">{t("record.unlistedProjectNotice")}</p>}
                {projectPickerOpen && !isUnlistedProject && (
                  <>
                    {projectSearch.trim() && matchingProjects.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">{t("record.projectMatchReview")}</p>
                    )}
                    <div id="project-options" className="mt-1 max-h-64 overflow-y-auto rounded-md border bg-background shadow-md" role="listbox" aria-label={t("record.projectMatches")}>
                    {matchingProjects.map((project) => (
                      <button key={project.id} type="button" role="option" aria-selected={projectId === project.id} className="flex min-h-12 w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60" onClick={() => selectProject(project)}>
                        <span>
                          <span className="block font-medium">{project.name}</span>
                          <span className="text-xs text-muted-foreground">{project.source_row ? `#${project.source_row} · ` : ""}{project.maker || t("record.makerNotListed")}</span>
                        </span>
                        <span className="text-xs text-amber-700 dark:text-amber-300">{t("record.pendingVerification")}</span>
                      </button>
                    ))}
                    {matchingProjects.length === 0 && projectSearch.trim() && (
                      <div className="p-3 text-sm text-muted-foreground">{t("record.noProjectMatches")}</div>
                    )}
                    {projectSearch.trim() && (
                      <button type="button" className="min-h-12 w-full px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted/60" onClick={useUnlistedProject}>
                        {t("record.useUnlistedProject", { name: projectSearch })}
                      </button>
                    )}
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lot-number">{t("record.lotNumber")} ({t("common.optional")})</Label>
                <Input
                  id="lot-number"
                  value={lotNumber}
                  onChange={(event) => setLotNumber(event.target.value)}
                  placeholder={t("record.lotNumberPlaceholder")}
                  autoComplete="off"
                  maxLength={100}
                />
              </div>
            </CardContent>
          </Card>

          {projectSpec ? (
            <Card>
              <CardHeader>
                <CardTitle>4. {t("record.projectSpecification")}</CardTitle>
                <CardDescription>{t("record.specificationEditable")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-200">
                  {t("record.pendingSpecWarning")}
                </div>
                {selectedProject?.source_row && <p className="text-xs text-muted-foreground">{t("record.sourceRow", { number: selectedProject.source_row })}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="project-maker">{t("record.maker")}</Label>
                    <Input id="project-maker" value={projectSpec.maker} onChange={(event) => setProjectSpec((current) => current ? { ...current, maker: event.target.value } : current)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-total-thickness">{t("record.totalCoatMeasure")}</Label>
                    <Input id="project-total-thickness" value={projectSpec.thickness_text} onChange={(event) => setProjectSpec((current) => current ? { ...current, thickness_text: event.target.value } : current)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-top-coat">{t("documents.topCoat")}</Label>
                    <Input id="project-top-coat" value={projectSpec.coating_stages.find((stage) => stage.stage === "top")?.specification ?? ""} onChange={(event) => updateCoatingStage("top", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-bottom-coat">{t("documents.bottomCoat")}</Label>
                    <Input id="project-bottom-coat" value={projectSpec.coating_stages.find((stage) => stage.stage === "bottom")?.specification ?? ""} onChange={(event) => updateCoatingStage("bottom", event.target.value)} />
                  </div>
                </div>
                <dl className="divide-y rounded-md border">
                  {stageRows.filter((stage) => stage.stage !== "other").map((stage, index) => (
                    <div key={`${stage.stage}-${index}`} className="grid gap-1 p-3 sm:grid-cols-[9rem_1fr]">
                      <dt className="font-medium">{t(`record.stage.${stage.stage}`)}{stage.scope ? ` · ${stage.scope}` : ""}</dt>
                      <dd className="space-y-1 text-sm text-muted-foreground">
                        <p>{stage.specification}</p>
                        {(stage.paint_code || stage.color || stage.finish) && (
                          <p>{[stage.paint_code, stage.color, stage.finish].filter(Boolean).join(" · ")}</p>
                        )}
                        <p>{t("record.coatMeasure")}: {stage.thickness_text || t("record.coatMeasureNotListed")}</p>
                      </dd>
                    </div>
                  ))}
                  {!stageRows.some((stage) => stage.stage !== "other") && (
                    <div className="p-3 text-sm text-muted-foreground">{t("record.noCoatingStagesListed")}</div>
                  )}
                </dl>
                <p className="rounded-md bg-muted/40 p-3 text-sm">
                  <span className="font-medium">{t("record.totalCoatMeasure")}: </span>
                  {projectSpec.thickness_text || t("record.coatMeasureNotListed")}
                </p>
              </CardContent>
            </Card>
          ) : projectId && !isUnlistedProject ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">{t("record.specificationMissing")}</div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>2–3. {t("record.itemAndObjectCount")}</CardTitle>
              <CardDescription>{t("record.itemCountDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
          {draftItems.slice(0, 1).map((item) => (
              <div key={item.key} className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`item-name-${item.key}`}>{t("record.itemName")} <span className="text-destructive">*</span></Label>
                  <select
                    id={`item-name-${item.key}`}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                    value={item.itemId || (item.itemName.trim() ? "__recognized__" : "")}
                    onChange={(event) => {
                      if (event.target.value === "__recognized__") {
                        updateItem(item.key, { itemId: "" });
                        return;
                      }
                      const selected = items.find((catalogItem) => catalogItem.id === event.target.value);
                      updateItem(item.key, {
                        itemId: selected?.id ?? "",
                        itemName: selected?.canonical_name ?? "",
                        partNumber: selected?.part_numbers[0] ?? "",
                      });
                    }}
                    required
                  >
                    <option value="">{t("record.selectCatalogItem")}</option>
                    {!item.itemId && item.itemName.trim() && <option value="__recognized__">{item.itemName} · {t("history.proposedItem")}</option>}
                    {items.map((catalogItem) => {
                      const relatedProject = projects.find((project) => project.id === catalogItem.project_id);
                      return (
                        <option key={catalogItem.id} value={catalogItem.id}>
                          {catalogItem.canonical_name}{relatedProject ? ` · ${relatedProject.name}` : ""}
                        </option>
                      );
                    })}
                  </select>
                  {!item.itemId && item.itemName.trim() && (
                    <div className="space-y-2">
                      <Label htmlFor={`recognized-item-${item.key}`}>{t("record.recognizedItemName")}</Label>
                      <Input
                        id={`recognized-item-${item.key}`}
                        value={item.itemName}
                        onChange={(event) => updateItem(item.key, { itemName: event.target.value })}
                        autoComplete="off"
                      />
                      <p className="text-sm text-muted-foreground">{t("record.recognizedItemNotice")}</p>
                    </div>
                  )}
                  {!items.length && !item.itemName.trim() && <p className="text-sm text-muted-foreground">{t("record.itemCatalogEmpty")}</p>}
                  <Button type="button" variant="outline" size="sm" onClick={() => { setItemDialogOpen(true); setItemSaveError(null); }}>
                    <Plus aria-hidden="true" />{t("record.openAddItem")}
                  </Button>
                  {items.find((catalogItem) => catalogItem.id === item.itemId)?.thumbnail_data_url && (
                    <img src={items.find((catalogItem) => catalogItem.id === item.itemId)?.thumbnail_data_url ?? ""} alt={t("record.selectedItemThumbnail")} className="h-20 w-28 rounded-md border object-cover" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${item.key}`}>{t("record.numberOfObjects")} <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Input id={`quantity-${item.key}`} type="number" min="1" step="1" inputMode="numeric" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.target.value })} required />
                    <select
                      aria-label={t("record.unit")}
                      className="h-11 w-24 rounded-md border border-input bg-background px-2 text-sm"
                      value={item.unit || "EA"}
                      onChange={(event) => updateItem(item.key, { unit: event.target.value })}
                    >
                      <option value="EA">EA</option>
                      <option value="SET">SET</option>
                      <option value="PCS">PCS</option>
                      <option value="BOX">BOX</option>
                    </select>
                  </div>
                </div>
              </div>
          ))}
            </CardContent>
          </Card>
          <div className="flex justify-end"><Button type="submit" size="lg">{t("record.review")} <ArrowRight /></Button></div>
        </form>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("record.reviewTitle")}</CardTitle><CardDescription>{t("record.reviewDescription")}</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
              <div><dt className="text-sm text-muted-foreground">{t("record.orderName")}</dt><dd className="mt-1 font-medium">{t("record.orderNameValue", { project: projectLabel, item: items.find((catalogItem) => catalogItem.id === draftItems[0]?.itemId)?.canonical_name ?? draftItems[0]?.itemName ?? "", count: orderQuantity, unit: draftItems[0]?.unit ?? "EA" })}</dd></div>
              <div><dt className="text-sm text-muted-foreground">{t("record.workDate")}</dt><dd className="mt-1 font-medium">{new Date().toLocaleDateString(i18n.resolvedLanguage === "en" ? "en-US" : "ko-KR")}</dd></div>
            </dl>
            {projectSpec && (
              <section className="space-y-3 rounded-lg border p-4">
                <div><h2 className="font-semibold">{t("record.projectSpecification")}</h2><p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{t("record.pendingSpecWarning")}</p></div>
                <p className="text-sm">{t("record.maker")}: {projectSpec.maker || t("record.makerNotListed")}</p>
                {projectSpec.coating_stages.filter((stage) => stage.stage !== "other").map((stage, index) => (
                  <div key={index} className="space-y-1">
                    <p className="text-sm">
                      {t(`record.stage.${stage.stage}`)}{stage.scope ? ` · ${stage.scope}` : ""}: {stage.specification}
                    </p>
                    <p className="text-sm">{t("record.coatMeasure")}: {stage.thickness_text || t("record.coatMeasureNotListed")}</p>
                  </div>
                ))}
                <p className="text-sm">{t("record.totalCoatMeasure")}: {projectSpec.thickness_text || t("record.coatMeasureNotListed")}</p>
              </section>
            )}
            <p className="rounded-md border p-3 text-sm">
              {items.find((catalogItem) => catalogItem.id === draftItems[0]?.itemId)?.canonical_name ?? draftItems[0]?.itemName}
              <span className="ml-2 text-muted-foreground">× {orderQuantity} {draftItems[0]?.unit ?? "EA"}</span>
            </p>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="size-5 accent-primary" />
              {t("record.confirmation")}
            </label>
            <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button variant="outline" onClick={() => { setReviewing(false); setError(null); }} disabled={saving}><ArrowLeft /> {t("record.editEntries")}</Button>
              <Button size="lg" onClick={() => void submitRecord()} disabled={saving || refreshingMaster || !confirmed} aria-busy={saving}>
                {saving ? <><LoaderCircle className="text-blue-300 motion-safe:animate-spin" aria-hidden="true" /><span aria-live="polite">{t("record.saving")}</span></> : <><Check aria-hidden="true" />{t("record.submit")}</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
