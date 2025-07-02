import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ExerciseService } from './exerciseService.js';
import {
  SearchParamsSchema,
  GetExerciseByIdParams,
  FilterExercisesByEquipmentParams,
  GetExercisesByCategoryParams,
  FindExerciseAlternativesParams,
  ValidateExerciseKeysParams,
  ApiResponse,
  ApiToolDefinition,
  ApiSchemaResponse,
  ApiInfoResponse,
  Config,
} from './types.js';
import {
  parsePaginationParams,
  sanitizeString,
  logInfo,
  logError,
  measurePerformance,
  createErrorContext,
  createMCPLogNotification,
  getCurrentTimestamp,
} from './utils.js';
import type { Request, Response, NextFunction } from 'express';

/**
 * MCP Server implementation for exercise data
 */
export class ExerciseMCPServer {
  private server: Server;
  private exerciseService: ExerciseService;
  private config: Config;
  private isConnected = false;

  constructor(exerciseService: ExerciseService, config: Config) {
    this.exerciseService = exerciseService;
    this.config = config;
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

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'create-workout-plan',
            title: 'Create Workout Plan',
            description: 'Generate a personalized workout plan based on goals, equipment, and experience level',
            arguments: [
              {
                name: 'goals',
                description: 'Fitness goals (e.g., strength, cardio, flexibility, weight loss, muscle building)',
                required: true,
              },
              {
                name: 'equipment',
                description: 'Available equipment (e.g., dumbbells, barbell, resistance bands, bodyweight only)',
                required: false,
              },
              {
                name: 'experience',
                description: 'Experience level: beginner, intermediate, or advanced',
                required: true,
              },
              {
                name: 'duration',
                description: 'Workout duration in minutes (e.g., 30, 45, 60)',
                required: false,
              },
              {
                name: 'frequency',
                description: 'Workouts per week (e.g., 3, 4, 5)',
                required: false,
              },
            ],
          },
          {
            name: 'exercise-form-guide',
            title: 'Exercise Form Guide',
            description: 'Get detailed form instructions and tips for proper exercise execution',
            arguments: [
              {
                name: 'exercise_name',
                description: 'Name of the exercise to get form guidance for',
                required: true,
              },
              {
                name: 'focus_area',
                description: 'Specific aspect to focus on (e.g., common mistakes, beginner tips, advanced variations)',
                required: false,
              },
            ],
          },
          {
            name: 'muscle-group-workout',
            title: 'Muscle Group Workout',
            description: 'Create a focused workout targeting specific muscle groups',
            arguments: [
              {
                name: 'target_muscles',
                description: 'Primary muscle groups to target (e.g., chest, back, legs, shoulders)',
                required: true,
              },
              {
                name: 'equipment',
                description: 'Available equipment',
                required: false,
              },
              {
                name: 'intensity',
                description: 'Workout intensity: low, moderate, or high',
                required: false,
              },
            ],
          },
          {
            name: 'exercise-alternatives',
            title: 'Exercise Alternatives',
            description: 'Find alternative exercises when you can\'t perform a specific exercise',
            arguments: [
              {
                name: 'original_exercise',
                description: 'The exercise you want alternatives for',
                required: true,
              },
              {
                name: 'reason',
                description: 'Reason for needing alternatives (e.g., injury, equipment, difficulty)',
                required: false,
              },
              {
                name: 'available_equipment',
                description: 'Equipment you have available',
                required: false,
              },
            ],
          },
          {
            name: 'progressive-overload',
            title: 'Progressive Overload Plan',
            description: 'Create a plan for progressively increasing exercise difficulty and intensity',
            arguments: [
              {
                name: 'current_exercises',
                description: 'Current exercises in your routine',
                required: true,
              },
              {
                name: 'current_level',
                description: 'Current performance level (sets, reps, weight)',
                required: false,
              },
              {
                name: 'timeline',
                description: 'Timeline for progression (e.g., 4 weeks, 8 weeks, 12 weeks)',
                required: false,
              },
            ],
          },
        ],
      };
    });

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'create-workout-plan':
          return await this.handleCreateWorkoutPlanPrompt(args);
        case 'exercise-form-guide':
          return await this.handleExerciseFormGuidePrompt(args);
        case 'muscle-group-workout':
          return await this.handleMuscleGroupWorkoutPrompt(args);
        case 'exercise-alternatives':
          return await this.handleExerciseAlternativesPrompt(args);
        case 'progressive-overload':
          return await this.handleProgressiveOverloadPrompt(args);
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = performance.now();
      const toolName = request.params.name;
      const toolArgs = request.params.arguments;

      try {
        const { name, arguments: args } = request.params;

        logInfo(`Tool execution started: ${name}`, { tool: name, argsCount: Object.keys(args || {}).length });

        const result = await measurePerformance(`tool_${name}`, async () => {
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
        });

        logInfo(`Tool execution completed: ${name}`, {
          tool: name,
          duration: `${(performance.now() - startTime).toFixed(2)}ms`,
          success: true
        });

        return result;
      } catch (error) {
        const errorContext = createErrorContext(`tool_${toolName}`, {
          tool: toolName,
          args: toolArgs,
          duration: `${(performance.now() - startTime).toFixed(2)}ms`
        });

        logError('Tool call failed', error, errorContext);

        // Enhanced error message with context
        const enhancedError = new Error(`Tool ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw enhancedError;
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

  // Prompt handlers
  private async handleCreateWorkoutPlanPrompt(args: any) {
    const goals = args?.goals || 'general fitness';
    const equipment = args?.equipment || 'bodyweight';
    const experience = args?.experience || 'beginner';
    const duration = args?.duration || '45';
    const frequency = args?.frequency || '3';

    // Get available exercises for the specified equipment
    const availableEquipment = this.exerciseService.getEquipmentTypes();
    const relevantEquipment = equipment === 'bodyweight' ? 'body weight' : equipment;

    return {
      description: 'Workout plan creation prompt with exercise context',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Create a comprehensive ${experience}-level workout plan with the following specifications:

Goals: ${goals}
Equipment: ${equipment}
Duration: ${duration} minutes per session
Frequency: ${frequency} times per week

Please use the available exercise database to:
1. Select appropriate exercises for the specified goals and equipment
2. Structure the workout with proper progression
3. Include sets, reps, and rest periods appropriate for ${experience} level
4. Provide warm-up and cool-down suggestions
5. Include safety tips and form cues

Available equipment types in database: ${availableEquipment.join(', ')}

Focus on exercises that use "${relevantEquipment}" equipment and target the muscles relevant to "${goals}".`
          }
        }
      ]
    };
  }

  private async handleExerciseFormGuidePrompt(args: any) {
    const exerciseName = args?.exercise_name;
    const focusArea = args?.focus_area || 'proper form and common mistakes';

    if (!exerciseName) {
      throw new Error('Exercise name is required for form guidance');
    }

    // Try to find the exercise in the database
    const searchResults = this.exerciseService.searchExercises({
      query: exerciseName,
      limit: 1,
      offset: 0
    });

    let exerciseContext = '';
    if (searchResults.exercises.length > 0) {
      const exercise = searchResults.exercises[0];
      exerciseContext = `
Exercise Details:
- Name: ${exercise.name}
- Equipment: ${exercise.equipment}
- Category: ${exercise.category}
- Primary Muscles: ${exercise.primaryMuscles?.join(', ') || 'N/A'}
- Secondary Muscles: ${exercise.secondaryMuscles?.join(', ') || 'N/A'}
- Instructions: ${exercise.instructions?.join(' ') || 'N/A'}`;
    }

    return {
      description: 'Exercise form guidance prompt with exercise database context',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Provide detailed form guidance for the exercise "${exerciseName}" focusing on: ${focusArea}

${exerciseContext}

Please provide:
1. Step-by-step execution instructions
2. Key form points to focus on
3. Common mistakes to avoid
4. Safety considerations
5. Modifications for different experience levels
6. Breathing patterns
7. When applicable, progression and regression options

If this exercise exists in the database above, use those specific instructions as a foundation and expand with additional form details.`
          }
        }
      ]
    };
  }

  private async handleMuscleGroupWorkoutPrompt(args: any) {
    const targetMuscles = args?.target_muscles;
    const equipment = args?.equipment || 'any';
    const intensity = args?.intensity || 'moderate';

    if (!targetMuscles) {
      throw new Error('Target muscles are required');
    }

    // Get available muscle groups and exercises
    const availableMuscleGroups = this.exerciseService.getMuscleGroups();
    const categories = this.exerciseService.getCategories();

    return {
      description: 'Muscle group workout creation prompt with exercise database context',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Create a focused workout targeting: ${targetMuscles}

Workout Parameters:
- Equipment: ${equipment}
- Intensity: ${intensity}
- Target Muscles: ${targetMuscles}

Available muscle groups in database: ${availableMuscleGroups.join(', ')}
Available exercise categories: ${categories.join(', ')}

Please:
1. Select 6-8 exercises from the database that target ${targetMuscles}
2. Organize exercises in a logical order (compound movements first, isolation last)
3. Provide sets, reps, and rest periods appropriate for ${intensity} intensity
4. Include exercise alternatives for different equipment options
5. Structure the workout with proper warm-up targeting the muscle groups
6. Suggest a cool-down routine with stretches for ${targetMuscles}

Focus on exercises that primarily or secondarily target: ${targetMuscles}`
          }
        }
      ]
    };
  }

  private async handleExerciseAlternativesPrompt(args: any) {
    const originalExercise = args?.original_exercise;
    const reason = args?.reason || 'general alternatives';
    const availableEquipment = args?.available_equipment || 'any';

    if (!originalExercise) {
      throw new Error('Original exercise is required');
    }

    // Search for the original exercise
    const searchResults = this.exerciseService.searchExercises({
      query: originalExercise,
      limit: 1,
      offset: 0
    });

    let exerciseInfo = '';
    let alternativeContext = '';

    if (searchResults.exercises.length > 0) {
      const exercise = searchResults.exercises[0];
      exerciseInfo = `
Original Exercise Found:
- Name: ${exercise.name}
- Equipment: ${exercise.equipment}
- Category: ${exercise.category}
- Primary Muscles: ${exercise.primaryMuscles?.join(', ') || 'N/A'}
- Secondary Muscles: ${exercise.secondaryMuscles?.join(', ') || 'N/A'}`;

      // Get actual alternatives using the service
      try {
        const alternatives = this.exerciseService.findExerciseAlternatives(
          exercise.id,
          exercise.primaryMuscles,
          availableEquipment === 'any' ? undefined : availableEquipment,
          5
        );

        if (alternatives.length > 0) {
          alternativeContext = `
Available Alternatives in Database:
${alternatives.map((alt: any) => `- ${alt.name} (${alt.equipment})`).join('\n')}`;
        }
      } catch (error) {
        // Continue without alternatives if there's an error
      }
    }

    return {
      description: 'Exercise alternatives prompt with database context',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Find alternative exercises for "${originalExercise}"

Reason for alternatives: ${reason}
Available equipment: ${availableEquipment}

${exerciseInfo}
${alternativeContext}

Please provide:
1. 3-5 alternative exercises that target the same muscle groups
2. Brief explanation of how each alternative compares to the original
3. Equipment requirements for each alternative
4. Difficulty level adjustments if needed
5. Specific modifications based on the reason: "${reason}"

Consider the available equipment (${availableEquipment}) when suggesting alternatives.`
          }
        }
      ]
    };
  }

  private async handleProgressiveOverloadPrompt(args: any) {
    const currentExercises = args?.current_exercises;
    const currentLevel = args?.current_level || 'not specified';
    const timeline = args?.timeline || '8 weeks';

    if (!currentExercises) {
      throw new Error('Current exercises are required');
    }

    // Get exercise categories and equipment types for context
    const categories = this.exerciseService.getCategories();
    const equipmentTypes = this.exerciseService.getEquipmentTypes();

    return {
      description: 'Progressive overload planning prompt with exercise database context',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Create a progressive overload plan for the following exercises: ${currentExercises}

Current Performance Level: ${currentLevel}
Timeline: ${timeline}

Available exercise categories: ${categories.join(', ')}
Available equipment types: ${equipmentTypes.join(', ')}

Please create a structured progression plan that includes:

1. **Week-by-week progression schedule** for ${timeline}
2. **Multiple progression methods**:
   - Volume progression (sets/reps)
   - Intensity progression (weight/resistance)
   - Density progression (reduced rest)
   - Exercise complexity progression

3. **Specific recommendations** for each exercise:
   - Starting parameters based on current level
   - Weekly adjustments
   - Alternative exercises for when current ones become too easy

4. **Plateau prevention strategies**:
   - Deload weeks
   - Exercise variations
   - Training method changes

5. **Progression tracking guidelines**:
   - Key metrics to monitor
   - Signs you're ready to progress
   - Warning signs to scale back

Use the exercise database to suggest specific variations and alternatives as part of the progression plan.`
          }
        }
      ]
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

  // ===== NEW: API HANDLERS FOR CLAUDE API TOOL CALLS =====

  /**
   * Create API response wrapper with timing and metadata
   */
  private createApiResponse<T>(
    data: T,
    startTime: number,
    total?: number,
    limit?: number,
    offset?: number
  ): ApiResponse<T> {
    const executionTime = performance.now() - startTime;

    return {
      success: true,
      data,
      metadata: {
        timestamp: getCurrentTimestamp(),
        execution_time_ms: Math.round(executionTime * 100) / 100,
        ...(total !== undefined && { total }),
        ...(limit !== undefined && { limit }),
        ...(offset !== undefined && { offset }),
      },
    };
  }

  /**
   * Create API error response
   */
  private createApiError(
    code: string,
    message: string,
    startTime: number,
    details?: any
  ): ApiResponse {
    const executionTime = performance.now() - startTime;

    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      metadata: {
        timestamp: getCurrentTimestamp(),
        execution_time_ms: Math.round(executionTime * 100) / 100,
      },
    };
  }

  /**
   * API Authentication middleware
   */
  apiAuthentication = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string ||
                   req.headers['authorization']?.toString().replace('Bearer ', '');

    // For development: accept any key or no key
    if (this.config.nodeEnv === 'development') {
      logInfo('API request in development mode', {
        endpoint: req.path,
        method: req.method,
        hasApiKey: !!apiKey
      });
      return next();
    }

    // For production: require valid API key
          if (!apiKey || apiKey !== this.config.apiSecretKey) {
        logError('API authentication failed', new Error('Invalid or missing API key'), {
          endpoint: req.path,
          method: req.method,
          providedKey: apiKey ? '***masked***' : 'none'
        });

        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Valid API key required. Provide key via x-api-key header or Authorization: Bearer <key>',
          },
          metadata: {
            timestamp: getCurrentTimestamp(),
            execution_time_ms: 0,
          },
        });
        return;
      }

    logInfo('API request authenticated', {
      endpoint: req.path,
      method: req.method
    });
    next();
  };

  /**
   * API request logging middleware
   */
  apiRequestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = performance.now();

    logInfo('API request started', {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
    });

    // Capture response on finish
    const originalSend = res.send;
    res.send = function(data) {
      const duration = performance.now() - startTime;
      logInfo('API request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration.toFixed(2)}ms`,
      });
      return originalSend.call(this, data);
    };

    next();
  };

  /**
   * API error handler middleware
   */
  apiErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
    const startTime = performance.now();

    logError('API request error', err, {
      method: req.method,
      path: req.path,
      body: req.body,
    });

    const errorResponse = this.createApiError(
      'INTERNAL_ERROR',
      'An internal server error occurred',
      startTime,
      this.config.nodeEnv === 'development' ? {
        error: err.message,
        stack: err.stack
      } : undefined
    );

    res.status(500).json(errorResponse);
  };

  // ===== API ENDPOINT HANDLERS =====

  /**
   * POST /api/v1/tools/search_exercises
   */
  handleApiSearchExercises = async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      const validatedParams = SearchParamsSchema.parse(req.body);
      const result = this.exerciseService.searchExercises(validatedParams);

      const response = this.createApiResponse(
        result,
        startTime,
        result.total,
        result.limit,
        result.offset
      );

      res.json(response);
    } catch (error) {
      const errorResponse = this.createApiError(
        'INVALID_INPUT',
        error instanceof Error ? error.message : 'Invalid search parameters',
        startTime,
        error
      );
      res.status(400).json(errorResponse);
    }
  };

  /**
   * POST /api/v1/tools/get_exercise_by_id
   */
  handleApiGetExerciseById = async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      const { id } = req.body;

              if (!id || typeof id !== 'string') {
          const errorResponse = this.createApiError(
            'INVALID_INPUT',
            'Exercise ID is required and must be a string',
            startTime
          );
          res.status(400).json(errorResponse);
          return;
        }

      const exercise = this.exerciseService.getExerciseById(sanitizeString(id));
      const response = this.createApiResponse(exercise, startTime);

      res.json(response);
    } catch (error) {
      const errorResponse = this.createApiError(
        'EXERCISE_NOT_FOUND',
        error instanceof Error ? error.message : 'Exercise not found',
        startTime
      );
      res.status(404).json(errorResponse);
    }
  };

  /**
   * POST /api/v1/tools/filter_exercises_by_equipment
   */
  handleApiFilterExercisesByEquipment = async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      const { equipment, limit = 20, offset = 0 } = req.body;

              if (!equipment || typeof equipment !== 'string') {
          const errorResponse = this.createApiError(
            'INVALID_INPUT',
            'Equipment parameter is required and must be a string',
            startTime
          );
          res.status(400).json(errorResponse);
          return;
        }

      const result = this.exerciseService.filterExercisesByEquipment(
        sanitizeString(equipment),
        limit,
        offset
      );

      const response = this.createApiResponse(
        result,
        startTime,
        result.total,
        result.limit,
        result.offset
      );

      res.json(response);
    } catch (error) {
      const errorResponse = this.createApiError(
        'INVALID_INPUT',
        error instanceof Error ? error.message : 'Invalid equipment filter parameters',
        startTime
      );
      res.status(400).json(errorResponse);
    }
  };

  /**
   * POST /api/v1/tools/get_exercises_by_category
   */
  handleApiGetExercisesByCategory = async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      const { category, limit = 20, offset = 0 } = req.body;

              if (!category || typeof category !== 'string') {
          const errorResponse = this.createApiError(
            'INVALID_INPUT',
            'Category parameter is required and must be a string',
            startTime
          );
          res.status(400).json(errorResponse);
          return;
        }

      const result = this.exerciseService.getExercisesByCategory(
        sanitizeString(category),
        limit,
        offset
      );

      const response = this.createApiResponse(
        result,
        startTime,
        result.total,
        result.limit,
        result.offset
      );

      res.json(response);
    } catch (error) {
      const errorResponse = this.createApiError(
        'INVALID_INPUT',
        error instanceof Error ? error.message : 'Invalid category filter parameters',
        startTime
      );
      res.status(400).json(errorResponse);
    }
  };

  /**
   * POST /api/v1/tools/find_exercise_alternatives
   */
  handleApiFindExerciseAlternatives = async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      const { exerciseId, targetMuscles, equipment, limit = 10 } = req.body;

              if (!exerciseId || typeof exerciseId !== 'string') {
          const errorResponse = this.createApiError(
            'INVALID_INPUT',
            'Exercise ID is required and must be a string',
            startTime
          );
          res.status(400).json(errorResponse);
          return;
        }

      const alternatives = this.exerciseService.findExerciseAlternatives(
        sanitizeString(exerciseId),
        targetMuscles?.map((m: string) => sanitizeString(m)),
        equipment ? sanitizeString(equipment) : undefined,
        limit
      );

      const response = this.createApiResponse(alternatives, startTime);

      res.json(response);
    } catch (error) {
      const errorResponse = this.createApiError(
        'EXERCISE_NOT_FOUND',
        error instanceof Error ? error.message : 'Could not find exercise alternatives',
        startTime
      );
      res.status(404).json(errorResponse);
    }
  };

  /**
   * POST /api/v1/tools/validate_exercise_keys
   */
  handleApiValidateExerciseKeys = async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      const { exerciseIds } = req.body;

              if (!exerciseIds || !Array.isArray(exerciseIds)) {
          const errorResponse = this.createApiError(
            'INVALID_INPUT',
            'Exercise IDs parameter is required and must be an array',
            startTime
          );
          res.status(400).json(errorResponse);
          return;
        }

      const result = this.exerciseService.validateExerciseKeys(
        exerciseIds.map((id: string) => sanitizeString(id))
      );

      // Add count metadata for convenience
      const enhancedResult = {
        ...result,
        totalChecked: exerciseIds.length,
        validCount: result.valid.length,
        invalidCount: result.invalid.length,
      };

      const response = this.createApiResponse(enhancedResult, startTime);

      res.json(response);
    } catch (error) {
      const errorResponse = this.createApiError(
        'INVALID_INPUT',
        error instanceof Error ? error.message : 'Invalid validation parameters',
        startTime
      );
      res.status(400).json(errorResponse);
    }
  };

  /**
   * GET /api/v1/schema - Tool schema discovery for Claude API
   */
  handleApiSchema = async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      const baseUrl = this.getApiBaseUrl(req);

      const tools: ApiToolDefinition[] = [
        {
          name: 'search_exercises',
          description: 'Search for exercises with advanced filtering and relevance scoring',
          input_schema: {
            type: 'object',
            properties: {
              equipment: {
                type: 'string',
                description: "Filter by equipment type (e.g., 'dumbbells', 'barbell', 'body weight')"
              },
              category: {
                type: 'string',
                description: "Filter by exercise category (e.g., 'abs', 'chest', 'legs')"
              },
              primaryMuscles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by primary muscles targeted'
              },
              secondaryMuscles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by secondary muscles targeted'
              },
              bodyPart: {
                type: 'string',
                description: 'Filter by body part targeted'
              },
              appleCategory: {
                type: 'string',
                description: 'Filter by Apple HealthKit category'
              },
              query: {
                type: 'string',
                description: 'Text search across exercise names and instructions'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (1-100, default: 20)',
                minimum: 1,
                maximum: 100
              },
              offset: {
                type: 'number',
                description: 'Number of results to skip for pagination (default: 0)',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'get_exercise_by_id',
          description: 'Retrieve specific exercise details by UUID',
          input_schema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Exercise UUID identifier'
              }
            },
            required: ['id']
          }
        },
        {
          name: 'filter_exercises_by_equipment',
          description: 'Filter exercises by equipment type with pagination',
          input_schema: {
            type: 'object',
            properties: {
              equipment: {
                type: 'string',
                description: 'Equipment type to filter by'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 20)',
                minimum: 1,
                maximum: 100
              },
              offset: {
                type: 'number',
                description: 'Number of results to skip (default: 0)',
                minimum: 0
              }
            },
            required: ['equipment']
          }
        },
        {
          name: 'get_exercises_by_category',
          description: 'Get exercises by category with pagination',
          input_schema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Exercise category to filter by'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 20)',
                minimum: 1,
                maximum: 100
              },
              offset: {
                type: 'number',
                description: 'Number of results to skip (default: 0)',
                minimum: 0
              }
            },
            required: ['category']
          }
        },
        {
          name: 'find_exercise_alternatives',
          description: 'Find alternative exercises targeting the same muscle groups',
          input_schema: {
            type: 'object',
            properties: {
              exerciseId: {
                type: 'string',
                description: 'ID of the exercise to find alternatives for'
              },
              targetMuscles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific muscles to target (optional)'
              },
              equipment: {
                type: 'string',
                description: 'Preferred equipment type (optional)'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of alternatives (1-50, default: 10)',
                minimum: 1,
                maximum: 50
              }
            },
            required: ['exerciseId']
          }
        },
        {
          name: 'validate_exercise_keys',
          description: 'Validate that exercise IDs exist in the database',
          input_schema: {
            type: 'object',
            properties: {
              exerciseIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of exercise IDs to validate'
              }
            },
            required: ['exerciseIds']
          }
        }
      ];

      const schemaResponse: ApiSchemaResponse = {
        tools,
        version: '1.0.0',
        server_info: {
          name: 'Exercise Database API',
          base_url: `${baseUrl}/api/v1/tools`,
          description: 'REST API providing access to 1300+ exercises with advanced search and filtering capabilities'
        }
      };

      const response = this.createApiResponse(schemaResponse, startTime);
      res.json(response);
    } catch (error) {
      const errorResponse = this.createApiError(
        'SCHEMA_ERROR',
        error instanceof Error ? error.message : 'Could not generate schema',
        startTime
      );
      res.status(500).json(errorResponse);
    }
  };

  /**
   * GET /api/v1/info - API information endpoint
   */
  handleApiInfo = async (req: Request, res: Response): Promise<void> => {
    const startTime = performance.now();

    try {
      const baseUrl = this.getApiBaseUrl(req);
      const stats = this.exerciseService.getStats();

      const infoResponse: ApiInfoResponse = {
        name: 'Exercise Database API',
        version: '1.0.0',
        description: 'REST API providing access to comprehensive exercise database with 1300+ exercises',
        endpoints: {
          schema: `${baseUrl}/api/v1/schema`,
          tools: [
            `${baseUrl}/api/v1/tools/search_exercises`,
            `${baseUrl}/api/v1/tools/get_exercise_by_id`,
            `${baseUrl}/api/v1/tools/filter_exercises_by_equipment`,
            `${baseUrl}/api/v1/tools/get_exercises_by_category`,
            `${baseUrl}/api/v1/tools/find_exercise_alternatives`,
            `${baseUrl}/api/v1/tools/validate_exercise_keys`
          ]
        },
        authentication: {
          type: 'api_key',
          required: this.config.nodeEnv === 'production'
        },
        statistics: {
          total_exercises: stats.totalExercises,
          categories: stats.categories,
          equipment_types: stats.equipmentTypes
        }
      };

      const response = this.createApiResponse(infoResponse, startTime);
      res.json(response);
    } catch (error) {
      const errorResponse = this.createApiError(
        'INFO_ERROR',
        error instanceof Error ? error.message : 'Could not generate API info',
        startTime
      );
      res.status(500).json(errorResponse);
    }
  };

  /**
   * Helper to get API base URL from request
   */
  private getApiBaseUrl(req: Request): string {
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${protocol}://${host}`;
  }
}
