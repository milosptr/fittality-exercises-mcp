#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { ExerciseService } from './exerciseService.js';
import {
  SearchParamsSchema,
  GetExerciseByIdSchema,
  FilterByEquipmentSchema,
  GetByCategorySchema,
  FindAlternativesSchema,
  ValidateExerciseKeysSchema
} from './types.js';
import { logWithTimestamp } from './utils.js';

/**
 * MCP Exercise Database Server (Web Compatible)
 * Provides access to 1300+ exercises through search tools and resources
 * Compatible with Claude web integrations via SSE transport
 */
class ExerciseMcpServer {
  private server: Server;
  private exerciseService: ExerciseService;
  private transports: { [sessionId: string]: SSEServerTransport } = {};

  constructor() {
    this.server = new Server(
      {
        name: 'exercise-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    );

    this.exerciseService = new ExerciseService();
    this.setupHandlers();
  }

  /**
   * Setup all MCP handlers for resources and tools
   */
  private setupHandlers(): void {
    // Resources handlers
    this.setupResourceHandlers();

    // Tools handlers
    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => {
      logWithTimestamp(`MCP Server error: ${error}`, 'error');
    };
  }

  /**
   * Setup resource handlers
   */
  private setupResourceHandlers(): void {
    // List all available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'exercise://all',
            name: 'All Exercises',
            description: 'Complete list of all exercises (paginated)',
            mimeType: 'application/json'
          },
          {
            uri: 'exercise://categories',
            name: 'Exercise Categories',
            description: 'List of all unique exercise categories',
            mimeType: 'application/json'
          },
          {
            uri: 'exercise://equipment-types',
            name: 'Equipment Types',
            description: 'List of all equipment types used in exercises',
            mimeType: 'application/json'
          },
          {
            uri: 'exercise://muscle-groups',
            name: 'Muscle Groups',
            description: 'List of all muscle groups (primary and secondary)',
            mimeType: 'application/json'
          },
          {
            uri: 'exercise://body-parts',
            name: 'Body Parts',
            description: 'List of all body parts targeted by exercises',
            mimeType: 'application/json'
          },
          {
            uri: 'exercise://apple-categories',
            name: 'Apple Categories',
            description: 'List of all Apple HealthKit workout categories',
            mimeType: 'application/json'
          },
          {
            uri: 'exercise://stats',
            name: 'Exercise Statistics',
            description: 'Overall statistics and metadata about the exercise database',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // Read specific resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'exercise://all': {
            const result = this.exerciseService.getAllExercises(100, 0); // Get first 100
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'exercise://categories': {
            const categories = this.exerciseService.getCategories();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({ categories }, null, 2)
                }
              ]
            };
          }

