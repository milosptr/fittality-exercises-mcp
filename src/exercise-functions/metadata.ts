import { getExerciseData } from './loader.js';

export function getExerciseCategories(): string[] {
  const exerciseData = getExerciseData();
  const categories = new Set<string>();
  exerciseData.forEach(exercise => {
    categories.add(exercise.category);
    categories.add(exercise.appleCategory);
  });
  return Array.from(categories).sort();
}

export function getEquipmentTypes(): string[] {
  const exerciseData = getExerciseData();
  const equipment = new Set<string>();
  exerciseData.forEach(exercise => {
    equipment.add(exercise.equipment);
  });
  return Array.from(equipment).sort();
}

export function getMuscleGroups(): string[] {
  const exerciseData = getExerciseData();
  const muscles = new Set<string>();
  exerciseData.forEach(exercise => {
    exercise.primaryMuscles.forEach(muscle => muscles.add(muscle));
    exercise.secondaryMuscles.forEach(muscle => muscles.add(muscle));
  });
  return Array.from(muscles).sort();
}

export function getBodyParts(): string[] {
  const exerciseData = getExerciseData();
  const bodyParts = new Set<string>();
  exerciseData.forEach(exercise => {
    bodyParts.add(exercise.bodyPart);
  });
  return Array.from(bodyParts).sort();
}
