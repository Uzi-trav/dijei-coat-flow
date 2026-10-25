import type { DemoProject } from "@/lib/demoStore";

export function normalizeProjectName(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

export function searchProjects(projects: DemoProject[], query: string): DemoProject[] {
  const normalizedQuery = normalizeProjectName(query);
  if (!normalizedQuery) return [];

  return projects
    .map((project) => {
      const canonical = normalizeProjectName(project.name);
      const aliases = project.aliases ?? [];
      const exactName = canonical === normalizedQuery;
      const exactAlias = aliases.some((alias) => normalizeProjectName(alias) === normalizedQuery);
      const partial = canonical.includes(normalizedQuery)
        || aliases.some((alias) => normalizeProjectName(alias).includes(normalizedQuery));
      return { project, rank: exactName ? 0 : exactAlias ? 1 : partial ? 2 : 3 };
    })
    .filter((match) => match.rank < 3)
    .sort((left, right) => left.rank - right.rank || left.project.name.localeCompare(right.project.name))
    .map(({ project }) => project);
}