          case 'exercise://equipment-types': {
            const equipmentTypes = this.exerciseService.getEquipmentTypes();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({ equipmentTypes }, null, 2)
                }
              ]
            };
          }

          case 'exercise://muscle-groups': {
            const muscleGroups = this.exerciseService.getMuscleGroups();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({ muscleGroups }, null, 2)
                }
              ]
            };
          }

          case 'exercise://body-parts': {
            const bodyParts = this.exerciseService.getBodyParts();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({ bodyParts }, null, 2)
                }
              ]
            };
          }

          case 'exercise://apple-categories': {
            const appleCategories = this.exerciseService.getAppleCategories();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({ appleCategories }, null, 2)
                }
              ]
            };
          }

          case 'exercise://stats': {
            const stats = this.exerciseService.getExerciseStats();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(stats, null, 2)
                }
              ]
            };
          }

          default:
            throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
        }
      } catch (error) {
        logWithTimestamp(`Error reading resource ${uri}: ${error}`, 'error');
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Setup tool handlers
   */
  private setupToolHandlers(): void {
    // List all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_exercises',
            description: 'Search for exercises with advanced filtering and relevance scoring',
            inputSchema: {
              type: 'object',
              properties: {
                equipment: {
                  type: 'string',
                  description: 'Filter by equipment type (e.g., "barbell", "dumbbells", "body weight")'
                },
                category: {
                  type: 'string',
                  description: 'Filter by exercise category (e.g., "abs", "chest", "legs")'
                },
                primaryMuscles: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by primary muscles targeted'
                },
                secondaryMuscles: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by secondary muscles involved'
                },
                bodyPart: {
                  type: 'string',
                  description: 'Filter by body part (e.g., "chest", "back", "legs")'
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
            description: 'Get detailed information about a specific exercise by its ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'UUID of the exercise to retrieve'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'filter_exercises_by_equipment',
            description: 'Filter exercises by equipment type with pagination',
            inputSchema: {
              type: 'object',
              properties: {
                equipment: {
                  type: 'string',
                  description: 'Equipment type to filter by'
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
              },
              required: ['equipment']
            }
          },
          {
            name: 'get_exercises_by_category',
            description: 'Get exercises in a specific category with pagination',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'Category to filter by'
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
              },
              required: ['category']
            }
          },
          {
            name: 'find_exercise_alternatives',
            description: 'Find alternative exercises that target similar muscles',
            inputSchema: {
              type: 'object',
              properties: {
                exerciseId: {
                  type: 'string',
                  description: 'UUID of the reference exercise'
                },
                targetMuscles: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional: specific muscles to target for alternatives'
                },
                equipment: {
                  type: 'string',
                  description: 'Optional: filter alternatives by equipment type'
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
            inputSchema: {
              type: 'object',
              properties: {
                exerciseIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of exercise UUIDs to validate'
                }
              },
              required: ['exerciseIds']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_exercises': {
            const params = SearchParamsSchema.parse(args);
            const result = this.exerciseService.searchExercises(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'get_exercise_by_id': {
            const { id } = GetExerciseByIdSchema.parse(args);
            const exercise = this.exerciseService.getExerciseById(id);

            if (!exercise) {
              throw new McpError(ErrorCode.InvalidRequest, `Exercise with ID ${id} not found`);
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(exercise, null, 2)
                }
              ]
            };
          }

          case 'filter_exercises_by_equipment': {
            const { equipment, limit, offset } = FilterByEquipmentSchema.parse(args);
            const result = this.exerciseService.filterByEquipment(equipment, limit, offset);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'get_exercises_by_category': {
            const { category, limit, offset } = GetByCategorySchema.parse(args);
            const result = this.exerciseService.getByCategory(category, limit, offset);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'find_exercise_alternatives': {
            const { exerciseId, targetMuscles, equipment, limit } = FindAlternativesSchema.parse(args);
            const result = this.exerciseService.findAlternatives(exerciseId, targetMuscles, equipment, limit);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'validate_exercise_keys': {
            const { exerciseIds } = ValidateExerciseKeysSchema.parse(args);
            const result = this.exerciseService.validateExerciseIds(exerciseIds);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        logWithTimestamp(`Error calling tool ${name}: ${error}`, 'error');

        if (error instanceof McpError) {
          throw error;
        }

        // Handle validation errors from Zod
        if (error && typeof error === 'object' && 'issues' in error) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${JSON.stringify((error as any).issues)}`);
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Initialize the server and exercise service
   */
  async initialize(): Promise<void> {
    try {
      logWithTimestamp('Initializing Exercise MCP Server...');

      // Initialize exercise service
      await this.exerciseService.initialize();

      logWithTimestamp('Exercise MCP Server initialized successfully');
    } catch (error) {
      logWithTimestamp(`Failed to initialize server: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Start the MCP server with SSE transport (Claude web compatible)
   */
  async start(port: number = 3000): Promise<void> {
    const app = express();

    // Enhanced CORS configuration for Claude web integration
    app.use(
      cors({
        origin: [
          'https://claude.ai',
          'https://*.anthropic.com',
          'https://*.claude.ai',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:*',
          'http://127.0.0.1:*'
        ],
        credentials: true,
        exposedHeaders: ['Authorization', 'Content-Type'],
        allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin']
      })
    );
    app.use(express.json());

    // OAuth Discovery Endpoint (required by Claude web integration)
    app.get('/.well-known/oauth-authorization-server', (req, res) => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.json({
        authorization_endpoint: `${baseUrl}/auth`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        scopes_supported: ['mcp'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        issuer: baseUrl
      });
    });

    // Client Registration Endpoint (OAuth Dynamic Registration)
    app.post('/register', (req, res) => {
      const clientId = randomUUID();
      const clientSecret = randomUUID();

      logWithTimestamp(`Client registration request: ${JSON.stringify(req.body)}`);

      res.json({
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        grant_types: ['authorization_code'],
        response_types: ['code'],
        scope: 'mcp'
      });
    });

    // OAuth Authorization Endpoint (simplified, auto-approve)
    app.get('/auth', (req, res) => {
      const { client_id, redirect_uri, state, response_type } = req.query;

      if (response_type !== 'code') {
        return res.status(400).json({ error: 'unsupported_response_type' });
      }

      const authCode = randomUUID();
      const redirectUrl = new URL(redirect_uri as string);
      redirectUrl.searchParams.set('code', authCode);
      if (state) {
        redirectUrl.searchParams.set('state', state as string);
      }

      logWithTimestamp(`Authorization granted for client: ${client_id}`);
      return res.redirect(redirectUrl.toString());
    });

    // OAuth Token Endpoint
    app.post('/token', (req, res) => {
      const { grant_type, code, client_id, client_secret } = req.body;

      if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type' });
      }

      // Validate required parameters
      if (!code || !client_id || !client_secret) {
        return res.status(400).json({ error: 'invalid_request' });
      }

      const accessToken = randomUUID();

      logWithTimestamp(`Token issued for client: ${client_id} with code: ${code}`);

      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'mcp'
      });
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      const health = this.getHealthStatus();
      res.json(health);
    });

    // Root endpoint
    app.get('/', (req, res) => {
      res.json({
        service: 'Exercise MCP Server',
        version: '1.0.0',
        endpoints: {
          sse: '/sse',
          health: '/health',
          oauth: '/.well-known/oauth-authorization-server'
        },
        status: 'running',
        compatible: 'Claude Web Integration'
      });
    });

    // SSE endpoint for establishing connections
    app.get('/sse', async (req, res) => {
      try {
        logWithTimestamp('SSE connection request received');

        // Create new SSE transport for this connection
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;

        // Store transport
        this.transports[sessionId] = transport;

        // Clean up on connection close
        res.on('close', () => {
          logWithTimestamp(`SSE connection closed: ${sessionId}`);
          delete this.transports[sessionId];
        });

        res.on('error', (error) => {
          logWithTimestamp(`SSE connection error: ${error}`, 'error');
          delete this.transports[sessionId];
        });

        // Connect MCP server to transport
        await this.server.connect(transport);

        logWithTimestamp(`SSE connection established: ${sessionId}`);
      } catch (error) {
        logWithTimestamp(`Error establishing SSE connection: ${error}`, 'error');
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to establish SSE connection' });
        }
      }
    });

    // Messages endpoint for client-to-server communication
    app.post('/messages', async (req, res) => {
      try {
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
          return res.status(400).json({ error: 'Missing sessionId' });
        }

        const transport = this.transports[sessionId];
        if (!transport) {
          return res.status(400).json({ error: 'Invalid sessionId' });
        }

        logWithTimestamp(`Message received for session ${sessionId}: ${JSON.stringify(req.body)}`);

        // Handle the message through the transport
        await transport.handlePostMessage(req, res, req.body);
      } catch (error) {
        logWithTimestamp(`Error handling message: ${error}`, 'error');
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // Start the HTTP server
    const server = app.listen(port, () => {
      logWithTimestamp(`Exercise MCP Server running at http://localhost:${port}`);
      logWithTimestamp('Claude Web Integration Compatible Endpoints:');
      logWithTimestamp(`  - GET  http://localhost:${port}/sse              (SSE Connection)`);
      logWithTimestamp(`  - POST http://localhost:${port}/messages         (MCP Messages)`);
      logWithTimestamp(`  - GET  http://localhost:${port}/.well-known/oauth-authorization-server (OAuth Discovery)`);
      logWithTimestamp(`  - POST http://localhost:${port}/register         (Client Registration)`);
      logWithTimestamp(`  - GET  http://localhost:${port}/health           (Health Check)`);
    });

    // Add graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logWithTimestamp(`Received ${signal}, shutting down gracefully...`);

      // Close all active SSE connections
      for (const [sessionId, transport] of Object.entries(this.transports)) {
        try {
          await transport.close();
          logWithTimestamp(`Closed SSE connection: ${sessionId}`);
        } catch (error) {
          logWithTimestamp(`Error closing SSE connection ${sessionId}: ${error}`, 'warn');
        }
      }

      // Close the HTTP server
      server.close(() => {
        logWithTimestamp('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  /**
   * Get server health status
   */
  getHealthStatus(): {
    server: string;
    transport: string;
    activeConnections: number;
    exerciseService: ReturnType<ExerciseService['getHealthStatus']>;
  } {
    return {
      server: 'running',
      transport: 'SSE (Claude Web Compatible)',
      activeConnections: Object.keys(this.transports).length,
      exerciseService: this.exerciseService.getHealthStatus()
    };
  }
}

/**
 * Main function to start the server
 */
async function main(): Promise<void> {
  const server = new ExerciseMcpServer();
  const port = parseInt(process.env.PORT || '3000');

  try {
    await server.initialize();
    await server.start(port);
  } catch (error) {
    logWithTimestamp(`Fatal error: ${error}`, 'error');
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logWithTimestamp(`Unhandled error: ${error}`, 'error');
    process.exit(1);
  });
}
