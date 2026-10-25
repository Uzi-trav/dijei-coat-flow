import {
  INITIAL_PROJECT_MASTER,
  type ProjectCoatingStage,
  type ProjectThickness,
} from "@/lib/initialProjectMaster";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

const STORAGE_KEY = "coatx-flow-local-demo-v1";

export type DemoErrorCode =
  | "CORRUPT_STORE"
  | "INVALID_STORE"
  | "STORAGE_ERROR"
  | "PROJECT_DUPLICATE"
  | "PROJECT_NOT_FOUND"
  | "ITEM_DUPLICATE"
  | "ITEM_NOT_FOUND"
  | "PROJECT_REQUIRED"
  | "LOT_REQUIRED"
  | "NO_ITEMS"
  | "INVALID_QUANTITY"
  | "UNIT_REQUIRED"
  | "ITEM_INACTIVE"
  | "ITEM_NAME_REQUIRED"
  | "RECORD_NOT_FOUND"
  | "REMOTE_NOT_READY"
  | "REMOTE_ERROR"
  | "INVALID_REMOTE_DATA";

export class DemoStoreError extends Error {
  readonly code: DemoErrorCode;

  constructor(code: DemoErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "DemoStoreError";
    this.code = code;
  }
}

export interface DemoProject {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  source_row?: number;
  aliases?: string[];
  maker?: string | null;
  maker_source?: string;
  coating_stages?: ProjectCoatingStage[];
  thickness?: ProjectThickness[];
  thickness_text?: string;
  notes?: string[];
  source_text?: string;
  verification_status?: "pending_verification" | "verified" | "approved";
}

export interface DemoItem {
  id: string;
  canonical_name: string;
  part_numbers: string[];
  project_id?: string | null;
  thumbnail_data_url?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DemoWorkItem {
  id: string;
  item_id: string | null;
  item_name_snapshot: string;
  part_number: string | null;
  quantity: number;
  unit: string;
  notes?: string | null;
  proposed_new_item: boolean;
}

export interface DemoWorkRecord {
  id: string;
  record_number: string;
  display_name: string;
  order_item_name?: string;
  total_item_count: number;
  quantities_by_unit: Array<{ unit: string; quantity: number }>;
  project_id: string;
  project_name_snapshot: string;
  lot_number: string;
  work_date?: string;
  project_spec_snapshot?: ProjectSpecSnapshot;
  completed_coating_stages?: string[];
  inspector_label: string;
  created_at: string;
  status: "submitted";
  notes: string | null;
  is_rework: false;
  items: DemoWorkItem[];
  documents?: OrderDocuments;
}

export interface OrderDocuments {
  supplierName: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierEmail: string;
  projectName: string;
  productName: string;
  partNumber: string;
  lotNumber: string;
  quantity: string;
  unit: string;
  customerName: string;
  customerAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  paymentTerms: string;
  currency: string;
  shipTo: string;
  dimensions: string;
  firstCoatName: string;
  firstCoatThickness: string;
  secondCoatName: string;
  secondCoatThickness: string;
  inspectorName: string;
  additionalDetails: string;
  invoiceLines: Array<{
    description: string;
    partNumber: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  discount: number;
  taxRate: number;
  shipping: number;
}

export interface ProjectSpecSnapshot {
  source_project_id: string;
  source_row: number | null;
  verification_status: DemoProject["verification_status"];
  maker: string;
  coating_stages: ProjectCoatingStage[];
  thickness_text: string;
  notes: string;
  source_text: string;
}

export interface DemoStore {
  projects: DemoProject[];
  items: DemoItem[];
  records: DemoWorkRecord[];
}

type SharedEntityType = "project" | "item" | "work_record";

interface SharedDataRow {
  id: string;
  entity_type: SharedEntityType;
  payload: Json;
}

export interface NewRecordInput {
  projectId: string;
  projectName?: string;
  lotNumber: string;
  projectSpecSnapshot?: ProjectSpecSnapshot;
  completedCoatingStages?: string[];
  notes: string;
  items: Array<{
    itemId: string;
    itemName: string;
    partNumber: string;
    quantity: number;
    unit: string;
    notes?: string;
  }>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDemoStore(value: unknown): value is DemoStore {
  return (
    isObject(value) &&
    Array.isArray(value.projects) &&
    Array.isArray(value.items) &&
    Array.isArray(value.records)
  );
}

let currentStore: DemoStore | null = null;
let remoteInitialized = false;
let initializationPromise: Promise<void> | null = null;

function readStore(): DemoStore {
  if (currentStore) return currentStore;
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new DemoStoreError("STORAGE_ERROR");
  }
  if (saved === null) {
    const initialStore = withInitialProjects({ projects: [], items: [], records: [] });
    writeStore(initialStore);
    return initialStore;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new DemoStoreError("CORRUPT_STORE");
  }
  if (!isDemoStore(parsed)) {
    throw new DemoStoreError("INVALID_STORE");
  }
  return withInitialProjects(parsed);
}

function withInitialProjects(store: DemoStore): DemoStore {
  let changed = false;
  const seedByRow = new Map(INITIAL_PROJECT_MASTER.map((project) => [project.source_row, project]));
  const enrichedProjects = store.projects.map((storedProject) => {
    if (typeof storedProject.source_row !== "number") return storedProject;
    const seededProject = seedByRow.get(storedProject.source_row);
    if (!seededProject || !storedProject.coating_stages) return storedProject;
    let projectChanged = false;
    const coatingStages = storedProject.coating_stages.map((stage, index) => {
      const seededThickness = seededProject.coating_stages[index]?.thickness_text;
      if (stage.thickness_text || !seededThickness) return stage;
      changed = true;
      projectChanged = true;
      return { ...stage, thickness_text: seededThickness };
    });
    return projectChanged ? { ...storedProject, coating_stages: coatingStages } : storedProject;
  });
  const existingRows = new Set(
    enrichedProjects
      .map((project) => project.source_row)
      .filter((sourceRow): sourceRow is number => typeof sourceRow === "number"),
  );
  const missingProjects = INITIAL_PROJECT_MASTER.filter(
    (project) => !existingRows.has(project.source_row),
  ).map((project) => structuredClone(project));
  if (missingProjects.length === 0 && !changed) return store;

  const merged = { ...store, projects: [...enrichedProjects, ...missingProjects] };
  writeStore(merged);
  return merged;
}

function writeStore(store: DemoStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    currentStore = store;
  } catch {
    throw new DemoStoreError("STORAGE_ERROR");
  }
}

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJson);
  return isObject(value) && Object.values(value).every((entry) => entry === undefined || isJson(entry));
}

