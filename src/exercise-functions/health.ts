import { getExerciseData } from './loader.js';
import { getExerciseCategories, getEquipmentTypes, getMuscleGroups, getBodyParts } from './metadata.js';
import type { DatabaseHealth, DatabaseStats, SystemInfo } from '../types.js';

let loadTime: Date | undefined;
let isDataLoaded = false;

export function setLoadTime(time: Date): void {
  loadTime = time;
  isDataLoaded = true;
}

export function getDatabaseHealth(): DatabaseHealth {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const exerciseData = getExerciseData();

    if (exerciseData.length === 0) {
      errors.push("No exercises loaded in database");
    }

    if (!isDataLoaded) {
      errors.push("Database has not been properly initialized");
    }

    // Check for basic data integrity
    const emptyExercises = exerciseData.filter(ex => !ex.name || !ex.id);
    if (emptyExercises.length > 0) {
      warnings.push(`${emptyExercises.length} exercises have missing names or IDs`);
    }

    const status = errors.length > 0 ? "unhealthy" :
                  warnings.length > 0 ? "degraded" : "healthy";

    return {
      status,
      isLoaded: isDataLoaded,
      loadTime,
      errors,
      warnings
    };
  } catch (error) {
    return {
      status: "unhealthy",
      isLoaded: false,
      errors: [`Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: []
    };
  }
}

export function getDatabaseStats(): DatabaseStats {
  const exerciseData = getExerciseData();
  const categories = getExerciseCategories();
  const equipment = getEquipmentTypes();
  const muscleGroups = getMuscleGroups();
  const bodyParts = getBodyParts();

  // Calculate primary vs secondary muscles
  const primaryMuscles = new Set<string>();
  const secondaryMuscles = new Set<string>();

  exerciseData.forEach(exercise => {
    exercise.primaryMuscles.forEach(muscle => primaryMuscles.add(muscle));
    exercise.secondaryMuscles.forEach(muscle => secondaryMuscles.add(muscle));
  });

  // Calculate averages
  const totalInstructions = exerciseData.reduce((sum, ex) => sum + ex.instructions.length, 0);
  const totalImages = exerciseData.reduce((sum, ex) => sum + ex.images.length, 0);

  return {
    totalExercises: exerciseData.length,
    categories: {
      count: categories.length,
      list: categories
    },
    equipment: {
      count: equipment.length,
      list: equipment
    },
    muscleGroups: {
      count: muscleGroups.length,
      primary: Array.from(primaryMuscles).sort(),
      secondary: Array.from(secondaryMuscles).sort()
    },
    bodyParts: {
      count: bodyParts.length,
      list: bodyParts
    },
    averageInstructionSteps: exerciseData.length > 0 ? totalInstructions / exerciseData.length : 0,
    averageImageCount: exerciseData.length > 0 ? totalImages / exerciseData.length : 0
  };
}

export function getSystemInfo(): SystemInfo {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsage,
    cpuUsage
  };
}
