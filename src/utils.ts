import type { Exercise, SearchScore } from './types.js';

/**
 * Normalize text for searching - lowercase, trim, remove extra spaces
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Calculate fuzzy match score using Levenshtein distance
 */
export function fuzzyMatchScore(query: string, target: string): number {
  const normalizedQuery = normalizeText(query);
  const normalizedTarget = normalizeText(target);

  if (normalizedQuery === normalizedTarget) return 1.0;
  if (normalizedTarget.includes(normalizedQuery)) return 0.8;

  const distance = levenshteinDistance(normalizedQuery, normalizedTarget);
  const maxLength = Math.max(normalizedQuery.length, normalizedTarget.length);

  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Levenshtein distance implementation for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    if (matrix[0]) {
      matrix[0][j] = j;
    }
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];

      if (currentRow && prevRow) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          currentRow[j] = prevRow[j - 1] ?? 0;
        } else {
          currentRow[j] = Math.min(
            (prevRow[j - 1] ?? 0) + 1, // substitution
            (currentRow[j - 1] ?? 0) + 1, // insertion
            (prevRow[j] ?? 0) + 1 // deletion
          );
        }
      }
    }
  }

  return matrix[str2.length]?.[str1.length] ?? 0;
}

/**
 * Score exercise relevance based on search query
 */
export function scoreExerciseRelevance(exercise: Exercise, query: string): SearchScore {
  const normalizedQuery = normalizeText(query);
  const matchReasons: string[] = [];
  let totalScore = 0;

  // Exact name match gets highest score
  if (normalizeText(exercise.name) === normalizedQuery) {
    totalScore += 10;
    matchReasons.push('exact name match');
  }
  // Partial name match
  else if (normalizeText(exercise.name).includes(normalizedQuery)) {
    totalScore += 8;
    matchReasons.push('name contains query');
  }
  // Fuzzy name match
  else {
    const nameScore = fuzzyMatchScore(query, exercise.name);
    if (nameScore > 0.7) {
      totalScore += nameScore * 6;
      matchReasons.push('fuzzy name match');
    }
  }

  // Category matches
  if (normalizeText(exercise.category).includes(normalizedQuery)) {
    totalScore += 5;
    matchReasons.push('category match');
  }

  // Equipment matches
  if (normalizeText(exercise.equipment).includes(normalizedQuery)) {
    totalScore += 4;
    matchReasons.push('equipment match');
  }

  // Body part matches
  if (normalizeText(exercise.bodyPart).includes(normalizedQuery)) {
    totalScore += 4;
    matchReasons.push('body part match');
  }

  // Primary muscle matches
  for (const muscle of exercise.primaryMuscles) {
    if (normalizeText(muscle).includes(normalizedQuery)) {
      totalScore += 6;
      matchReasons.push('primary muscle match');
      break; // Only count once per exercise
    }
  }

  // Secondary muscle matches
  for (const muscle of exercise.secondaryMuscles) {
    if (normalizeText(muscle).includes(normalizedQuery)) {
      totalScore += 3;
      matchReasons.push('secondary muscle match');
      break; // Only count once per exercise
    }
  }

  // Instructions contain query
  const instructionsText = exercise.instructions.join(' ');
  if (normalizeText(instructionsText).includes(normalizedQuery)) {
    totalScore += 2;
    matchReasons.push('instructions match');
  }

  return {
    exerciseId: exercise.id,
    score: totalScore,
    matchReasons
  };
}

/**
 * Calculate similarity between two exercises based on muscles and equipment
 */
export function calculateExerciseSimilarity(exercise1: Exercise, exercise2: Exercise): number {
  let similarity = 0;

  // Same equipment gets high similarity
  if (exercise1.equipment === exercise2.equipment) {
    similarity += 3;
  }

  // Same category gets medium similarity
  if (exercise1.category === exercise2.category) {
    similarity += 2;
  }

  // Same body part gets medium similarity
  if (exercise1.bodyPart === exercise2.bodyPart) {
    similarity += 2;
  }

  // Shared primary muscles get high similarity
  const sharedPrimary = exercise1.primaryMuscles.filter((m) => exercise2.primaryMuscles.includes(m));
  similarity += sharedPrimary.length * 4;

  // Shared secondary muscles get low similarity
  const sharedSecondary = exercise1.secondaryMuscles.filter(
    (m) => exercise2.secondaryMuscles.includes(m) || exercise2.primaryMuscles.includes(m)
  );
  similarity += sharedSecondary.length * 1;

  // Primary muscle in secondary muscles gets medium similarity
  const primaryInSecondary = exercise1.primaryMuscles.filter((m) => exercise2.secondaryMuscles.includes(m));
  similarity += primaryInSecondary.length * 2;

  return similarity;
}

/**
 * Paginate array with offset and limit
 */
export function paginateArray<T>(
  array: T[],
  offset: number,
  limit: number
): {
  items: T[];
  hasMore: boolean;
  total: number;
} {
  const total = array.length;
  const items = array.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return { items, hasMore, total };
}

/**
 * Get unique values from array of strings
 */
export function getUniqueValues(array: string[]): string[] {
  return [...new Set(array)].sort();
}

/**
 * Flatten array of arrays
 */
export function flattenStringArrays(arrays: string[][]): string[] {
  return arrays.flat();
}

/**
 * Check if arrays have any common elements
 */
export function hasCommonElements(arr1: string[], arr2: string[]): boolean {
  return arr1.some((item) => arr2.includes(item));
}

/**
 * Safe JSON parsing with fallback
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Create error response object
 */
export function createErrorResponse(
  message: string,
  code: string,
  details?: unknown
): {
  error: string;
  code: string;
  details?: unknown;
} {
  return {
    error: message,
    code,
    details
  };
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Log with timestamp
 */
export function logWithTimestamp(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const logLevel = level.toUpperCase();

  process.stdout.write(`[${timestamp}] ${logLevel}: ${message}\n`);
}