function toJson(value: unknown): Json {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  if (!isJson(parsed)) throw new DemoStoreError("INVALID_REMOTE_DATA");
  return parsed;
}

function isDemoProject(value: unknown): value is DemoProject {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.is_active === "boolean"
    && typeof value.created_at === "string";
}

function isDemoItem(value: unknown): value is DemoItem {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.canonical_name === "string"
    && Array.isArray(value.part_numbers)
    && value.part_numbers.every((partNumber) => typeof partNumber === "string")
    && typeof value.is_active === "boolean"
    && typeof value.created_at === "string";
}

function isDemoWorkItem(value: unknown): value is DemoWorkItem {
  return isObject(value)
    && typeof value.id === "string"
    && (typeof value.item_id === "string" || value.item_id === null)
    && typeof value.item_name_snapshot === "string"
    && (typeof value.part_number === "string" || value.part_number === null)
    && typeof value.quantity === "number"
    && typeof value.unit === "string"
    && typeof value.proposed_new_item === "boolean";
}

function isDemoWorkRecord(value: unknown): value is DemoWorkRecord {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.record_number === "string"
    && typeof value.display_name === "string"
    && typeof value.project_id === "string"
    && typeof value.project_name_snapshot === "string"
    && typeof value.lot_number === "string"
    && typeof value.created_at === "string"
    && Array.isArray(value.items)
    && value.items.every(isDemoWorkItem);
}

function rowsFromStore(store: DemoStore): SharedDataRow[] {
  return [
    ...store.projects.map((project) => ({
      id: project.id,
      entity_type: "project" as const,
      payload: toJson(project),
    })),
    ...store.items.map((item) => ({
      id: item.id,
      entity_type: "item" as const,
      payload: toJson(item),
    })),
    ...store.records.map((record) => ({
      id: record.id,
      entity_type: "work_record" as const,
      payload: toJson(record),
    })),
  ];
}

function storeFromRows(rows: SharedDataRow[]): DemoStore {
  const store: DemoStore = { projects: [], items: [], records: [] };
  for (const row of rows) {
    if (!isObject(row.payload) || row.payload.id !== row.id) {
      throw new DemoStoreError("INVALID_REMOTE_DATA");
    }
    if (row.entity_type === "project" && isDemoProject(row.payload)) {
      store.projects.push(row.payload);
    } else if (row.entity_type === "item" && isDemoItem(row.payload)) {
      store.items.push(row.payload);
    } else if (row.entity_type === "work_record" && isDemoWorkRecord(row.payload)) {
      store.records.push(row.payload);
    } else {
      throw new DemoStoreError("INVALID_REMOTE_DATA");
    }
  }
  return store;
}

async function persistSharedRow(
  entityType: SharedEntityType,
  id: string,
  payload: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("coatx_shared_data")
    .upsert(
      { entity_type: entityType, id, payload: toJson(payload) },
      { onConflict: "entity_type,id" },
    );
  if (error) {
    console.error("Supabase shared-data write failed:", error);
    throw new DemoStoreError("REMOTE_ERROR", error.message);
  }
}

