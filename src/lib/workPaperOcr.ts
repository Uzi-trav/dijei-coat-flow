import type { DemoItem, DemoProject } from "@/lib/demoStore";
import { normalizeProjectName } from "@/lib/projectSearch";
import type { DraftItem, WorkRecordDraft } from "@/lib/workerFlow";

export interface WorkPaperOcrResult {
  text: string;
  confidence: null;
  rotation: null;
}

const MAX_OCR_IMAGE_BYTES = 950 * 1024;

function fileReaderDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("Could not prepare this photo for OCR."));
    reader.onerror = () => reject(new Error("Could not prepare this photo for OCR."));
    reader.readAsDataURL(blob);
  });
}

async function compressImageForOcr(dataUrl: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const loadedImage = new Image();
    loadedImage.onload = () => resolve(loadedImage);
    loadedImage.onerror = () => reject(new Error("Could not read this image. Choose another photo."));
    loadedImage.src = dataUrl;
  });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight)) * (0.9 ** attempt);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this photo for OCR.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_OCR_IMAGE_BYTES) {
        return fileReaderDataUrl(blob);
      }
    }
  }

  throw new Error("This photo is too detailed to send to the free OCR service. Choose a smaller image.");
}

export async function recognizeWorkPaper(
  dataUrl: string,
  onProgress: (progress: number) => void,
): Promise<WorkPaperOcrResult> {
  const ocrImage = await compressImageForOcr(dataUrl);
  onProgress(10);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 11000);
  try {
    const response = await fetch("/api/work-paper/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: ocrImage }),
      signal: controller.signal,
    });
    const result = await response.json() as { text?: unknown; error?: unknown };
    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "OCR could not read this photo.");
    }
    if (typeof result.text !== "string" || !result.text.trim()) {
      throw new Error("OCR returned no readable text. Try another photo.");
    }
    onProgress(100);
    return { text: result.text, confidence: null, rotation: null };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("OCR timed out. Try again or continue manually.", { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

interface DetectedQuantity {
  count: number;
  unit: string;
}

function makeDraftItem(
  item?: DemoItem,
  quantity?: DetectedQuantity,
  previous?: DraftItem,
  recognizedName?: string,
  recognizedPartNumber?: string,
): DraftItem {
  return {
    key: 0,
    itemId: item?.id ?? "",
    itemName: item?.canonical_name ?? recognizedName ?? previous?.itemName ?? "",
    partNumber: item?.part_numbers[0] ?? recognizedPartNumber ?? previous?.partNumber ?? "",
    quantity: quantity ? String(quantity.count) : previous?.quantity ?? "",
    unit: quantity?.unit ?? previous?.unit ?? "EA",
    notes: "",
  };
}

const WORK_PAPER_FIELD_LABELS = [
  "프로젝트",
  "제품명",
  "품목명",
  "품명",
  "부품명",
  "수량",
  "LOT NO",
  "LOT NUMBER",
  "특이사항",
  "비고",
];

function fieldValueAfterLabel(text: string, labels: string[]): string | undefined {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const label = labels.find((candidate) =>
      normalizeProjectName(line).startsWith(normalizeProjectName(candidate)),
    );
    if (!label) continue;

    const labelIndex = line.toLocaleLowerCase().indexOf(label.toLocaleLowerCase());
    const inlineValue = labelIndex >= 0 ? line.slice(labelIndex + label.length).trim() : "";
    const clean = (value: string) => value.replace(/^[\s:：#-]+/u, "").trim();
    if (clean(inlineValue)) return clean(inlineValue);

    for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 4); nextIndex += 1) {
      const candidate = lines[nextIndex];
      const normalizedCandidate = normalizeProjectName(candidate);
      if (WORK_PAPER_FIELD_LABELS.some((fieldLabel) =>
        normalizedCandidate.startsWith(normalizeProjectName(fieldLabel)),
      )) break;
      if (/^\([^)]*\)$/u.test(candidate)) continue;
      if (clean(candidate)) return clean(candidate);
    }
  }
  return undefined;
}

function projectNames(project: DemoProject[]): Array<{ project: DemoProject; name: string }> {
  return project.flatMap((entry) => [entry.name, ...(entry.aliases ?? [])]
    .map(normalizeProjectName)
    .filter((name) => name.length >= 2)
    .map((name) => ({ project: entry, name })));
}

