import type { DemoProject } from "@/lib/demoStore";

export function normalizeProjectName(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function fuzzyMatchScore(query: string, candidate: string): number {
  const queryCharacters = Array.from(query);
  const candidateCharacters = Array.from(candidate);
  if (queryCharacters.length < 4 || queryCharacters.length > 60 || candidateCharacters.length < 4) return 0;

  const lengthTolerance = Math.max(1, Math.floor(queryCharacters.length * 0.3));
  const shortestWindow = Math.max(1, queryCharacters.length - lengthTolerance);
  const longestWindow = Math.min(candidateCharacters.length, queryCharacters.length + lengthTolerance);
  let bestScore = 0;

  for (let windowLength = shortestWindow; windowLength <= longestWindow; windowLength += 1) {
    for (let start = 0; start <= candidateCharacters.length - windowLength; start += 1) {
      const window = candidateCharacters.slice(start, start + windowLength);
      let previousRow = Array.from({ length: window.length + 1 }, (_, index) => index);
      for (let queryIndex = 1; queryIndex <= queryCharacters.length; queryIndex += 1) {
        const currentRow = [queryIndex];
        for (let windowIndex = 1; windowIndex <= window.length; windowIndex += 1) {
          currentRow[windowIndex] = Math.min(
            currentRow[windowIndex - 1] + 1,
            previousRow[windowIndex] + 1,
            previousRow[windowIndex - 1]
              + (queryCharacters[queryIndex - 1] === window[windowIndex - 1] ? 0 : 1),
          );
        }
        previousRow = currentRow;
      }
      const distance = previousRow[window.length];
      bestScore = Math.max(bestScore, 1 - distance / Math.max(queryCharacters.length, window.length));
    }
  }

  return bestScore;
}

export function searchProjects(projects: DemoProject[], query: string): DemoProject[] {
  const normalizedQuery = normalizeProjectName(query);
  if (!normalizedQuery) return [];

  return projects
    .map((project) => {
      const canonical = normalizeProjectName(project.name);
      const aliases = (project.aliases ?? []).map(normalizeProjectName);
      const exactName = canonical === normalizedQuery;
      const exactAlias = aliases.some((alias) => alias === normalizedQuery);
      const partial = canonical.includes(normalizedQuery)
        || aliases.some((alias) => alias.includes(normalizedQuery));
      const fuzzyScore = partial || exactName || exactAlias
        ? 0
        : Math.max(fuzzyMatchScore(normalizedQuery, canonical), ...aliases.map((alias) =>
          fuzzyMatchScore(normalizedQuery, alias),
        ));
      return {
        project,
        rank: exactName ? 0 : exactAlias ? 1 : partial ? 2 : 3,
        fuzzyScore,
      };
    })
    .filter((match) => match.rank < 3 || match.fuzzyScore >= 0.55)
    .sort((left, right) => left.rank - right.rank
      || right.fuzzyScore - left.fuzzyScore
      || left.project.name.localeCompare(right.project.name))
    .map(({ project }) => project);
}