function ensureRemoteInitialized(): void {
  if (!remoteInitialized || !currentStore) throw new DemoStoreError("REMOTE_NOT_READY");
}

async function loadSharedStore(): Promise<void> {
  const localStore = readStore();
  const { error: migrationError } = await supabase
    .from("coatx_shared_data")
    .upsert(rowsFromStore(localStore), {
      onConflict: "entity_type,id",
      ignoreDuplicates: true,
    });
  if (migrationError) {
    console.error("Supabase local-data migration failed:", migrationError);
    throw new DemoStoreError("REMOTE_ERROR", migrationError.message);
  }

  currentStore = await fetchSharedStore();
  remoteInitialized = true;
}

async function fetchSharedStore(): Promise<DemoStore> {
  const rows: SharedDataRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("coatx_shared_data")
      .select("entity_type,id,payload")
      .range(offset, offset + 999);
    if (error) {
      console.error("Supabase shared-data read failed:", error);
      throw new DemoStoreError("REMOTE_ERROR", error.message);
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return storeFromRows(rows);
}

export function initializeDemoData(): Promise<void> {
  if (remoteInitialized) return Promise.resolve();
  if (!initializationPromise) {
    initializationPromise = loadSharedStore().finally(() => {
      initializationPromise = null;
    });
  }
  return initializationPromise;
}

export async function refreshDemoData(): Promise<DemoStore> {
  ensureRemoteInitialized();
  currentStore = await fetchSharedStore();
  return currentStore;
}

function createId(): string {
  return crypto.randomUUID();
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function getDemoData(): DemoStore {
  ensureRemoteInitialized();
  return readStore();
}

export async function addDemoProject(name: string): Promise<DemoProject> {
  ensureRemoteInitialized();
  const store = readStore();
  const cleanName = name.trim();
  if (store.projects.some((project) => normalized(project.name) === normalized(cleanName))) {
    throw new DemoStoreError("PROJECT_DUPLICATE");
  }
  const project: DemoProject = {
    id: createId(),
    name: cleanName,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  await persistSharedRow("project", project.id, project);
  const latestStore = currentStore ?? store;
  currentStore = { ...latestStore, projects: [...latestStore.projects, project] };
  return project;
}

export async function updateDemoProject(
  id: string,
  changes: Partial<Omit<DemoProject, "id" | "created_at" | "source_row" | "verification_status">>,
): Promise<void> {
  ensureRemoteInitialized();
  const store = readStore();
  const current = store.projects.find((project) => project.id === id);
  if (!current) throw new DemoStoreError("PROJECT_NOT_FOUND");
  const name = changes.name?.trim() ?? current.name;
  if (store.projects.some((project) => project.id !== id && normalized(project.name) === normalized(name))) {
    throw new DemoStoreError("PROJECT_DUPLICATE");
  }
  const updatedProject = { ...current, ...changes, name };
  await persistSharedRow("project", id, updatedProject);
  const latestStore = currentStore ?? store;
  currentStore = {
    ...latestStore,
    projects: latestStore.projects.map((project) =>
      project.id === id ? updatedProject : project,
    ),
  };
}

export async function addDemoItem(
  name: string,
  partNumbers: string[],
  options: { projectId?: string; thumbnailDataUrl?: string } = {},
): Promise<DemoItem> {
  ensureRemoteInitialized();
  const store = readStore();
  const cleanName = name.trim();
  if (store.items.some((item) => normalized(item.canonical_name) === normalized(cleanName))) {
    throw new DemoStoreError("ITEM_DUPLICATE");
  }
  const item: DemoItem = {
    id: createId(),
    canonical_name: cleanName,
    part_numbers: [...new Set(partNumbers.map((part) => part.trim()).filter(Boolean))],
    project_id: options.projectId || null,
    thumbnail_data_url: options.thumbnailDataUrl || null,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  await persistSharedRow("item", item.id, item);
  const latestStore = currentStore ?? store;
  currentStore = { ...latestStore, items: [...latestStore.items, item] };
  return item;
}

export async function updateDemoItem(
  id: string,
  changes: Partial<Pick<DemoItem, "canonical_name" | "part_numbers" | "is_active">>,
): Promise<void> {
  ensureRemoteInitialized();
  const store = readStore();
  const current = store.items.find((item) => item.id === id);
  if (!current) throw new DemoStoreError("ITEM_NOT_FOUND");
  const name = changes.canonical_name?.trim() ?? current.canonical_name;
  if (store.items.some((item) => item.id !== id && normalized(item.canonical_name) === normalized(name))) {
    throw new DemoStoreError("ITEM_DUPLICATE");
  }
  const updatedItem = {
    ...current,
    ...changes,
    canonical_name: name,
    part_numbers: changes.part_numbers ?? current.part_numbers,
  };
  await persistSharedRow("item", id, updatedItem);
  const latestStore = currentStore ?? store;
  currentStore = {
    ...latestStore,
    items: latestStore.items.map((item) =>
      item.id === id ? updatedItem : item,
    ),
  };
}

export async function saveDemoWorkRecord(input: NewRecordInput): Promise<DemoWorkRecord> {
  ensureRemoteInitialized();
  const store = readStore();
  const project = store.projects.find((entry) => entry.id === input.projectId && entry.is_active);
  const unlistedProjectName = input.projectId === "__new__" ? input.projectName?.trim() : "";
  const cleanUnlistedProjectName = unlistedProjectName ?? "";
  if (!project && !cleanUnlistedProjectName) throw new DemoStoreError("PROJECT_REQUIRED");
  if (input.items.length === 0) throw new DemoStoreError("NO_ITEMS");

  const items = input.items.map((draft) => {
    if (!Number.isFinite(draft.quantity) || draft.quantity <= 0) {
      throw new DemoStoreError("INVALID_QUANTITY");
    }
    if (!draft.unit.trim()) throw new DemoStoreError("UNIT_REQUIRED");
    if (draft.itemId) {
      const masterItem = store.items.find((entry) => entry.id === draft.itemId && entry.is_active);
      if (!masterItem) throw new DemoStoreError("ITEM_INACTIVE");
      return {
        id: createId(),
        item_id: masterItem.id,
        item_name_snapshot: masterItem.canonical_name,
        part_number: draft.partNumber.trim() || null,
        quantity: draft.quantity,
        unit: draft.unit.trim(),
        notes: draft.notes?.trim() || null,
        proposed_new_item: false,
      };
    }
    const itemName = draft.itemName.trim();
    if (!itemName) throw new DemoStoreError("ITEM_NAME_REQUIRED");
    return {
      id: createId(),
      item_id: null,
      item_name_snapshot: itemName,
      part_number: draft.partNumber.trim() || null,
      quantity: draft.quantity,
      unit: draft.unit.trim(),
      notes: draft.notes?.trim() || null,
      proposed_new_item: true,
    };
  });

  const createdAt = new Date();
  const datePart = [
    createdAt.getFullYear(),
    String(createdAt.getMonth() + 1).padStart(2, "0"),
    String(createdAt.getDate()).padStart(2, "0"),
  ].join("");
  const quantitiesByUnit = new Map<string, number>();
  for (const item of items) {
    quantitiesByUnit.set(item.unit, (quantitiesByUnit.get(item.unit) ?? 0) + item.quantity);
  }
  const projectName = project?.name ?? cleanUnlistedProjectName;
  const orderItemName = items[0]?.item_name_snapshot ?? "";
  const recordId = createId();
  const record: DemoWorkRecord = {
    id: recordId,
    record_number: `DC-${datePart}-${recordId.slice(0, 8).toUpperCase()}`,
    display_name: projectName,
    order_item_name: orderItemName,
    total_item_count: items.reduce((total, item) => total + item.quantity, 0),
    quantities_by_unit: [...quantitiesByUnit.entries()].map(([unit, quantity]) => ({ unit, quantity })),
    project_id: project?.id ?? `unlisted:${cleanUnlistedProjectName}`,
    project_name_snapshot: projectName,
    lot_number: input.lotNumber.trim(),
    work_date: [
      createdAt.getFullYear(),
      String(createdAt.getMonth() + 1).padStart(2, "0"),
      String(createdAt.getDate()).padStart(2, "0"),
    ].join("-"),
    ...(input.projectSpecSnapshot ? { project_spec_snapshot: input.projectSpecSnapshot } : {}),
    ...(input.completedCoatingStages ? { completed_coating_stages: input.completedCoatingStages } : {}),
    inspector_label: "",
    created_at: createdAt.toISOString(),
    status: "submitted",
    notes: input.notes.trim() || null,
    is_rework: false,
    items,
  };
  await persistSharedRow("work_record", record.id, record);
  const latestStore = currentStore ?? store;
  currentStore = { ...latestStore, records: [record, ...latestStore.records] };
  return record;
}

export async function updateDemoRecordDocuments(recordId: string, documents: OrderDocuments): Promise<DemoWorkRecord> {
  ensureRemoteInitialized();
  const store = readStore();
  const record = store.records.find((entry) => entry.id === recordId);
  if (!record) throw new DemoStoreError("RECORD_NOT_FOUND");
  const updatedRecord = { ...record, documents: structuredClone(documents) };
  await persistSharedRow("work_record", recordId, updatedRecord);
  const latestStore = currentStore ?? store;
  currentStore = {
    ...latestStore,
    records: latestStore.records.map((entry) => entry.id === recordId ? updatedRecord : entry),
  };
  return updatedRecord;
}
