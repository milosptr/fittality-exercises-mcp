import type { Exercise } from '../types.js';
import { getExerciseData, getExerciseById } from './loader.js';

export function findAlternatives(exerciseId: string, limit: number = 5): Exercise[] {
  const targetExercise = getExerciseById(exerciseId);
  if (!targetExercise) return [];

  const exerciseData = getExerciseData();

  // Find exercises that target similar primary muscles
  const alternatives = exerciseData.filter(exercise => {
    if (exercise.id === exerciseId) return false;

    // Check if any primary muscles overlap
    return exercise.primaryMuscles.some(muscle =>
      targetExercise.primaryMuscles.some(targetMuscle =>
        muscle.toLowerCase() === targetMuscle.toLowerCase()
      )
    );
  });

  // Sort by relevance (more muscle overlap = higher relevance)
  alternatives.sort((a, b) => {
    const aOverlap = a.primaryMuscles.filter(muscle =>
      targetExercise.primaryMuscles.some(targetMuscle =>
        muscle.toLowerCase() === targetMuscle.toLowerCase()
      )
    ).length;

    const bOverlap = b.primaryMuscles.filter(muscle =>
      targetExercise.primaryMuscles.some(targetMuscle =>
        muscle.toLowerCase() === targetMuscle.toLowerCase()
      )
    ).length;

    return bOverlap - aOverlap;
  });

  return alternatives.slice(0, limit);
}

export function findByMuscleGroup(primaryMuscles: string[], limit: number = 10): Exercise[] {
  const exerciseData = getExerciseData();

  return exerciseData.filter(exercise =>
    exercise.primaryMuscles.some(muscle =>
      primaryMuscles.some(targetMuscle =>
        muscle.toLowerCase().includes(targetMuscle.toLowerCase())
      )
    )
  ).slice(0, limit);
}
