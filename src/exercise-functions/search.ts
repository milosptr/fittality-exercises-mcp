import type { Exercise, SearchCriteria } from '../types.js';
import { getExerciseData } from './loader.js';
import { trackSearchTime, incrementRequestCount } from './performance.js';

export async function searchExercises(criteria: SearchCriteria): Promise<Exercise[]> {
  const startTime = performance.now();
  incrementRequestCount();

  const exerciseData = getExerciseData();
  let results = [...exerciseData];

  // Filter by equipment
  if (criteria.equipment) {
    results = results.filter(exercise =>
      exercise.equipment.toLowerCase().includes(criteria.equipment!.toLowerCase())
    );
  }

  // Filter by category
  if (criteria.category) {
    results = results.filter(exercise =>
      exercise.category.toLowerCase().includes(criteria.category!.toLowerCase()) ||
      exercise.appleCategory.toLowerCase().includes(criteria.category!.toLowerCase())
    );
  }

  // Filter by primary muscles
  if (criteria.primaryMuscles && criteria.primaryMuscles.length > 0) {
    results = results.filter(exercise =>
      criteria.primaryMuscles!.some(muscle =>
        exercise.primaryMuscles.some(primaryMuscle =>
          primaryMuscle.toLowerCase().includes(muscle.toLowerCase())
        )
      )
    );
  }

  // Filter by tags
  if (criteria.tags && criteria.tags.length > 0) {
    results = results.filter(exercise =>
      criteria.tags!.every(tag => exercise.tags?.includes(tag))
    );
  }

  // General text search
  if (criteria.query) {
    const searchTerm = criteria.query.toLowerCase();
    results = results.filter(exercise =>
      exercise.name.toLowerCase().includes(searchTerm) ||
      exercise.equipment.toLowerCase().includes(searchTerm) ||
      exercise.category.toLowerCase().includes(searchTerm) ||
      exercise.bodyPart.toLowerCase().includes(searchTerm) ||
      exercise.primaryMuscles.some(muscle => muscle.toLowerCase().includes(searchTerm)) ||
      exercise.secondaryMuscles.some(muscle => muscle.toLowerCase().includes(searchTerm)) ||
      exercise.instructions.some(instruction => instruction.toLowerCase().includes(searchTerm))
    );
  }

  // Apply limit
  if (criteria.limit && criteria.limit > 0) {
    results = results.slice(0, criteria.limit);
  }

  // Track search performance
  const endTime = performance.now();
  trackSearchTime(endTime - startTime);

  return results;
}

export function filterByEquipment(equipment: string): Exercise[] {
  const exerciseData = getExerciseData();
  return exerciseData.filter(exercise =>
    exercise.equipment.toLowerCase().includes(equipment.toLowerCase())
  );
}

export function filterByCategory(category: string): Exercise[] {
  const exerciseData = getExerciseData();
  return exerciseData.filter(exercise =>
    exercise.category.toLowerCase().includes(category.toLowerCase()) ||
    exercise.appleCategory.toLowerCase().includes(category.toLowerCase())
  );
}
