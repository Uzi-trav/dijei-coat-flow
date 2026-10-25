import { useState } from "react";
import { Check, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import type { ProjectCoatingStage } from "@/lib/initialProjectMaster";
import { normalizeProjectName } from "@/lib/projectSearch";
import {
  addDemoItem,
  addDemoProject,
  DemoStoreError,
  getDemoData,
  refreshDemoData,
  updateDemoItem,
  updateDemoProject,
  type DemoItem,
  type DemoProject,
} from "@/lib/demoStore";

interface MasterState {
  projects: DemoProject[];
  items: DemoItem[];
  error: string | null;
}

interface ProjectDetailsDraft {
  maker: string;
  aliases: string;
  thicknessText: string;
  notes: string;
  coatingStages: ProjectCoatingStage[];
}

function readMasterData(): MasterState {
  try {
    const data = getDemoData();
    return { projects: data.projects, items: data.items, error: null };
  } catch (error) {
    return {
      projects: [],
      items: [],
      error: error instanceof DemoStoreError ? error.code : "STORAGE_ERROR",
    };
  }
}

export default function ProjectsItemsPage() {
  const { t } = useTranslation();
  const [master, setMaster] = useState(readMasterData);
  const [projectName, setProjectName] = useState("");
  const [itemName, setItemName] = useState("");
  const [partNumbers, setPartNumbers] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingParts, setEditingParts] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [detailsDraft, setDetailsDraft] = useState<ProjectDetailsDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function refresh() {
    setMaster(readMasterData());
  }

  async function refreshFromServer() {
    try {
      await refreshDemoData();
      refresh();
    } catch (error) {
      setMaster({
        projects: [],
        items: [],
        error: error instanceof DemoStoreError ? error.code : "REMOTE_ERROR",
      });
    }
  }

  async function addProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await addDemoProject(projectName);
      setProjectName("");
      setSuccess("master.projectSaved");
      refresh();
    } catch (error) {
      setError(error instanceof DemoStoreError ? `demoErrors.${error.code}` : "master.saveProjectError");
    }
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await addDemoItem(itemName, partNumbers.split(","));
      setItemName("");
      setPartNumbers("");
      setSuccess("master.itemSaved");
      refresh();
    } catch (error) {
      setError(error instanceof DemoStoreError ? `demoErrors.${error.code}` : "master.saveItemError");
    }
  }

  async function saveProject(event: React.FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    setError(null);
    try {
      await updateDemoProject(projectId, { name: editingName });
      setEditingProjectId(null);
      setSuccess("master.projectUpdated");
      refresh();
    } catch (error) {
      setError(error instanceof DemoStoreError ? `demoErrors.${error.code}` : "master.updateProjectError");
    }
  }

  function editProjectDetails(project: DemoProject) {
    setEditingDetailsId(project.id);
    setDetailsDraft({
      maker: project.maker ?? "",
      aliases: (project.aliases ?? []).join(", "),
      thicknessText: project.thickness_text ?? "",
      notes: (project.notes ?? []).join("\n"),
      coatingStages: structuredClone(project.coating_stages ?? []),
    });
  }

  async function saveProjectDetails(event: React.FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    if (!detailsDraft) return;
    setError(null);
    try {
      await updateDemoProject(projectId, {
        maker: detailsDraft.maker.trim() || null,
        aliases: [...new Set(detailsDraft.aliases.split(",").map((alias) => alias.trim()).filter(Boolean))],
        thickness_text: detailsDraft.thicknessText.trim(),
        notes: detailsDraft.notes.split("\n").map((note) => note.trim()).filter(Boolean),
        coating_stages: detailsDraft.coatingStages,
      });
      setEditingDetailsId(null);
      setDetailsDraft(null);
      setSuccess("master.projectUpdated");
      refresh();
    } catch (saveError) {
      setError(saveError instanceof DemoStoreError ? `demoErrors.${saveError.code}` : "master.updateProjectError");
    }
  }

  function updateStage(index: number, field: keyof ProjectCoatingStage, value: string) {
    setDetailsDraft((current) => current ? {
      ...current,
      coatingStages: current.coatingStages.map((stage, stageIndex) =>
        stageIndex === index
          ? { ...stage, [field]: field === "stage" ? value : value || null }
          : stage,
      ),
    } : current);
  }

  const filteredProjects = master.projects.filter((project) => {
    const needle = normalizeProjectName(projectSearch);
    return !needle || normalizeProjectName([
      project.name,
      project.maker ?? "",
      ...(project.aliases ?? []),
    ].join(" ")).includes(needle);
  });

  async function saveItem(event: React.FormEvent<HTMLFormElement>, itemId: string) {
    event.preventDefault();
    setError(null);
    try {
      await updateDemoItem(itemId, {
        canonical_name: editingName,
        part_numbers: editingParts.split(","),
      });
      setEditingItemId(null);
      setSuccess("master.itemUpdated");
      refresh();
    } catch (error) {
      setError(error instanceof DemoStoreError ? `demoErrors.${error.code}` : "master.updateItemError");
    }
  }

  async function toggleProject(project: DemoProject) {
    setError(null);
    try {
      await updateDemoProject(project.id, { is_active: !project.is_active });
      setSuccess(project.is_active ? "master.projectDeactivated" : "master.projectActivated");
      refresh();
    } catch (error) {
      setError(error instanceof DemoStoreError ? `demoErrors.${error.code}` : "master.toggleProjectError");
    }
  }

  async function toggleItem(item: DemoItem) {
    setError(null);
    try {
      await updateDemoItem(item.id, { is_active: !item.is_active });
      setSuccess(item.is_active ? "master.itemDeactivated" : "master.itemActivated");
      refresh();
    } catch (error) {
      setError(error instanceof DemoStoreError ? `demoErrors.${error.code}` : "master.toggleItemError");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{t("master.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("master.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("master.description")}</p>
        </div>
        <Button variant="outline" onClick={() => void refreshFromServer()}><RefreshCw /> {t("common.refresh")}</Button>
      </div>

      {master.error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{t("master.readError", { error: t(`demoErrors.${master.error}`) })}</div>}
      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error.includes(".") ? t(error) : error}</div>}
      {success && <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4 text-sm" role="status">{t(success)}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("master.projectAddTitle")}</CardTitle><CardDescription>{t("master.projectAddDescription")}</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={addProject} className="space-y-3">
              <div className="space-y-2"><Label htmlFor="project-name">{t("master.projectName")}</Label><Input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} required maxLength={200} placeholder={t("master.projectPlaceholder")} /></div>
              <Button type="submit" disabled={!projectName.trim()}><Plus /> {t("master.addProject")}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("master.itemAddTitle")}</CardTitle><CardDescription>{t("master.itemAddDescription")}</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={addItem} className="space-y-3">
              <div className="space-y-2"><Label htmlFor="item-name">{t("master.itemName")}</Label><Input id="item-name" value={itemName} onChange={(event) => setItemName(event.target.value)} required maxLength={200} placeholder={t("master.itemPlaceholder")} /></div>
              <div className="space-y-2"><Label htmlFor="part-numbers">{t("master.partNumbers")}</Label><Input id="part-numbers" value={partNumbers} onChange={(event) => setPartNumbers(event.target.value)} placeholder={t("master.partNumbersPlaceholder")} /></div>
              <Button type="submit" disabled={!itemName.trim()}><Plus /> {t("master.addItem")}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("master.projectList")}</CardTitle>
            <CardDescription>{t("master.importedProjectCount", { count: master.projects.filter((project) => typeof project.source_row === "number").length })} · {t("common.active", { count: master.projects.filter((project) => project.is_active).length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 space-y-2">
              <Label htmlFor="project-master-search">{t("master.searchProjects")}</Label>
              <Input id="project-master-search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder={t("record.projectSearchPlaceholder")} />
            </div>
            {filteredProjects.length ? (
              <ul className="divide-y">{filteredProjects.map((project) => (
                <li key={project.id} className="py-3 text-sm">
                  {editingProjectId === project.id ? (
                    <form onSubmit={(event) => saveProject(event, project.id)} className="flex flex-wrap gap-2">
                      <Input aria-label={t("master.editProjectLabel")} value={editingName} onChange={(event) => setEditingName(event.target.value)} required maxLength={200} className="min-w-40 flex-1" />
                      <Button type="submit" size="sm"><Check /> {t("common.save")}</Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={t("common.cancel")} onClick={() => setEditingProjectId(null)}><X /></Button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {project.source_row ? <span className="mr-2 text-muted-foreground">#{project.source_row}</span> : null}
                        {project.name}{!project.is_active && <span className="ml-2 text-muted-foreground">{t("common.inactive")}</span>}
                        {project.verification_status && <span className="ml-2 text-amber-700 dark:text-amber-300">{t("record.pendingVerification")}</span>}
                      </span>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingName(project.name); setEditingProjectId(project.id); }}><Pencil /> {t("common.edit")}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => editProjectDetails(project)}><Pencil /> {t("master.editSpecification")}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => toggleProject(project)}>{project.is_active ? t("common.deactivate") : t("common.activate")}</Button>
                      </div>
                    </div>
                  )}
                  {editingDetailsId === project.id && detailsDraft ? (
                    <form className="mt-3 space-y-3 rounded-md border p-3" onSubmit={(event) => saveProjectDetails(event, project.id)}>
                      <div className="space-y-2"><Label htmlFor={`maker-${project.id}`}>{t("record.maker")}</Label><Input id={`maker-${project.id}`} value={detailsDraft.maker} onChange={(event) => setDetailsDraft({ ...detailsDraft, maker: event.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor={`aliases-${project.id}`}>{t("master.aliases")}</Label><Input id={`aliases-${project.id}`} value={detailsDraft.aliases} onChange={(event) => setDetailsDraft({ ...detailsDraft, aliases: event.target.value })} placeholder={t("master.aliasesPlaceholder")} /></div>
                      <div className="space-y-2"><Label htmlFor={`thickness-${project.id}`}>{t("record.thickness")}</Label><textarea id={`thickness-${project.id}`} value={detailsDraft.thicknessText} onChange={(event) => setDetailsDraft({ ...detailsDraft, thicknessText: event.target.value })} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" /></div>
                      {detailsDraft.coatingStages.map((stage, index) => (
                        <fieldset key={`${stage.stage}-${index}`} className="grid gap-2 rounded border p-2 sm:grid-cols-2">
                          <legend className="px-1 text-xs">{t(`record.stage.${stage.stage}`)}</legend>
                          <Input aria-label={t("record.specificationText")} value={stage.specification} onChange={(event) => updateStage(index, "specification", event.target.value)} />
                          <Input aria-label={t("record.scope")} value={stage.scope ?? ""} onChange={(event) => updateStage(index, "scope", event.target.value)} placeholder={t("record.scope")} />
                          <Input aria-label={t("record.paintCode")} value={stage.paint_code ?? ""} onChange={(event) => updateStage(index, "paint_code", event.target.value)} placeholder={t("record.paintCode")} />
                          <Input aria-label={t("record.color")} value={stage.color ?? ""} onChange={(event) => updateStage(index, "color", event.target.value)} placeholder={t("record.color")} />
                          <Input aria-label={t("record.finish")} value={stage.finish ?? ""} onChange={(event) => updateStage(index, "finish", event.target.value)} placeholder={t("record.finish")} />
                          <Input aria-label={t("record.coatMeasure")} value={stage.thickness_text ?? ""} onChange={(event) => updateStage(index, "thickness_text", event.target.value)} placeholder={t("record.coatMeasure")} />
                        </fieldset>
                      ))}
                      <div className="space-y-2"><Label htmlFor={`master-notes-${project.id}`}>{t("record.specificationNotes")}</Label><textarea id={`master-notes-${project.id}`} value={detailsDraft.notes} onChange={(event) => setDetailsDraft({ ...detailsDraft, notes: event.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" /></div>
                      <p className="text-xs text-amber-700 dark:text-amber-300">{t("master.verificationCannotApprove")}</p>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm"><Check /> {t("common.save")}</Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={t("common.cancel")} onClick={() => { setEditingDetailsId(null); setDetailsDraft(null); }}><X /></Button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {project.maker && <p>{t("record.maker")}: {project.maker}</p>}
                      {project.aliases?.length ? <p>{t("master.aliases")}: {project.aliases.join(", ")}</p> : null}
                      {project.thickness_text && <p>{t("record.thickness")}: {project.thickness_text}</p>}
                      {project.coating_stages?.map((stage, index) => <p key={index}>{t(`record.stage.${stage.stage}`)}{stage.scope ? ` · ${stage.scope}` : ""}: {stage.specification}{stage.thickness_text ? ` · ${t("record.coatMeasure")}: ${stage.thickness_text}` : ""}</p>)}
                      {project.notes?.length ? <p className="whitespace-pre-wrap">{project.notes.join("\n")}</p> : null}
                      <details className="pt-1"><summary className="cursor-pointer">{t("master.originalSource")}</summary><pre className="mt-2 whitespace-pre-wrap font-sans">{project.source_text}</pre></details>
                    </div>
                  )}
                </li>
              ))}</ul>
            ) : <p className="text-sm text-muted-foreground">{t("master.noProjects")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("master.itemList")}</CardTitle><CardDescription>{t("common.active", { count: master.items.filter((item) => item.is_active).length })}</CardDescription></CardHeader>
          <CardContent>
            {master.items.length ? (
              <ul className="divide-y">{master.items.map((item) => (
                <li key={item.id} className="py-3 text-sm">
                  {editingItemId === item.id ? (
                    <form onSubmit={(event) => saveItem(event, item.id)} className="space-y-2">
                      <Input aria-label={t("master.editItemLabel")} value={editingName} onChange={(event) => setEditingName(event.target.value)} required maxLength={200} />
                      <Input aria-label={t("master.editPartNumbersLabel")} value={editingParts} onChange={(event) => setEditingParts(event.target.value)} placeholder={t("master.editPartNumbersPlaceholder")} />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm"><Check /> {t("common.save")}</Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={t("common.cancel")} onClick={() => setEditingItemId(null)}><X /></Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>{item.canonical_name}{!item.is_active && <span className="ml-2 text-muted-foreground">{t("common.inactive")}</span>}</span>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingName(item.canonical_name); setEditingParts(item.part_numbers.join(", ")); setEditingItemId(item.id); }}><Pencil /> {t("common.edit")}</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => toggleItem(item)}>{item.is_active ? t("common.deactivate") : t("common.activate")}</Button>
                        </div>
                      </div>
                      {item.part_numbers.length > 0 && <p className="mt-1 text-muted-foreground">{item.part_numbers.join(", ")}</p>}
                    </>
                  )}
                </li>
              ))}</ul>
            ) : <p className="text-sm text-muted-foreground">{t("master.noItems")}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
