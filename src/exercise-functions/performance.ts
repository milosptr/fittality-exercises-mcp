import { getExerciseData } from './loader.js';
import type { PerformanceMetrics, IntegrityReport, Exercise } from '../types.js';

// Performance tracking
let searchMetrics: number[] = [];
let requestCount = 0;
let startTime = Date.now();

export function trackSearchTime(duration: number): void {
  searchMetrics.push(duration);
  // Keep only last 100 measurements to prevent memory growth
  if (searchMetrics.length > 100) {
    searchMetrics = searchMetrics.slice(-100);
  }
}

export function incrementRequestCount(): void {
  requestCount++;
}

export function getPerformanceMetrics(): PerformanceMetrics {
  const memoryUsage = process.memoryUsage();

  const searchLatency = searchMetrics.length > 0 ? {
    average: searchMetrics.reduce((a, b) => a + b, 0) / searchMetrics.length,
    min: Math.min(...searchMetrics),
    max: Math.max(...searchMetrics),
    samples: searchMetrics.length
  } : {
    average: 0,
    min: 0,
    max: 0,
    samples: 0
  };

  return {
    searchLatency,
    memoryUsage: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss
    },
    uptime: process.uptime(),
    requestCount,
    lastUpdated: new Date()
  };
}

export function validateDatabaseIntegrity(): IntegrityReport {
  const exerciseData = getExerciseData();
  const errors: Array<{ exerciseId: string; field: string; issue: string }> = [];
  const duplicateIds: string[] = [];
  const missingFields: Array<{ exerciseId: string; fields: string[] }> = [];

  // Track IDs to find duplicates
  const idCounts = new Map<string, number>();

  // Required fields for validation
  const requiredFields: (keyof Exercise)[] = ['id', 'name', 'equipment', 'category', 'primaryMuscles'];

  exerciseData.forEach((exercise, index) => {
    // Check for duplicate IDs
    const currentCount = idCounts.get(exercise.id) || 0;
    idCounts.set(exercise.id, currentCount + 1);

    // Check for missing required fields
    const missing: string[] = [];
    requiredFields.forEach(field => {
      const value = exercise[field];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        missing.push(field);
      }
    });

    if (missing.length > 0) {
      missingFields.push({
        exerciseId: exercise.id || `index-${index}`,
        fields: missing
      });
    }

    // Validate specific field types
    if (exercise.id && typeof exercise.id !== 'string') {
      errors.push({
        exerciseId: exercise.id,
        field: 'id',
        issue: 'ID must be a string'
      });
    }

    if (exercise.name && typeof exercise.name !== 'string') {
      errors.push({
        exerciseId: exercise.id || `index-${index}`,
        field: 'name',
        issue: 'Name must be a string'
      });
    }

    if (exercise.primaryMuscles && !Array.isArray(exercise.primaryMuscles)) {
      errors.push({
        exerciseId: exercise.id || `index-${index}`,
        field: 'primaryMuscles',
        issue: 'Primary muscles must be an array'
      });
    }

    if (exercise.instructions && !Array.isArray(exercise.instructions)) {
      errors.push({
        exerciseId: exercise.id || `index-${index}`,
        field: 'instructions',
        issue: 'Instructions must be an array'
      });
    }
  });

  // Find duplicate IDs
  idCounts.forEach((count, id) => {
    if (count > 1) {
      duplicateIds.push(id);
    }
  });

  const summary = {
    duplicates: duplicateIds.length,
    missingFields: missingFields.length,
    invalidData: errors.length
  };

  const isValid = summary.duplicates === 0 && summary.missingFields === 0 && summary.invalidData === 0;

  return {
    isValid,
    totalChecked: exerciseData.length,
    errors,
    duplicateIds,
    missingFields,
    summary
  };
}

export function resetPerformanceMetrics(): void {
  searchMetrics = [];
  requestCount = 0;
  startTime = Date.now();
}
