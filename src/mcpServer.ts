import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ExerciseService } from './exerciseService.js';
import {
  SearchParamsSchema,
  GetExerciseByIdParams,
  FilterExercisesByEquipmentParams,
  GetExercisesByCategoryParams,
  FindExerciseAlternativesParams,
  ValidateExerciseKeysParams,
} from './types.js';
import {
  parsePaginationParams,
  sanitizeString,
  logInfo,
  logError,
} from './utils.js';

/**
 * MCP Server implementation for exercise data
 */
export class ExerciseMCPServer {
  private server: Server;
  private exerciseService: ExerciseService;
  private isConnected = false;

  constructor(exerciseService: ExerciseService) {
    this.exerciseService = exerciseService;
    this.server = new Server({
      name: 'exercise-mcp-server',
      version: '1.0.0',
    });

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_exercises',
            title: 'Search Exercises', // Add title as per spec
            description: 'Advanced multi-field search with relevance scoring for exercises',
            inputSchema: {
              type: 'object',
              properties: {
                equipment: {
                  type: 'string',
                  description: 'Filter by equipment type',
                },
                category: {
                  type: 'string',
                  description: 'Filter by exercise category',
                },
                primaryMuscles: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by primary muscles targeted',
                },
                secondaryMuscles: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by secondary muscles targeted',
                },
                bodyPart: {
                  type: 'string',
                  description: 'Filter by body part targeted',
                },
                appleCategory: {
                  type: 'string',
                  description: 'Filter by Apple HealthKit category',
                },
                query: {
                  type: 'string',
                  description: 'Text search across exercise names and instructions',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (1-100)',
                  minimum: 1,
                  maximum: 100,
                  default: 20,
                },
                offset: {
                  type: 'number',
                  description: 'Number of results to skip for pagination',
                  minimum: 0,
                  default: 0,
                },
              },
            },
            // Add output schema for better validation
            outputSchema: {
              type: 'object',
              properties: {
                exercises: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      equipment: { type: 'string' },
                      category: { type: 'string' },
                      relevanceScore: { type: 'number' }
                    }
                  }
                },
                total: { type: 'number' },
                limit: { type: 'number' },
                offset: { type: 'number' }
              },
              required: ['exercises', 'total', 'limit', 'offset']
            }
          },
          {
            name: 'get_exercise_by_id',
            title: 'Get Exercise by ID',
            description: 'Retrieve specific exercise by UUID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Exercise UUID',
                },
              },
              required: ['id'],
            },
            outputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                equipment: { type: 'string' },
                category: { type: 'string' },
                appleCategory: { type: 'string' },
                bodyPart: { type: 'string' },
                primaryMuscles: { type: 'array', items: { type: 'string' } },
                secondaryMuscles: { type: 'array', items: { type: 'string' } },
                instructions: { type: 'array', items: { type: 'string' } },
                images: { type: 'array', items: { type: 'string' } }
              },
              required: ['id', 'name', 'equipment', 'category']
            }
          },
          {
            name: 'filter_exercises_by_equipment',
            title: 'Filter by Equipment',
            description: 'Equipment-based filtering of exercises',
            inputSchema: {
              type: 'object',
              properties: {
                equipment: {
                  type: 'string',
                  description: 'Equipment type to filter by',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results',
                  minimum: 1,
                  maximum: 100,
                  default: 20,
                },
                offset: {
                  type: 'number',
                  description: 'Number of results to skip',
                  minimum: 0,
                  default: 0,
                },
              },
              required: ['equipment'],
            },
            outputSchema: {
              type: 'object',
              properties: {
                exercises: { type: 'array' },
                total: { type: 'number' },
                equipment: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' }
              },
              required: ['exercises', 'total', 'equipment', 'limit', 'offset']
            }
          },
          {
            name: 'get_exercises_by_category',
            title: 'Get Exercises by Category',
            description: 'Category-based filtering of exercises',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'Category to filter by',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results',
                  minimum: 1,
                  maximum: 100,
                  default: 20,
                },
                offset: {
                  type: 'number',
                  description: 'Number of results to skip',
                  minimum: 0,
                  default: 0,
                },
              },
              required: ['category'],
            },
            outputSchema: {
              type: 'object',
              properties: {
                exercises: { type: 'array' },
                total: { type: 'number' },
                category: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' }
              },
              required: ['exercises', 'total', 'category', 'limit', 'offset']
            }
          },
          {
            name: 'find_exercise_alternatives',
            title: 'Find Exercise Alternatives',
            description: 'Find similar exercises targeting same muscles',
            inputSchema: {
              type: 'object',
              properties: {
                exerciseId: {
                  type: 'string',
                  description: 'ID of the exercise to find alternatives for',
                },
                targetMuscles: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific muscles to target (optional)',
                },
                equipment: {
                  type: 'string',
                  description: 'Preferred equipment type (optional)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of alternatives',
                  minimum: 1,
                  maximum: 50,
                  default: 10,
                },
              },
              required: ['exerciseId'],
            },
            outputSchema: {
              type: 'object',
              properties: {
                originalExercise: { type: 'object' },
                alternatives: { type: 'array' },
                count: { type: 'number' },
                criteria: { type: 'object' }
              },
              required: ['originalExercise', 'alternatives', 'count']
            }
          },
          {
            name: 'validate_exercise_keys',
            title: 'Validate Exercise Keys',
            description: 'Validate that exercise IDs exist in the database',
            inputSchema: {
              type: 'object',
              properties: {
                exerciseIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of exercise IDs to validate',
                },
              },
              required: ['exerciseIds'],
            },
            outputSchema: {
              type: 'object',
              properties: {
                valid: { type: 'array', items: { type: 'string' } },
                invalid: { type: 'array', items: { type: 'string' } },
                totalChecked: { type: 'number' },
                validCount: { type: 'number' },
                invalidCount: { type: 'number' }
              },
              required: ['valid', 'invalid', 'totalChecked', 'validCount', 'invalidCount']
            }
          },
        ],
      };
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'exercise://all',
            mimeType: 'application/json',
            name: 'All Exercises',
            description: 'Paginated list of all exercises in the database',
          },
          {
            uri: 'exercise://categories',
            mimeType: 'application/json',
            name: 'Exercise Categories',
            description: 'List of all unique exercise categories',
          },
          {
            uri: 'exercise://equipment-types',
            mimeType: 'application/json',
            name: 'Equipment Types',
            description: 'List of all equipment types used in exercises',
          },
          {
            uri: 'exercise://muscle-groups',
            mimeType: 'application/json',
            name: 'Muscle Groups',
            description: 'List of all primary and secondary muscle groups',
          },
          {
            uri: 'exercise://body-parts',
            mimeType: 'application/json',
            name: 'Body Parts',
            description: 'List of all targeted body parts',
          },
          {
            uri: 'exercise://apple-categories',
            mimeType: 'application/json',
            name: 'Apple HealthKit Categories',
            description: 'List of all Apple HealthKit exercise categories',
          },
          {
            uri: 'exercise://stats',
            mimeType: 'application/json',
            name: 'Database Statistics',
            description: 'Statistics about the exercise database',
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'search_exercises':
            return await this.handleSearchExercises(args);
          case 'get_exercise_by_id':
            return await this.handleGetExerciseById(args);
          case 'filter_exercises_by_equipment':
            return await this.handleFilterExercisesByEquipment(args);
          case 'get_exercises_by_category':
            return await this.handleGetExercisesByCategory(args);
          case 'find_exercise_alternatives':
            return await this.handleFindExerciseAlternatives(args);
          case 'validate_exercise_keys':
            return await this.handleValidateExerciseKeys(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logError('Tool call failed', error, {
          tool: request.params.name,
          args: request.params.arguments
        });

        // Let the MCP framework handle errors properly instead of wrapping in content
        throw error;
      }
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'exercise://all':
            return await this.handleGetAllExercises(request.params);
          case 'exercise://categories':
            return await this.handleGetCategories();
          case 'exercise://equipment-types':
            return await this.handleGetEquipmentTypes();
          case 'exercise://muscle-groups':
            return await this.handleGetMuscleGroups();
          case 'exercise://body-parts':
            return await this.handleGetBodyParts();
          case 'exercise://apple-categories':
            return await this.handleGetAppleCategories();
          case 'exercise://stats':
            return await this.handleGetStats();
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        logError('Resource read failed', error, { uri });

        // Let the MCP framework handle errors properly instead of wrapping in content
        throw error;
      }
    });
  }

  // Tool handlers
  private async handleSearchExercises(args: any) {
    const validatedParams = SearchParamsSchema.parse(args);
    const result = this.exerciseService.searchExercises(validatedParams);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      // Provide structured content for better client integration
      structuredContent: result,
    };
  }

  private async handleGetExerciseById(args: any) {
    if (!args.id || typeof args.id !== 'string') {
      throw new Error('Exercise ID is required and must be a string');
    }

    const { id } = args as GetExerciseByIdParams;
    const exercise = this.exerciseService.getExerciseById(sanitizeString(id));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(exercise, null, 2),
        },
      ],
      structuredContent: exercise,
    };
  }

  private async handleFilterExercisesByEquipment(args: any) {
    if (!args.equipment || typeof args.equipment !== 'string') {
      throw new Error('Equipment parameter is required and must be a string');
    }

    const { equipment, limit = 20, offset = 0 } = args as FilterExercisesByEquipmentParams;
    const result = this.exerciseService.filterExercisesByEquipment(
      sanitizeString(equipment),
      limit,
      offset
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleGetExercisesByCategory(args: any) {
    if (!args.category || typeof args.category !== 'string') {
      throw new Error('Category parameter is required and must be a string');
    }

    const { category, limit = 20, offset = 0 } = args as GetExercisesByCategoryParams;
    const result = this.exerciseService.getExercisesByCategory(
      sanitizeString(category),
      limit,
      offset
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleFindExerciseAlternatives(args: any) {
    if (!args.exerciseId || typeof args.exerciseId !== 'string') {
      throw new Error('Exercise ID is required and must be a string');
    }

    const {
      exerciseId,
      targetMuscles,
      equipment,
      limit = 10
    } = args as FindExerciseAlternativesParams;

    const alternatives = this.exerciseService.findExerciseAlternatives(
      sanitizeString(exerciseId),
      targetMuscles?.map(m => sanitizeString(m)),
      equipment ? sanitizeString(equipment) : undefined,
      limit
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(alternatives, null, 2),
        },
      ],
    };
  }

  private async handleValidateExerciseKeys(args: any) {
    if (!args.exerciseIds || !Array.isArray(args.exerciseIds)) {
      throw new Error('Exercise IDs parameter is required and must be an array');
    }

    const { exerciseIds } = args as ValidateExerciseKeysParams;
    const result = this.exerciseService.validateExerciseKeys(
      exerciseIds.map(id => sanitizeString(id))
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
    };
  }

  // Resource handlers
  private async handleGetAllExercises(params: any) {
    const { limit, offset } = parsePaginationParams(
      params.limit?.toString(),
      params.offset?.toString()
    );

    const result = this.exerciseService.getAllExercises(limit, offset);

    return {
      contents: [
        {
          uri: 'exercise://all',
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleGetCategories() {
    const categories = this.exerciseService.getCategories();

    return {
      contents: [
        {
          uri: 'exercise://categories',
          mimeType: 'application/json',
          text: JSON.stringify(categories, null, 2),
        },
      ],
    };
  }

  private async handleGetEquipmentTypes() {
    const equipmentTypes = this.exerciseService.getEquipmentTypes();

    return {
      contents: [
        {
          uri: 'exercise://equipment-types',
          mimeType: 'application/json',
          text: JSON.stringify(equipmentTypes, null, 2),
        },
      ],
    };
  }

  private async handleGetMuscleGroups() {
    const muscleGroups = this.exerciseService.getMuscleGroups();

    return {
      contents: [
        {
          uri: 'exercise://muscle-groups',
          mimeType: 'application/json',
          text: JSON.stringify(muscleGroups, null, 2),
        },
      ],
    };
  }

  private async handleGetBodyParts() {
    const bodyParts = this.exerciseService.getBodyParts();

    return {
      contents: [
        {
          uri: 'exercise://body-parts',
          mimeType: 'application/json',
          text: JSON.stringify(bodyParts, null, 2),
        },
      ],
    };
  }

  private async handleGetAppleCategories() {
    const appleCategories = this.exerciseService.getAppleCategories();

    return {
      contents: [
        {
          uri: 'exercise://apple-categories',
          mimeType: 'application/json',
          text: JSON.stringify(appleCategories, null, 2),
        },
      ],
    };
  }

  private async handleGetStats() {
    const stats = this.exerciseService.getStats();

    return {
      contents: [
        {
          uri: 'exercise://stats',
          mimeType: 'application/json',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  /**
   * Connect transport to the server
   */
  async connect(transport: any): Promise<void> {
    try {
      await this.server.connect(transport);
      this.isConnected = true;
      logInfo('MCP Server connected successfully');
    } catch (error) {
      logError('Failed to connect MCP server', error);
      throw error;
    }
  }

  /**
   * Close server connection
   */
  async close(): Promise<void> {
    try {
      await this.server.close();
      this.isConnected = false;
      logInfo('MCP Server closed');
    } catch (error) {
      logError('Failed to close MCP server', error);
      throw error;
    }
  }

  /**
   * Check if server is connected
   */
  isServerConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get the underlying server instance
   */
  getServer(): Server {
    return this.server;
  }
}
