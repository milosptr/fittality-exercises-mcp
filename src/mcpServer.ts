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
} from './types.js';
import {
  parsePaginationParams,
  sanitizeString,
  logInfo,
  logError,
  measurePerformance,
  createErrorContext,
  createMCPLogNotification,
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
}
