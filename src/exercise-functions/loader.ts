import * as fs from 'fs/promises';
import * as path from 'path';
import type { Exercise } from '../types.js';
import { setLoadTime } from './health.js';

let exerciseData: Exercise[] = [];

export async function loadExercises(): Promise<void> {
  const dataPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'exercises.json');
  const data = await fs.readFile(dataPath, 'utf8');
  const parsed = JSON.parse(data);
  exerciseData = parsed.exercises || parsed;

  // Record successful load time for health monitoring
  setLoadTime(new Date());
}

export function getExerciseData(): Exercise[] {
  return exerciseData;
}

export function getExerciseById(id: string): Exercise | undefined {
  return exerciseData.find(exercise => exercise.id === id);
}
