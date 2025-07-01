import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ExerciseService } from './exerciseService.js';
import { ExerciseMCPServer } from './mcpServer.js';
import { AuthServer } from './authServer.js';
import { Config, HealthStatus } from './types.js';
import { logInfo, logError, getCurrentTimestamp } from './utils.js';

// Load environment variables
dotenv.config();

/**
 * Configuration setup
 */
const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
    'https://claude.ai',
    'https://*.anthropic.com',
    'http://localhost:3000'
  ],
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  exerciseDataPath: process.env.EXERCISE_DATA_PATH || './data/exercises.json',
  oauthClientIdPrefix: process.env.OAUTH_CLIENT_ID_PREFIX || 'exercise-mcp-client',
  oauthTokenExpiry: parseInt(process.env.OAUTH_TOKEN_EXPIRY || '86400'),
  logLevel: process.env.LOG_LEVEL || 'info',
};

/**
 * Initialize services
 */
const exerciseService = new ExerciseService();
const mcpServer = new ExerciseMCPServer(exerciseService);
const authServer = new AuthServer(
  config.oauthClientIdPrefix,
  config.jwtSecret,
  config.oauthTokenExpiry,
  config.nodeEnv === 'production'
    ? `https://exercise-mcp-server.railway.app`
    : `http://localhost:${config.port}`
);

/**
 * Express app setup
 */
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if origin matches any of the allowed patterns
    const isAllowed = config.corsOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowedOrigin === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logError('CORS rejection', null, { origin, allowedOrigins: config.corsOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Authorization', 'Content-Type', 'X-MCP-Session'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-MCP-Session'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const health: HealthStatus = {
    status: exerciseService.isInitialized() ? 'healthy' : 'unhealthy',
    timestamp: getCurrentTimestamp(),
    version: '1.0.0',
    services: {
      mcp: mcpServer.isServerConnected() ? 'connected' : 'disconnected',
      exercises: exerciseService.getHealthStatus(),
      database: {
        totalExercises: exerciseService.getTotalCount(),
        categoriesLoaded: exerciseService.getCategoriesCount(),
        lastUpdated: exerciseService.getLastUpdated(),
      },
    },
    endpoints: {
      mcp_sse: '/mcp/sse',
      oauth_discovery: '/.well-known/oauth-authorization-server',
      registration: '/oauth/register',
    },
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * OAuth Discovery endpoint
 */
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  try {
    const discovery = authServer.getDiscoveryDocument();
    res.json(discovery);
  } catch (error) {
    logError('OAuth discovery failed', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to generate discovery document',
    });
  }
});

/**
 * OAuth client registration endpoint
 */
app.post('/oauth/register', async (req, res) => {
  await authServer.registerClient(req, res);
});

/**
 * OAuth authorization endpoint
 */
app.get('/oauth/authorize', async (req, res) => {
  await authServer.authorize(req, res);
});

/**
 * OAuth token endpoint
 */
app.post('/oauth/token', async (req, res) => {
  await authServer.token(req, res);
});

/**
 * MCP SSE endpoint
 */
app.get('/mcp/sse', authServer.authenticateToken, async (req, res) => {
  try {
    logInfo('MCP SSE connection requested', {
      clientId: (req as any).tokenInfo?.client_id
    });

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    // Create SSE transport
    const transport = new SSEServerTransport('/mcp/message', res);

    // Connect MCP server to transport
    await mcpServer.connect(transport);

    // Handle client disconnect
    req.on('close', async () => {
      logInfo('MCP SSE connection closed');
      try {
        await mcpServer.close();
      } catch (error) {
        logError('Error closing MCP server on disconnect', error);
      }
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write('data: {"type":"ping"}\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    logError('MCP SSE connection failed', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to establish MCP connection',
    });
  }
});

/**
 * MCP message handler endpoint
 */
app.post('/mcp/message', authServer.authenticateToken, express.json(), async (req, res) => {
  try {
    // This endpoint is used by the SSE transport for bidirectional communication
    // The actual message handling is done by the MCP server through the transport
    res.status(200).json({ received: true });
  } catch (error) {
    logError('MCP message handling failed', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to handle MCP message',
    });
  }
});

/**
 * Root endpoint with API information
 */
app.get('/', (_req, res) => {
  res.json({
    name: 'Exercise MCP Server',
    version: '1.0.0',
    description: 'Production-ready MCP server providing access to 1300+ exercises',
    endpoints: {
      health: '/health',
      oauth_discovery: '/.well-known/oauth-authorization-server',
      oauth_register: '/oauth/register',
      oauth_authorize: '/oauth/authorize',
      oauth_token: '/oauth/token',
      mcp_sse: '/mcp/sse',
    },
    stats: exerciseService.isInitialized() ? exerciseService.getStats() : null,
  });
});

app.post('/', (_req, res) => {
  res.json({
    name: 'Exercise MCP Server',
    version: '1.0.0',
    description: 'Production-ready MCP server providing access to 1300+ exercises',
    endpoints: {
      health: '/health',
      oauth_discovery: '/.well-known/oauth-authorization-server',
      oauth_register: '/oauth/register',
      oauth_authorize: '/oauth/authorize',
      oauth_token: '/oauth/token',
      mcp_sse: '/mcp/sse',
    },
    stats: exerciseService.isInitialized() ? exerciseService.getStats() : null,
  });
});

/**
 * Error handling middleware
 */
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logError('Unhandled application error', error, {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });

  res.status(500).json({
    error: 'internal_server_error',
    error_description: 'An unexpected error occurred',
  });
});

/**
 * 404 handler
 */
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'not_found',
    error_description: `Endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

/**
 * Graceful shutdown handling
 */
process.on('SIGTERM', async () => {
  logInfo('SIGTERM received, starting graceful shutdown');

  try {
    await mcpServer.close();
    process.exit(0);
  } catch (error) {
    logError('Error during graceful shutdown', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logInfo('SIGINT received, starting graceful shutdown');

  try {
    await mcpServer.close();
    process.exit(0);
  } catch (error) {
    logError('Error during graceful shutdown', error);
    process.exit(1);
  }
});

/**
 * Initialize and start server
 */
async function startServer(): Promise<void> {
  try {
    logInfo('Starting Exercise MCP Server', {
      nodeEnv: config.nodeEnv,
      port: config.port,
    });

    // Initialize exercise service
    await exerciseService.initialize(config.exerciseDataPath);

    // Set up token cleanup interval
    setInterval(() => {
      authServer.cleanupExpiredTokens();
    }, 300000); // Every 5 minutes

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logInfo('Exercise MCP Server started successfully', {
        port: config.port,
        nodeEnv: config.nodeEnv,
        exerciseCount: exerciseService.getTotalCount(),
        healthEndpoint: `http://localhost:${config.port}/health`,
        oauthDiscovery: `http://localhost:${config.port}/.well-known/oauth-authorization-server`,
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      logError('Server error', error);
      process.exit(1);
    });

  } catch (error) {
    logError('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    logError('Startup error', error);
    process.exit(1);
  });
}

export { app, config, exerciseService, mcpServer, authServer };