function findProjectMatch(text: string, projects: DemoProject[]): DemoProject | undefined {
  const normalizedText = normalizeProjectName(text);
  const names = projectNames(projects);
  const exactMatches = names.filter(({ name }) => normalizedText.includes(name));
  if (exactMatches.length) {
    const longestLength = Math.max(...exactMatches.map(({ name }) => name.length));
    const bestProjects = new Map(
      exactMatches
        .filter(({ name }) => name.length === longestLength)
        .map(({ project }) => [project.id, project]),
    );
    return bestProjects.size === 1 ? [...bestProjects.values()][0] : undefined;
  }

  const sourceLines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^(?:프로젝트|project|현장명|공사명)\s*/i, "").trim())
    .filter(Boolean);
  const lines = [
    ...sourceLines,
    ...sourceLines.slice(0, -1).map((line, index) => `${line} ${sourceLines[index + 1]}`),
  ]
    .map(normalizeProjectName)
    .filter((line) => line.length >= 4 && line.length <= 120);
  const distance = (left: string, right: string): number => {
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      let diagonal = row[0];
      row[0] = leftIndex;
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        const previous = row[rightIndex];
        row[rightIndex] = Math.min(
          row[rightIndex] + 1,
          row[rightIndex - 1] + 1,
          diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
        );
        diagonal = previous;
      }
    }
    return row[right.length];
  };
  const projectScores = new Map<string, { project: DemoProject; score: number }>();
  for (const { project, name } of names) {
    if (name.length < 4) continue;
    const variants = lines.flatMap((line) => {
      const minLength = Math.max(1, name.length - 1);
      const maxLength = Math.min(line.length, name.length + 1);
      return Array.from({ length: Math.max(0, maxLength - minLength + 1) }, (_, lengthIndex) => {
        const length = minLength + lengthIndex;
        return Array.from({ length: Math.max(0, line.length - length + 1) }, (_, start) => line.slice(start, start + length));
      }).flat();
    });
    const errors = variants.map((variant) => distance(name, variant));
    const bestErrorCount = errors.length ? Math.min(...errors) : Number.POSITIVE_INFINITY;
    const score = Number.isFinite(bestErrorCount)
      ? 1 - bestErrorCount / Math.max(name.length, name.length + 1)
      : 0;
    const singleCharacterErrorInShortName = name.length <= 5 && bestErrorCount === 1;
    const koreanPrefix = name.match(/^\p{Script=Hangul}{2}/u)?.[0];
    const koreanPrefixEvidence = name.length <= 5
      && koreanPrefix !== undefined
      && variants.some((variant) => variant.startsWith(koreanPrefix) && distance(name, variant) <= 2);
    const current = projectScores.get(project.id);
    if ((score >= 0.8 || singleCharacterErrorInShortName || koreanPrefixEvidence) && (!current || score > current.score)) {
      projectScores.set(project.id, { project, score });
    }
  }
  const ranked = [...projectScores.values()].sort((left, right) => right.score - left.score);
  if (!ranked.length) return undefined;
  const bestProjects = new Map(
    ranked
      .filter(({ score }) => Math.abs(score - ranked[0].score) < 0.001)
      .map(({ project }) => [project.id, project]),
  );
  if (bestProjects.size !== 1 || (ranked[1] && ranked[0].score - ranked[1].score < 0.08)) return undefined;
  return [...bestProjects.values()][0];
}

function findItemMatch(text: string, items: DemoItem[], projectId?: string): DemoItem | undefined {
  const normalizedText = normalizeProjectName(text);
  const candidates = projectId
    ? items.filter((item) => item.project_id === projectId)
    : [];
  const source = candidates.length ? candidates : items;
  const matches = source.flatMap((item) => {
    const searchableValues = [item.canonical_name, ...item.part_numbers]
      .map(normalizeProjectName)
      .filter((value) => value.length >= 3 && normalizedText.includes(value));
    const longestMatch = searchableValues.sort((left, right) => right.length - left.length)[0];
    return longestMatch ? [{ item, length: longestMatch.length }] : [];
  }).sort((left, right) => right.length - left.length);
  if (!matches.length) return undefined;
  const bestItems = new Map(
    matches
      .filter(({ length }) => length === matches[0].length)
      .map(({ item }) => [item.id, item]),
  );
  return bestItems.size === 1 ? [...bestItems.values()][0] : undefined;
}

