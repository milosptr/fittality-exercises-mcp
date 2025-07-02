import type { ValidationResult } from '../types.js';
import { getExerciseData } from './loader.js';

export function validateExerciseIds(ids: string[]): ValidationResult {
  const exerciseData = getExerciseData();
  const valid: string[] = [];
  const invalid: string[] = [];

  ids.forEach(id => {
    if (exerciseData.some(exercise => exercise.id === id)) {
      valid.push(id);
    } else {
      invalid.push(id);
    }
  });

  return { valid, invalid };
}

export function exerciseExists(id: string): boolean {
  const exerciseData = getExerciseData();
  return exerciseData.some(exercise => exercise.id === id);
}
