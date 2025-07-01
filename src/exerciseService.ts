import { readFile } from 'fs/promises';
import { join } from 'path';
import type {
  Exercise,
  SearchParams,
  SearchResult,
  AlternativesResult,
  ValidationResult,
  ExerciseStats,
  ExerciseIndex,
  CategoryIndex,
  EquipmentIndex,
  MuscleIndex
} from './types.js';
import {
  scoreExerciseRelevance,
  calculateExerciseSimilarity,
  paginateArray,
  getUniqueValues,
  hasCommonElements,
  logWithTimestamp
} from './utils.js';
import { ExerciseSchema } from './types.js';

/**
 * Exercise service class that manages all exercise data and operations
 */
export class ExerciseService {
  private exercises: Exercise[] = [];
  private exerciseIndex: ExerciseIndex = new Map();
  private categoryIndex: CategoryIndex = new Map();
  private equipmentIndex: EquipmentIndex = new Map();
  private primaryMuscleIndex: MuscleIndex = new Map();
  private secondaryMuscleIndex: MuscleIndex = new Map();
  private bodyPartIndex: Map<string, string[]> = new Map();
  private appleCategoryIndex: Map<string, string[]> = new Map();
  private isInitialized = false;

  /**
   * Initialize the service by loading and indexing exercise data
   */
  async initialize(dataPath?: string): Promise<void> {
    try {
      const exercisesPath = dataPath || join(process.cwd(), 'data', 'exercises.json');
      logWithTimestamp(`Loading exercises from: ${exercisesPath}`);

      const exerciseData = await readFile(exercisesPath, 'utf-8');
      const rawExercises = JSON.parse(exerciseData) as unknown[];

      // Validate and parse exercises
      this.exercises = rawExercises.map((exercise, index) => {
        try {
          return ExerciseSchema.parse(exercise);
        } catch (error) {
          logWithTimestamp(`Invalid exercise at index ${index}: ${error}`, 'warn');
          throw new Error(`Exercise validation failed at index ${index}`);
        }
      });

      logWithTimestamp(`Loaded ${this.exercises.length} exercises successfully`);

      // Build search indexes
      this.buildIndexes();
      this.isInitialized = true;

      logWithTimestamp('Exercise service initialized successfully');
    } catch (error) {
      logWithTimestamp(`Failed to initialize exercise service: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Build search indexes for fast filtering
   */
  private buildIndexes(): void {
    logWithTimestamp('Building search indexes...');

    for (const exercise of this.exercises) {
      // Exercise ID index
      this.exerciseIndex.set(exercise.id, exercise);

      // Category index
      this.addToIndex(this.categoryIndex, exercise.category, exercise.id);

      // Equipment index
      this.addToIndex(this.equipmentIndex, exercise.equipment, exercise.id);

      // Body part index
      this.addToIndex(this.bodyPartIndex, exercise.bodyPart, exercise.id);

      // Apple category index
      this.addToIndex(this.appleCategoryIndex, exercise.appleCategory, exercise.id);

      // Primary muscle index
      for (const muscle of exercise.primaryMuscles) {
        this.addToIndex(this.primaryMuscleIndex, muscle, exercise.id);
      }

      // Secondary muscle index
      for (const muscle of exercise.secondaryMuscles) {
        this.addToIndex(this.secondaryMuscleIndex, muscle, exercise.id);
      }
    }

    logWithTimestamp(`Built indexes: ${this.categoryIndex.size} categories, ${this.equipmentIndex.size} equipment types, ${this.primaryMuscleIndex.size} primary muscles`);
  }

  /**
   * Helper to add items to indexes
   */
  private addToIndex(index: Map<string, string[]>, key: string, exerciseId: string): void {
    const normalizedKey = key.toLowerCase();
    const existing = index.get(normalizedKey) || [];
    existing.push(exerciseId);
    index.set(normalizedKey, existing);
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Exercise service not initialized. Call initialize() first.');
    }
  }

  /**
   * Get all exercises with pagination
   */
  getAllExercises(limit = 20, offset = 0): SearchResult {
    this.ensureInitialized();

    const result = paginateArray(this.exercises, offset, limit);

    return {
      exercises: result.items,
      total: result.total,
      limit,
      offset,
      hasMore: result.hasMore
    };
  }

  /**
   * Get exercise by ID
   */
  getExerciseById(id: string): Exercise | null {
    this.ensureInitialized();
    return this.exerciseIndex.get(id) || null;
  }

  /**
   * Search exercises with advanced filtering and relevance scoring
   */
  searchExercises(params: SearchParams): SearchResult {
    this.ensureInitialized();

    let candidateIds = new Set<string>(this.exercises.map(e => e.id));

    // Apply filters to narrow down candidates
    if (params.equipment) {
      const equipmentIds = this.equipmentIndex.get(params.equipment.toLowerCase()) || [];
      candidateIds = new Set(equipmentIds.filter(id => candidateIds.has(id)));
    }

    if (params.category) {
      const categoryIds = this.categoryIndex.get(params.category.toLowerCase()) || [];
      candidateIds = new Set(categoryIds.filter(id => candidateIds.has(id)));
    }

    if (params.bodyPart) {
      const bodyPartIds = this.bodyPartIndex.get(params.bodyPart.toLowerCase()) || [];
      candidateIds = new Set(bodyPartIds.filter(id => candidateIds.has(id)));
    }

    if (params.appleCategory) {
      const appleCategoryIds = this.appleCategoryIndex.get(params.appleCategory.toLowerCase()) || [];
      candidateIds = new Set(appleCategoryIds.filter(id => candidateIds.has(id)));
    }

    if (params.primaryMuscles && params.primaryMuscles.length > 0) {
      const muscleIds = new Set<string>();
      for (const muscle of params.primaryMuscles) {
        const ids = this.primaryMuscleIndex.get(muscle.toLowerCase()) || [];
        ids.forEach(id => muscleIds.add(id));
      }
      candidateIds = new Set([...candidateIds].filter(id => muscleIds.has(id)));
    }

    if (params.secondaryMuscles && params.secondaryMuscles.length > 0) {
      const muscleIds = new Set<string>();
      for (const muscle of params.secondaryMuscles) {
        const ids = this.secondaryMuscleIndex.get(muscle.toLowerCase()) || [];
        ids.forEach(id => muscleIds.add(id));
      }
      candidateIds = new Set([...candidateIds].filter(id => muscleIds.has(id)));
    }

    // Get candidate exercises
    const candidates = [...candidateIds]
      .map(id => this.exerciseIndex.get(id))
      .filter((exercise): exercise is Exercise => exercise !== undefined);

    // Apply text search and scoring if query is provided
    let searchResults = candidates;
    if (params.query && params.query.trim()) {
      const scoredResults = candidates
        .map(exercise => ({
          exercise,
          score: scoreExerciseRelevance(exercise, params.query!)
        }))
        .filter(result => result.score.score > 0)
        .sort((a, b) => b.score.score - a.score.score);

      searchResults = scoredResults.map(result => result.exercise);
    }

    // Apply pagination
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const paginatedResult = paginateArray(searchResults, offset, limit);

    return {
      exercises: paginatedResult.items,
      total: paginatedResult.total,
      limit,
      offset,
      hasMore: paginatedResult.hasMore
    };
  }

  /**
   * Filter exercises by equipment type
   */
  filterByEquipment(equipment: string, limit = 20, offset = 0): SearchResult {
    this.ensureInitialized();

    const exerciseIds = this.equipmentIndex.get(equipment.toLowerCase()) || [];
    const exercises = exerciseIds
      .map(id => this.exerciseIndex.get(id))
      .filter((exercise): exercise is Exercise => exercise !== undefined);

    const result = paginateArray(exercises, offset, limit);

    return {
      exercises: result.items,
      total: result.total,
      limit,
      offset,
      hasMore: result.hasMore
    };
  }

  /**
   * Get exercises by category
   */
  getByCategory(category: string, limit = 20, offset = 0): SearchResult {
    this.ensureInitialized();

    const exerciseIds = this.categoryIndex.get(category.toLowerCase()) || [];
    const exercises = exerciseIds
      .map(id => this.exerciseIndex.get(id))
      .filter((exercise): exercise is Exercise => exercise !== undefined);

    const result = paginateArray(exercises, offset, limit);

    return {
      exercises: result.items,
      total: result.total,
      limit,
      offset,
      hasMore: result.hasMore
    };
  }

  /**
   * Find exercise alternatives based on similar muscles and optionally equipment
   */
  findAlternatives(exerciseId: string, targetMuscles?: string[], equipment?: string, limit = 10): AlternativesResult {
    this.ensureInitialized();

    const originalExercise = this.getExerciseById(exerciseId);
    if (!originalExercise) {
      throw new Error(`Exercise with ID ${exerciseId} not found`);
    }

    // Determine target muscles (use provided or original exercise's primary muscles)
    const searchMuscles = targetMuscles || originalExercise.primaryMuscles;

    // Find exercises with similar muscles
    const alternatives = this.exercises
      .filter(exercise => exercise.id !== exerciseId) // Exclude original
      .filter(exercise => {
        // Must share at least one primary muscle
        const sharesPrimary = hasCommonElements(exercise.primaryMuscles, searchMuscles);
        // Or have search muscle as secondary while original has it as primary
        const hasAsSecondary = hasCommonElements(exercise.secondaryMuscles, searchMuscles);
        return sharesPrimary || hasAsSecondary;
      })
      .filter(exercise => {
        // If equipment filter is specified, must match
        return !equipment || exercise.equipment.toLowerCase() === equipment.toLowerCase();
      })
      .map(exercise => ({
        exercise,
        similarity: calculateExerciseSimilarity(originalExercise, exercise)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(result => result.exercise);

    return {
      original: originalExercise,
      alternatives,
      total: alternatives.length
    };
  }

  /**
   * Validate exercise IDs
   */
  validateExerciseIds(exerciseIds: string[]): ValidationResult {
    this.ensureInitialized();

    const valid: string[] = [];
    const invalid: string[] = [];

    for (const id of exerciseIds) {
      if (this.exerciseIndex.has(id)) {
        valid.push(id);
      } else {
        invalid.push(id);
      }
    }

    return { valid, invalid };
  }

  /**
   * Get exercise statistics and metadata
   */
  getExerciseStats(): ExerciseStats {
    this.ensureInitialized();

    const categories = getUniqueValues([...this.categoryIndex.keys()]);
    const equipmentTypes = getUniqueValues([...this.equipmentIndex.keys()]);
    const bodyParts = getUniqueValues([...this.bodyPartIndex.keys()]);
    const primaryMuscleGroups = getUniqueValues([...this.primaryMuscleIndex.keys()]);
    const secondaryMuscleGroups = getUniqueValues([...this.secondaryMuscleIndex.keys()]);
    const appleCategories = getUniqueValues([...this.appleCategoryIndex.keys()]);

    return {
      totalExercises: this.exercises.length,
      categories,
      equipmentTypes,
      bodyParts,
      primaryMuscleGroups,
      secondaryMuscleGroups,
      appleCategories
    };
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    this.ensureInitialized();
    return getUniqueValues([...this.categoryIndex.keys()]);
  }

  /**
   * Get all unique equipment types
   */
  getEquipmentTypes(): string[] {
    this.ensureInitialized();
    return getUniqueValues([...this.equipmentIndex.keys()]);
  }

  /**
   * Get all unique muscle groups
   */
  getMuscleGroups(): string[] {
    this.ensureInitialized();
    const primary = [...this.primaryMuscleIndex.keys()];
    const secondary = [...this.secondaryMuscleIndex.keys()];
    return getUniqueValues([...primary, ...secondary]);
  }

  /**
   * Get all unique body parts
   */
  getBodyParts(): string[] {
    this.ensureInitialized();
    return getUniqueValues([...this.bodyPartIndex.keys()]);
  }

  /**
   * Get all unique Apple categories
   */
  getAppleCategories(): string[] {
    this.ensureInitialized();
    return getUniqueValues([...this.appleCategoryIndex.keys()]);
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: 'healthy' | 'unhealthy'; exerciseCount: number; initialized: boolean } {
    return {
      status: this.isInitialized && this.exercises.length > 0 ? 'healthy' : 'unhealthy',
      exerciseCount: this.exercises.length,
      initialized: this.isInitialized
    };
  }
}
