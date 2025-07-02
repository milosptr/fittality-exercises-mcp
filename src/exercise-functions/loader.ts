import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Exercise } from '../types.js';
import { setLoadTime } from './health.js';

let exerciseData: Exercise[] = [];

export async function loadExercises(): Promise<void> {
  // Get the directory of the current module file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Path relative to the compiled file location (dist/exercise-functions/loader.js)
  // We need to go up two levels: dist/exercise-functions -> dist -> project root
  const projectRoot = path.join(__dirname, '../..');
  const dataPath = process.env.DATABASE_PATH || path.join(projectRoot, 'data', 'exercises.json');

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
