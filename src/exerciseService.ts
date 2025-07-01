import fs from 'fs/promises';
import path from 'path';
import {
  Exercise,
  SearchParams,
  SearchResult,
  ExerciseStats,
  ExerciseNotFoundError,
  DataLoadError,
  ValidateExerciseKeysResult,
  SearchParamsSchema,
  ExerciseSchema,
} from './types.js';
import {
  calculateRelevanceScore,
  extractUniqueValues,
  fuzzyMatch,
  isValidUUID,
  getCurrentTimestamp,
  logInfo,
  logError,
} from './utils.js';

/**
 * Service class for managing exercise data and operations
 */
export class ExerciseService {
  private exercises: Exercise[] = [];
  private categoryIndex: Map<string, Exercise[]> = new Map();
  private equipmentIndex: Map<string, Exercise[]> = new Map();
  private muscleIndex: Map<string, Exercise[]> = new Map();
  private bodyPartIndex: Map<string, Exercise[]> = new Map();
  private appleCategoryIndex: Map<string, Exercise[]> = new Map();
  private lastUpdated: string = '';
  private initialized = false;

  /**
   * Initialize the service by loading and indexing exercise data
   */
  async initialize(dataPath: string): Promise<void> {
    try {
      logInfo('Initializing ExerciseService', { dataPath });

      const data = await this.loadExerciseData(dataPath);
      this.exercises = data;
      this.buildIndexes();
      this.lastUpdated = getCurrentTimestamp();
      this.initialized = true;

      logInfo('ExerciseService initialized successfully', {
        totalExercises: this.exercises.length,
        categories: this.categoryIndex.size,
        equipmentTypes: this.equipmentIndex.size,
      });
    } catch (error) {
      logError('Failed to initialize ExerciseService', error, { dataPath });
      throw new DataLoadError(dataPath, error);
    }
  }

