import type { ProjectSpecSnapshot } from "@/lib/demoStore";

export interface DraftItem {
  key: number;
  itemId: string;
  itemName: string;
  partNumber: string;
  quantity: string;
  unit: string;
  notes: string;
}

export interface WorkRecordDraft {
  projectId: string;
  projectSearch: string;
  projectName: string;
  projectSpec: ProjectSpecSnapshot | null;
  lotNumber: string;
  notes: string;
  draftItems: DraftItem[];
}

export interface WorkerFlowState {
  draft?: WorkRecordDraft;
  imageDataUrl?: string;
}
