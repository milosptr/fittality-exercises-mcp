export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  category: string;
  appleCategory: string;
  bodyPart: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
  tags: string[];
}

export interface SearchCriteria {
  equipment?: string;
  category?: string;
  primaryMuscles?: string[];
  tags?: string[];
  query?: string;
  limit?: number;
}

export interface ValidationResult {
  valid: string[];
  invalid: string[];
}

export interface DatabaseHealth {
  status: "healthy" | "unhealthy" | "degraded";
  isLoaded: boolean;
  loadTime?: Date;
  errors: string[];
  warnings: string[];
}

export interface DatabaseStats {
  totalExercises: number;
  categories: {
    count: number;
    list: string[];
  };
  equipment: {
    count: number;
    list: string[];
  };
  muscleGroups: {
    count: number;
    primary: string[];
    secondary: string[];
  };
  bodyParts: {
    count: number;
    list: string[];
  };
  averageInstructionSteps: number;
  averageImageCount: number;
}

export interface PerformanceMetrics {
  searchLatency: {
    average: number;
    min: number;
    max: number;
    samples: number;
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  uptime: number;
  requestCount: number;
  lastUpdated: Date;
}

export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

export interface IntegrityReport {
  isValid: boolean;
  totalChecked: number;
  errors: Array<{
    exerciseId: string;
    field: string;
    issue: string;
  }>;
  duplicateIds: string[];
  missingFields: Array<{
    exerciseId: string;
    fields: string[];
  }>;
  summary: {
    duplicates: number;
    missingFields: number;
    invalidData: number;
  };
}
