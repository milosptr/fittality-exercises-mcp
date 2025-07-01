import { z } from 'zod';

/**
 * Core Exercise interface matching the JSON data structure
 */
export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  category: string;
  appleCategory: string;
  bodyPart: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

/**
 * Zod schema for Exercise validation
 */
export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  equipment: z.string().min(1),
  category: z.string().min(1),
  appleCategory: z.string().min(1),
  bodyPart: z.string().min(1),
  primaryMuscles: z.array(z.string()).min(1),
  secondaryMuscles: z.array(z.string()),
  instructions: z.array(z.string()).min(1),
  images: z.array(z.string())
});

/**
 * Search parameters for exercise filtering
 */
export interface SearchParams {
  equipment?: string | undefined;
  category?: string | undefined;
  primaryMuscles?: string[] | undefined;
  secondaryMuscles?: string[] | undefined;
  bodyPart?: string | undefined;
  appleCategory?: string | undefined;
  query?: string | undefined; // Text search across name and instructions
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * Zod schema for search parameters validation
 */
export const SearchParamsSchema = z.object({
  equipment: z.string().optional(),
  category: z.string().optional(),
  primaryMuscles: z.array(z.string()).optional(),
  secondaryMuscles: z.array(z.string()).optional(),
  bodyPart: z.string().optional(),
  appleCategory: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0)
});

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  exercises: Exercise[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Exercise alternatives result
 */
export interface AlternativesResult {
  original: Exercise;
  alternatives: Exercise[];
  total: number;
}

/**
 * Validation result for exercise IDs
 */
export interface ValidationResult {
  valid: string[];
  invalid: string[];
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Aggregated data structures for resources
 */
export interface ExerciseStats {
  totalExercises: number;
  categories: string[];
  equipmentTypes: string[];
  bodyParts: string[];
  primaryMuscleGroups: string[];
  secondaryMuscleGroups: string[];
  appleCategories: string[];
}

/**
 * Resource content types
 */
export interface ResourceContent {
  exercises?: Exercise[];
  categories?: string[];
  equipmentTypes?: string[];
  muscleGroups?: string[];
  stats?: ExerciseStats;
}

/**
 * MCP Tool parameter schemas
 */
export const GetExerciseByIdSchema = z.object({
  id: z.string().uuid('Invalid exercise ID format')
});

export const FilterByEquipmentSchema = z.object({
  equipment: z.string().min(1, 'Equipment type is required'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

export const GetByCategorySchema = z.object({
  category: z.string().min(1, 'Category is required'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

export const FindAlternativesSchema = z.object({
  exerciseId: z.string().uuid('Invalid exercise ID format'),
  targetMuscles: z.array(z.string()).optional(),
  equipment: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10)
});

export const ValidateExerciseKeysSchema = z.object({
  exerciseIds: z.array(z.string().uuid('Invalid exercise ID format')).min(1, 'At least one exercise ID is required')
});

/**
 * Type guards for runtime type checking
 */
export function isExercise(obj: unknown): obj is Exercise {
  try {
    ExerciseSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

export function isSearchParams(obj: unknown): obj is SearchParams {
  try {
    SearchParamsSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

/**
 * Utility types for internal processing
 */
export type ExerciseIndex = Map<string, Exercise>;
export type CategoryIndex = Map<string, string[]>; // category -> exercise IDs
export type EquipmentIndex = Map<string, string[]>; // equipment -> exercise IDs
export type MuscleIndex = Map<string, string[]>; // muscle -> exercise IDs

/**
 * Search scoring interface for relevance ranking
 */
export interface SearchScore {
  exerciseId: string;
  score: number;
  matchReasons: string[];
}