function findObjectCount(text: string): DetectedQuantity | undefined {
  const countPattern = /(\d[\d,]*)\s*(set|ea|pcs?|개|대|량|장)(?![a-z])/i;
  const labeledPattern = /(?:수량|개수|객체\s*수|quantity)[^\d]{0,16}(\d[\d,]*)/i;
  const labeledValue = fieldValueAfterLabel(text, ["수량"]);
  const labeledValueMatch = labeledValue?.match(/(\d[\d,]*)\s*([a-z]+)?/i);
  const labeledValueNumber = labeledValueMatch?.[1];
  if (labeledValueNumber) {
    const count = Number(labeledValueNumber.replaceAll(",", ""));
    if (!Number.isSafeInteger(count) || count <= 0) return undefined;
    const unitText = labeledValueMatch?.[2]?.toUpperCase();
    const unit = unitText && /^(SET|EA|PCS?)$/.test(unitText) ? unitText : "EA";
    return { count, unit };
  }
  const matchWithUnit = text.match(countPattern);
  const labeledCount = text.match(labeledPattern);
  const rawValue = labeledCount?.[1] ?? matchWithUnit?.[1];
  if (!rawValue) return undefined;
  const count = Number(rawValue.replaceAll(",", ""));
  if (!Number.isSafeInteger(count) || count <= 0) return undefined;
  const unitText = matchWithUnit?.[1] === rawValue ? matchWithUnit[2] : undefined;
  const unit = unitText
    ? (/^(개|대|량|장)$/i.test(unitText) ? "EA" : unitText.toUpperCase())
    : "EA";
  return { count, unit };
}

function findLotNumber(text: string): string | undefined {
  const labeledValue = fieldValueAfterLabel(text, ["LOT NO", "LOT NUMBER"]);
  const labeledMatch = labeledValue?.match(/[A-Z0-9][A-Z0-9._/-]{1,30}/i);
  if (labeledMatch) return labeledMatch[0];
  const match = text.match(/(?:\bLOT(?:\s*(?:NO\.?|NUMBER))?|로트(?:\s*번호)?|LOT\s*번호)\s*[:：#]?\s*([A-Z0-9][A-Z0-9._/-]{1,30})/i);
  return match?.[1];
}

export function suggestWorkRecordDraft(
  text: string,
  projects: DemoProject[],
  items: DemoItem[],
  previous?: WorkRecordDraft,
): WorkRecordDraft {
  const recognizedProjectName = fieldValueAfterLabel(text, ["프로젝트", "현장명", "공사명"]);
  const recognizedItemName = fieldValueAfterLabel(text, ["제품명", "품목명", "품명"]);
  const recognizedPartNumber = fieldValueAfterLabel(text, ["부품명"]);
  const matchedProject = (recognizedProjectName
    ? findProjectMatch(recognizedProjectName, projects)
    : undefined)
    ?? findProjectMatch(text, projects);
  const matchedItem = findItemMatch(recognizedItemName ?? text, items, matchedProject?.id);
  const objectCount = findObjectCount(text);
  const unlistedProject = !matchedProject && recognizedProjectName ? recognizedProjectName : undefined;

  return {
    projectId: matchedProject?.id ?? (unlistedProject ? "__new__" : previous?.projectId ?? ""),
    projectSearch: matchedProject?.name ?? unlistedProject ?? previous?.projectSearch ?? "",
    projectName: matchedProject ? "" : unlistedProject ?? previous?.projectName ?? "",
    projectSpec: matchedProject
      ? {
        source_project_id: matchedProject.id,
        source_row: matchedProject.source_row ?? null,
        verification_status: matchedProject.verification_status,
        maker: matchedProject.maker ?? "",
        coating_stages: structuredClone(matchedProject.coating_stages ?? []),
        thickness_text: matchedProject.thickness_text ?? "",
        notes: (matchedProject.notes ?? []).join("\n"),
        source_text: matchedProject.source_text ?? "",
      }
      : unlistedProject ? null : previous?.projectSpec ?? null,
    lotNumber: findLotNumber(text) ?? previous?.lotNumber ?? "",
    notes: previous?.notes ?? "",
    draftItems: [makeDraftItem(matchedItem, objectCount, previous?.draftItems[0], recognizedItemName, recognizedPartNumber)],
  };
}