  /**
   * Load and validate exercise data from JSON file
   */
  private async loadExerciseData(dataPath: string): Promise<Exercise[]> {
    try {
      const absolutePath = path.resolve(dataPath);
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      const rawData = JSON.parse(fileContent);

      if (!Array.isArray(rawData)) {
        throw new Error('Exercise data must be an array');
      }

      const exercises: Exercise[] = [];
      for (let i = 0; i < rawData.length; i++) {
        try {
          const validatedExercise = ExerciseSchema.parse(rawData[i]);
          exercises.push(validatedExercise);
        } catch (validationError) {
          logError(`Invalid exercise at index ${i}`, validationError, { exercise: rawData[i] });
          // Continue processing other exercises instead of failing completely
        }
      }

      if (exercises.length === 0) {
        throw new Error('No valid exercises found in data file');
      }

      return exercises;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON format: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build search indexes for fast filtering
   */
  private buildIndexes(): void {
    this.categoryIndex.clear();
    this.equipmentIndex.clear();
    this.muscleIndex.clear();
    this.bodyPartIndex.clear();
    this.appleCategoryIndex.clear();

    for (const exercise of this.exercises) {
      // Category index
      if (!this.categoryIndex.has(exercise.category)) {
        this.categoryIndex.set(exercise.category, []);
      }
      this.categoryIndex.get(exercise.category)!.push(exercise);

      // Equipment index
      if (!this.equipmentIndex.has(exercise.equipment)) {
        this.equipmentIndex.set(exercise.equipment, []);
      }
      this.equipmentIndex.get(exercise.equipment)!.push(exercise);

      // Body part index
      if (!this.bodyPartIndex.has(exercise.bodyPart)) {
        this.bodyPartIndex.set(exercise.bodyPart, []);
      }
      this.bodyPartIndex.get(exercise.bodyPart)!.push(exercise);

      // Apple category index
      if (!this.appleCategoryIndex.has(exercise.appleCategory)) {
        this.appleCategoryIndex.set(exercise.appleCategory, []);
      }
      this.appleCategoryIndex.get(exercise.appleCategory)!.push(exercise);

      // Muscle indexes
      for (const muscle of [...exercise.primaryMuscles, ...exercise.secondaryMuscles]) {
        if (!this.muscleIndex.has(muscle)) {
          this.muscleIndex.set(muscle, []);
        }
        this.muscleIndex.get(muscle)!.push(exercise);
      }
    }
  }

  /**
   * Search exercises with multi-field filtering and relevance scoring
   */
  searchExercises(params: SearchParams): SearchResult {
    this.ensureInitialized();

    try {
      // Validate search parameters
      const validatedParams = SearchParamsSchema.parse(params);

      let results = [...this.exercises];

      // Apply filters
      if (validatedParams.equipment) {
        results = results.filter(ex =>
          ex.equipment.toLowerCase().includes(validatedParams.equipment!.toLowerCase())
        );
      }

      if (validatedParams.category) {
        results = results.filter(ex =>
          ex.category.toLowerCase().includes(validatedParams.category!.toLowerCase())
        );
      }

      if (validatedParams.bodyPart) {
        results = results.filter(ex =>
          ex.bodyPart.toLowerCase().includes(validatedParams.bodyPart!.toLowerCase())
        );
      }

      if (validatedParams.appleCategory) {
        results = results.filter(ex =>
          ex.appleCategory.toLowerCase().includes(validatedParams.appleCategory!.toLowerCase())
        );
      }

      if (validatedParams.primaryMuscles && validatedParams.primaryMuscles.length > 0) {
        results = results.filter(ex =>
          validatedParams.primaryMuscles!.some(muscle =>
            ex.primaryMuscles.some(pm =>
              pm.toLowerCase().includes(muscle.toLowerCase())
            )
          )
        );
      }

      if (validatedParams.secondaryMuscles && validatedParams.secondaryMuscles.length > 0) {
        results = results.filter(ex =>
          validatedParams.secondaryMuscles!.some(muscle =>
            ex.secondaryMuscles.some(sm =>
              sm.toLowerCase().includes(muscle.toLowerCase())
            )
          )
        );
      }

      // Apply text search
      if (validatedParams.query) {
        results = results.filter(ex =>
          fuzzyMatch(ex.name, validatedParams.query!) ||
          fuzzyMatch(ex.category, validatedParams.query!) ||
          fuzzyMatch(ex.equipment, validatedParams.query!) ||
          ex.primaryMuscles.some(m => fuzzyMatch(m, validatedParams.query!)) ||
          ex.secondaryMuscles.some(m => fuzzyMatch(m, validatedParams.query!)) ||
          ex.instructions.some(inst => fuzzyMatch(inst, validatedParams.query!))
        );
      }

      // Calculate relevance scores and sort
      const scoredResults = results.map(exercise => ({
        exercise,
        score: calculateRelevanceScore(exercise, validatedParams.query),
      }));

      scoredResults.sort((a, b) => b.score - a.score);
      const sortedExercises = scoredResults.map(item => item.exercise);

      // Apply pagination
      const total = sortedExercises.length;
      const offset = validatedParams.offset;
      const limit = validatedParams.limit;
      const paginatedExercises = sortedExercises.slice(offset, offset + limit);

      return {
        exercises: paginatedExercises,
        total,
        offset,
        limit,
        hasMore: offset + paginatedExercises.length < total,
      };
    } catch (error) {
      logError('Error in searchExercises', error, { params });
      throw error;
    }
  }

  /**
   * Get exercise by ID
   */
  getExerciseById(id: string): Exercise {
    this.ensureInitialized();

    if (!isValidUUID(id)) {
      throw new ExerciseNotFoundError(id);
    }

    const exercise = this.exercises.find(ex => ex.id === id);
    if (!exercise) {
      throw new ExerciseNotFoundError(id);
    }

    return exercise;
  }

  /**
   * Filter exercises by equipment
   */
  filterExercisesByEquipment(equipment: string, limit: number = 20, offset: number = 0): SearchResult {
    this.ensureInitialized();

    const exercisesForEquipment = this.equipmentIndex.get(equipment) || [];
    const total = exercisesForEquipment.length;
    const paginatedExercises = exercisesForEquipment.slice(offset, offset + limit);

    return {
      exercises: paginatedExercises,
      total,
      offset,
      limit,
      hasMore: offset + paginatedExercises.length < total,
    };
  }

  /**
   * Get exercises by category
   */
  getExercisesByCategory(category: string, limit: number = 20, offset: number = 0): SearchResult {
    this.ensureInitialized();

    const exercisesForCategory = this.categoryIndex.get(category) || [];
    const total = exercisesForCategory.length;
    const paginatedExercises = exercisesForCategory.slice(offset, offset + limit);

    return {
      exercises: paginatedExercises,
      total,
      offset,
      limit,
      hasMore: offset + paginatedExercises.length < total,
    };
  }

  /**
   * Find exercise alternatives
   */
  findExerciseAlternatives(
    exerciseId: string,
    targetMuscles?: string[],
    equipment?: string,
    limit: number = 10
  ): Exercise[] {
    this.ensureInitialized();

    const originalExercise = this.getExerciseById(exerciseId);

    let candidates = this.exercises.filter(ex => ex.id !== exerciseId);

    // Filter by target muscles (use original exercise muscles if not specified)
    const musclesToMatch = targetMuscles && targetMuscles.length > 0
      ? targetMuscles
      : originalExercise.primaryMuscles;

    candidates = candidates.filter(ex =>
      musclesToMatch.some(muscle =>
        ex.primaryMuscles.some(pm => pm.toLowerCase().includes(muscle.toLowerCase())) ||
        ex.secondaryMuscles.some(sm => sm.toLowerCase().includes(muscle.toLowerCase()))
      )
    );

    // Filter by equipment if specified
    if (equipment) {
      candidates = candidates.filter(ex =>
        ex.equipment.toLowerCase().includes(equipment.toLowerCase())
      );
    }

    // Sort by muscle group similarity
    const scoredCandidates = candidates.map(candidate => {
      let score = 0;

      // Primary muscle matches
      for (const muscle of originalExercise.primaryMuscles) {
        if (candidate.primaryMuscles.some(pm => pm.toLowerCase() === muscle.toLowerCase())) {
          score += 10;
        }
        if (candidate.secondaryMuscles.some(sm => sm.toLowerCase() === muscle.toLowerCase())) {
          score += 5;
        }
      }

      // Secondary muscle matches
      for (const muscle of originalExercise.secondaryMuscles) {
        if (candidate.primaryMuscles.some(pm => pm.toLowerCase() === muscle.toLowerCase())) {
          score += 5;
        }
        if (candidate.secondaryMuscles.some(sm => sm.toLowerCase() === muscle.toLowerCase())) {
          score += 3;
        }
      }

      // Same body part bonus
      if (candidate.bodyPart === originalExercise.bodyPart) {
        score += 5;
      }

      // Same category bonus
      if (candidate.category === originalExercise.category) {
        score += 3;
      }

      // Same equipment bonus
      if (candidate.equipment === originalExercise.equipment) {
        score += 2;
      }

      return { exercise: candidate, score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates.slice(0, limit).map(item => item.exercise);
  }

  /**
   * Validate exercise IDs
   */
  validateExerciseKeys(exerciseIds: string[]): ValidateExerciseKeysResult {
    this.ensureInitialized();

    const valid: string[] = [];
    const invalid: string[] = [];

    for (const id of exerciseIds) {
      if (!isValidUUID(id)) {
        invalid.push(id);
        continue;
      }

      const exists = this.exercises.some(ex => ex.id === id);
      if (exists) {
        valid.push(id);
      } else {
        invalid.push(id);
      }
    }

    return { valid, invalid };
  }

  /**
   * Get all exercises with pagination
   */
  getAllExercises(limit: number = 20, offset: number = 0): SearchResult {
    this.ensureInitialized();

    const total = this.exercises.length;
    const paginatedExercises = this.exercises.slice(offset, offset + limit);

    return {
      exercises: paginatedExercises,
      total,
      offset,
      limit,
      hasMore: offset + paginatedExercises.length < total,
    };
  }

  /**
   * Get unique categories
   */
  getCategories(): string[] {
    this.ensureInitialized();
    return Array.from(this.categoryIndex.keys()).sort();
  }

  /**
   * Get unique equipment types
   */
  getEquipmentTypes(): string[] {
    this.ensureInitialized();
    return Array.from(this.equipmentIndex.keys()).sort();
  }

  /**
   * Get unique muscle groups
   */
  getMuscleGroups(): string[] {
    this.ensureInitialized();
    return Array.from(this.muscleIndex.keys()).sort();
  }

  /**
   * Get unique body parts
   */
  getBodyParts(): string[] {
    this.ensureInitialized();
    return Array.from(this.bodyPartIndex.keys()).sort();
  }

  /**
   * Get unique Apple categories
   */
  getAppleCategories(): string[] {
    this.ensureInitialized();
    return Array.from(this.appleCategoryIndex.keys()).sort();
  }

  /**
   * Get database statistics
   */
  getStats(): ExerciseStats {
    this.ensureInitialized();

    return {
      totalExercises: this.exercises.length,
      categories: this.categoryIndex.size,
      equipmentTypes: this.equipmentIndex.size,
      primaryMuscles: extractUniqueValues(this.exercises, 'primaryMuscles').length,
      secondaryMuscles: extractUniqueValues(this.exercises, 'secondaryMuscles').length,
      bodyParts: this.bodyPartIndex.size,
      appleCategories: this.appleCategoryIndex.size,
    };
  }

  /**
   * Get service health status
   */
  getHealthStatus(): string {
    return this.initialized ? 'healthy' : 'uninitialized';
  }

  /**
   * Get total exercise count
   */
  getTotalCount(): number {
    return this.exercises.length;
  }

  /**
   * Get categories count
   */
  getCategoriesCount(): number {
    return this.categoryIndex.size;
  }

  /**
   * Get last updated timestamp
   */
  getLastUpdated(): string {
    return this.lastUpdated;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure service is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ExerciseService not initialized. Call initialize() first.');
    }
  }
}
