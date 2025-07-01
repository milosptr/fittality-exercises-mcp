import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { Exercise } from './types.js';

/**
 * Calculate relevance score for exercise search results
 */
export function calculateRelevanceScore(exercise: Exercise, query?: string): number {
  if (!query) return 1;

  const searchText = query.toLowerCase();
  const exerciseName = exercise.name.toLowerCase();
  const instructions = exercise.instructions.join(' ').toLowerCase();
  const category = exercise.category.toLowerCase();
  const equipment = exercise.equipment.toLowerCase();
  const muscles = [...exercise.primaryMuscles, ...exercise.secondaryMuscles].join(' ').toLowerCase();

  let score = 0;

  // Exact name match gets highest score
  if (exerciseName === searchText) {
    score += 100;
  } else if (exerciseName.includes(searchText)) {
    score += 50;
  }

  // Category match
  if (category.includes(searchText)) {
    score += 30;
  }

  // Equipment match
  if (equipment.includes(searchText)) {
    score += 25;
  }

  // Muscle match
  if (muscles.includes(searchText)) {
    score += 20;
  }

  // Instructions match (lower priority)
  if (instructions.includes(searchText)) {
    score += 10;
  }

  // Partial word matches
  const words = searchText.split(' ');
  for (const word of words) {
    if (word.length > 2) {
      if (exerciseName.includes(word)) score += 5;
      if (category.includes(word)) score += 3;
      if (equipment.includes(word)) score += 3;
      if (muscles.includes(word)) score += 2;
    }
  }

  return score;
}

/**
 * Generate a unique client ID for OAuth
 */
export function generateClientId(prefix: string): string {
  return `${prefix}-${uuidv4()}`;
}

/**
 * Generate JWT token
 */
export function generateToken(payload: object, secret: string, expiresIn: number): string {
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string, secret: string): any {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Extract unique values from array of objects
 */
export function extractUniqueValues<T>(items: T[], key: keyof T): string[] {
  const values = new Set<string>();
  for (const item of items) {
    const value = item[key];
    if (typeof value === 'string') {
      values.add(value);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === 'string') {
          values.add(v);
        }
      }
    }
  }
  return Array.from(values).sort();
}

/**
 * Create paginated result
 */
export function createPaginatedResult<T>(
  items: T[],
  offset: number,
  limit: number,
  total: number
): {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
} {
  return {
    items,
    total,
    offset,
    limit,
    hasMore: offset + items.length < total,
  };
}

/**
 * Fuzzy string matching for search
 */
export function fuzzyMatch(text: string, pattern: string): boolean {
  const textLower = text.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Exact match
  if (textLower.includes(patternLower)) {
    return true;
  }

  // Word boundary match
  const words = textLower.split(/\s+/);
  return words.some(word => word.includes(patternLower));
}

/**
 * Sanitize and validate input strings
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  return input.trim().slice(0, maxLength);
}

/**
 * Parse and validate pagination parameters
 */
export function parsePaginationParams(limit?: string, offset?: string): { limit: number; offset: number } {
  const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;
  const parsedOffset = offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0;

  return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Log structured data
 */
export function logInfo(message: string, data?: object): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    ...data,
  }));
}

/**
 * Log errors with context
 */
export function logError(message: string, error?: unknown, context?: object): void {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    ...context,
  }));
}

/**
 * Create MCP error response
 */
export function createMCPError(code: number, message: string, data?: unknown): object {
  return {
    code,
    message,
    data,
  };
}

/**
 * Validate UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
