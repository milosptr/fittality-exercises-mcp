import { z } from 'zod';

// Exercise data structure validation schemas
export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  equipment: z.string(),
  category: z.string(),
  appleCategory: z.string(),
  bodyPart: z.string(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  instructions: z.array(z.string()),
  images: z.array(z.string()),
});

export const SearchParamsSchema = z.object({
  equipment: z.string().optional(),
  category: z.string().optional(),
  primaryMuscles: z.array(z.string()).optional(),
  secondaryMuscles: z.array(z.string()).optional(),
  bodyPart: z.string().optional(),
  appleCategory: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// OAuth schemas
export const ClientRegistrationSchema = z.object({
  client_name: z.string(),
  client_uri: z.string().url().optional(),
  scope: z.string().default('mcp:read mcp:write'),
  redirect_uris: z.array(z.string().url()).optional(),
});

export const TokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'client_credentials']),
  client_id: z.string(),
  client_secret: z.string().optional(),
  code: z.string().optional(),
  scope: z.string().optional(),
});

// TypeScript interfaces
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
}

export interface SearchParams {
  equipment?: string;
  category?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  bodyPart?: string;
  appleCategory?: string;
  query?: string;
  limit: number;
  offset: number;
}

export interface SearchResult {
  exercises: Exercise[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface ExerciseStats {
  totalExercises: number;
  categories: number;
  equipmentTypes: number;
  primaryMuscles: number;
  secondaryMuscles: number;
  bodyParts: number;
  appleCategories: number;
}

export interface ClientRegistration {
  client_name: string;
  client_uri?: string;
  scope: string;
  redirect_uris?: string[];
}

export interface ClientRegistrationResponse {
  client_id: string;
  client_secret: string;
  registration_access_token?: string;
  client_id_issued_at: number;
  scope: string;
}

export interface TokenRequest {
  grant_type: 'authorization_code' | 'client_credentials';
  client_id: string;
  client_secret?: string;
  code?: string;
  scope?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface OAuthDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported?: string[];
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    mcp: string;
    exercises: string;
    database: {
      totalExercises: number;
      categoriesLoaded: number;
      lastUpdated: string;
    };
  };
  endpoints: {
    mcp_sse: string;
    oauth_discovery: string;
    registration: string;
    api_schema?: string;
    api_info?: string;
  };
  capabilities?: {
    tools: number;
    resources: number;
    prompts: number;
    features: string[];
  };
  api?: {
    status: string;
    version: string;
    endpoints_available: number;
    authentication: string;
  };
}

export interface Config {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  jwtSecret: string;
  exerciseDataPath: string;
  oauthClientIdPrefix: string;
  oauthTokenExpiry: number;
  logLevel: string;
  // API Configuration
  apiSecretKey: string;
  apiRateLimitWindow: number;
  apiRateLimitMax: number;
}

// MCP Tool parameter types
export interface GetExerciseByIdParams {
  id: string;
}

export interface FilterExercisesByEquipmentParams {
  equipment: string;
  limit?: number;
  offset?: number;
}

export interface GetExercisesByCategoryParams {
  category: string;
  limit?: number;
  offset?: number;
}

export interface FindExerciseAlternativesParams {
  exerciseId: string;
  targetMuscles?: string[];
  equipment?: string;
  limit?: number;
}

export interface ValidateExerciseKeysParams {
  exerciseIds: string[];
}

export interface ValidateExerciseKeysResult {
  valid: string[];
  invalid: string[];
}

// API Response Types for Claude API tool calls
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: string;
    execution_time_ms: number;
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface ApiToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ApiSchemaResponse {
  tools: ApiToolDefinition[];
  version: string;
  server_info: {
    name: string;
    base_url: string;
    description: string;
  };
}

export interface ApiInfoResponse {
  name: string;
  version: string;
  description: string;
  endpoints: {
    schema: string;
    tools: string[];
  };
  authentication: {
    type: string;
    required: boolean;
  };
  statistics: {
    total_exercises: number;
    categories: number;
    equipment_types: number;
  };
}

// Error types
export class ExerciseNotFoundError extends Error {
  constructor(id: string) {
    super(`Exercise not found: ${id}`);
    this.name = 'ExerciseNotFoundError';
  }
}

export class InvalidSearchParamsError extends Error {
  constructor(message: string) {
    super(`Invalid search parameters: ${message}`);
    this.name = 'InvalidSearchParamsError';
  }
}

export class DataLoadError extends Error {
  constructor(path: string, cause?: unknown) {
    super(`Failed to load exercise data from ${path}: ${cause}`);
    this.name = 'DataLoadError';
  }
}
