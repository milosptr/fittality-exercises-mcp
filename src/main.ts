import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { loadExercises, getExerciseById } from "./exercise-functions/loader.js";
import { getDatabaseStats, getDatabaseHealth } from "./exercise-functions/health.js";
import { getPerformanceMetrics } from "./exercise-functions/performance.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { registerLookupTools } from "./tools/lookup-tools.js";
import { registerFilterTools } from "./tools/filter-tools.js";
import { registerMetadataTools } from "./tools/metadata-tools.js";
import { registerHealthTools } from "./tools/health-tools.js";

// Production Configuration
const config = {
  port: parseInt(process.env.PORT || '8080'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 1 minute
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'), // requests per window
  gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '10000'), // 10 seconds
  pendingMessageTimeout: parseInt(process.env.PENDING_MESSAGE_TIMEOUT || '30000'), // 30 seconds
  maxPendingMessages: parseInt(process.env.MAX_PENDING_MESSAGES || '100'),
};

// Production Logger
interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

const logger: Logger = {
  info: (message: string, meta?: any) => {
    const logData = { level: 'info', message, timestamp: new Date().toISOString(), ...meta };
    console.log(JSON.stringify(logData));
  },
  error: (message: string, meta?: any) => {
    const logData = { level: 'error', message, timestamp: new Date().toISOString(), ...meta };
    console.error(JSON.stringify(logData));
  },
  warn: (message: string, meta?: any) => {
    const logData = { level: 'warn', message, timestamp: new Date().toISOString(), ...meta };
    console.warn(JSON.stringify(logData));
  },
  debug: (message: string, meta?: any) => {
    if (config.logLevel === 'debug') {
      const logData = { level: 'debug', message, timestamp: new Date().toISOString(), ...meta };
      console.log(JSON.stringify(logData));
    }
  },
};

// Application state
const appState = {
  isShuttingDown: false,
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  connectionCount: 0,
};

// Graceful shutdown handling
let gracefulShutdown: (signal: string) => void = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  appState.isShuttingDown = true;

  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, config.gracefulShutdownTimeout);

  // Close server gracefully here if needed
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Load exercise data on startup with error handling
try {
  await loadExercises();
  logger.info('Exercise data loaded successfully');
} catch (error) {
  logger.error('Failed to load exercise data', { error: error instanceof Error ? error.message : 'Unknown error' });
  process.exit(1);
}

// Create an MCP server
const server = new McpServer({
  name: "Exercise Database",
  version: "1.0.0",
});

// Register all tool categories with error handling
try {
  registerSearchTools(server);
  registerLookupTools(server);
  registerFilterTools(server);
  registerMetadataTools(server);
  registerHealthTools(server);
  logger.info('MCP tools registered successfully');
} catch (error) {
  logger.error('Failed to register MCP tools', { error: error instanceof Error ? error.message : 'Unknown error' });
  process.exit(1);
}

// Add dynamic exercise resources with improved error handling
server.resource(
  "exercise",
  new ResourceTemplate("exercise://{id}", { list: undefined }),
  async (uri, { id }) => {
    try {
      const exerciseId = Array.isArray(id) ? id[0] : id;
      if (!exerciseId || typeof exerciseId !== 'string' || exerciseId.length > 100) {
        logger.warn('Invalid exercise ID requested', { id: exerciseId, uri: uri.href });
        return {
          contents: [
            {
              uri: uri.href,
              text: `Invalid exercise ID provided.`,
            },
          ],
        };
      }

      const exercise = getExerciseById(exerciseId);
      if (!exercise) {
        logger.debug('Exercise not found', { exerciseId, uri: uri.href });
        return {
          contents: [
            {
              uri: uri.href,
              text: `Exercise with ID "${exerciseId}" not found.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(exercise, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error handling exercise resource request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        uri: uri.href,
        id
      });
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error retrieving exercise: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Add database statistics resource
server.resource(
  "exercise-stats",
  new ResourceTemplate("exercise://stats", { list: undefined }),
  async (uri) => {
    try {
      const stats = getDatabaseStats();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error retrieving database stats', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error retrieving stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Add database health resource
server.resource(
  "exercise-health",
  new ResourceTemplate("exercise://health", { list: undefined }),
  async (uri) => {
    try {
      const health = getDatabaseHealth();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error retrieving database health', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error retrieving health: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Add performance metrics resource
server.resource(
  "exercise-performance",
  new ResourceTemplate("exercise://performance", { list: undefined }),
  async (uri) => {
    try {
      const performance = getPerformanceMetrics();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(performance, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error retrieving performance metrics', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error retrieving performance: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Determine transport mode based on environment
const isHttpMode = process.argv.includes('--http') || process.env.PORT;
const isStdioMode = !isHttpMode;

if (isStdioMode) {
  // Claude Desktop mode - use stdio transport
  logger.info('Starting Exercise Database MCP Server in stdio mode');
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('MCP Server connected via stdio transport');
  } catch (error) {
    logger.error('Failed to start stdio server', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
} else {
  // HTTP mode - use SSE transport with Express
  logger.info('Starting Exercise Database MCP Server in HTTP mode', { port: config.port, env: config.nodeEnv });

  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for SSE
    crossOriginEmbedderPolicy: false, // Allow embedding for MCP clients
  }));

  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimitWindow,
    max: config.rateLimitMax,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: express.Request) => {
      // Skip rate limiting for health checks in production
      return req.path === '/health' && config.nodeEnv === 'production';
    },
  });

  app.use(limiter);

  // Request tracking middleware
  app.use((req, res, next) => {
    if (appState.isShuttingDown) {
      res.status(503).json({ error: 'Server is shutting down' });
      return;
    }

    appState.requestCount++;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;

    logger.debug('Incoming request', {
      requestId,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
      };

      if (res.statusCode >= 400) {
        appState.errorCount++;
        logger.warn('Request completed with error', logData);
      } else {
        logger.debug('Request completed successfully', logData);
      }
    });

    next();
  });

  // Body parsing middleware with MCP endpoint exclusion
  app.use((req, res, next) => {
    if (req.path === '/messages') {
      next();
    } else {
      express.json({
        limit: '10mb',
        strict: true,
        type: ['application/json', 'text/json'],
      })(req, res, next);
    }
  });

  app.use((req, res, next) => {
    if (req.path === '/messages') {
      next();
    } else {
      express.urlencoded({
        extended: true,
        limit: '10mb',
        parameterLimit: 100,
      })(req, res, next);
    }
  });

  // Enhanced transport and message buffering
  let currentTransport: SSEServerTransport | null = null;
  const pendingMessages: Array<{
    req: express.Request;
    res: express.Response;
    timestamp: number;
    requestId: string;
  }> = [];

  // Clean up expired pending messages
  setInterval(() => {
    const now = Date.now();
    const expiredMessages = pendingMessages.filter(msg => now - msg.timestamp > config.pendingMessageTimeout);

    if (expiredMessages.length > 0) {
      logger.warn('Cleaning up expired pending messages', { count: expiredMessages.length });

      expiredMessages.forEach(({ res, requestId }) => {
        if (!res.headersSent) {
          res.status(408).json({ error: 'Request timeout - SSE connection not established in time' });
        }
      });

      // Remove expired messages
      const validMessages = pendingMessages.filter(msg => now - msg.timestamp <= config.pendingMessageTimeout);
      pendingMessages.splice(0, pendingMessages.length, ...validMessages);
    }
  }, 10000); // Check every 10 seconds

  // Enhanced health check endpoint
  app.get("/health", async (req, res) => {
    try {
      const exerciseCount = (await import("./exercise-functions/loader.js")).getExerciseData().length;
      const uptime = Date.now() - appState.startTime;

      const healthData = {
        status: "healthy",
        service: "Exercise Database MCP Server",
        version: "1.0.0",
        environment: config.nodeEnv,
        exerciseCount,
        uptime,
        connections: appState.connectionCount,
        requests: {
          total: appState.requestCount,
          errors: appState.errorCount,
          pending: pendingMessages.length,
        },
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };

      res.json(healthData);
    } catch (error) {
      appState.errorCount++;
      logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        status: "unhealthy",
        service: "Exercise Database MCP Server",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Metrics endpoint for monitoring
  app.get("/metrics", (req, res) => {
    const metrics = {
      uptime: Date.now() - appState.startTime,
      requests_total: appState.requestCount,
      errors_total: appState.errorCount,
      connections_active: appState.connectionCount,
      pending_messages: pendingMessages.length,
      memory_usage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
    res.json(metrics);
  });

  // Root MCP endpoint with enhanced error handling
  app.post("/", async (req: any, res: any) => {
    try {
      logger.debug('Claude Web MCP request received', { body: req.body, requestId: req.requestId });

      const { method, params, id } = req.body || {};

      if (!method || typeof method !== 'string') {
        return res.status(400).json({
          jsonrpc: "2.0",
          id: id || null,
          error: { code: -32600, message: "Invalid Request - missing method" }
        });
      }

      const jsonRpcResponse = { jsonrpc: "2.0", id: id || null };

      switch (method) {
        case "initialize":
          res.json({
            ...jsonRpcResponse,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {}, resources: {} },
              serverInfo: { name: "Exercise Database", version: "1.0.0" }
            }
          });
          break;

        case "ping":
          res.json({ ...jsonRpcResponse, result: {} });
          break;

        default:
          res.json({
            ...jsonRpcResponse,
            error: { code: -32601, message: "Method not found", data: { method } }
          });
      }
    } catch (error) {
      appState.errorCount++;
      logger.error('MCP request processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: { code: -32603, message: "Internal error" }
      });
    }
  });

  // SSE endpoint with enhanced connection management
  app.get("/sse", async (req, res) => {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('New SSE connection established', { connectionId, requestId: req.requestId });
      appState.connectionCount++;

      currentTransport = new SSEServerTransport("/messages", res);

      const cleanup = () => {
        currentTransport = null;
        appState.connectionCount--;

        // Handle any pending messages with error
        const currentPending = pendingMessages.splice(0);
        currentPending.forEach(({ res: pendingRes, requestId }) => {
          if (!pendingRes.headersSent) {
            logger.warn('SSE connection closed, responding to pending message with error', { requestId });
            pendingRes.status(400).json({ error: "SSE connection closed" });
          }
        });

        logger.info('SSE connection closed', { connectionId });
      };

      req.on('close', cleanup);
      req.on('error', (error) => {
        logger.error('SSE connection error', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        cleanup();
      });

      await server.connect(currentTransport);

      // Process buffered messages
      if (pendingMessages.length > 0) {
        logger.info('Processing buffered messages', { count: pendingMessages.length, connectionId });
        const messagesToProcess = pendingMessages.splice(0);

        for (const { req: msgReq, res: msgRes, requestId } of messagesToProcess) {
          try {
            await currentTransport.handlePostMessage(msgReq, msgRes);
            logger.debug('Processed buffered message', { requestId, connectionId });
          } catch (error) {
            logger.error('Error processing buffered message', {
              error: error instanceof Error ? error.message : 'Unknown error',
              requestId,
              connectionId
            });
            if (!msgRes.headersSent) {
              msgRes.status(500).json({ error: "Failed to process buffered message" });
            }
          }
        }
      }
    } catch (error) {
      appState.errorCount++;
      currentTransport = null;
      appState.connectionCount--;

      logger.error('Error establishing SSE connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
        requestId: req.requestId
      });

      // Handle pending messages
      const currentPending = pendingMessages.splice(0);
      currentPending.forEach(({ res: pendingRes, requestId }) => {
        if (!pendingRes.headersSent) {
          pendingRes.status(500).json({ error: "Failed to establish SSE connection" });
        }
      });

      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to establish SSE connection" });
      }
    }
  });

  // Message handling endpoint with enhanced buffering
  app.post("/messages", async (req: any, res: any) => {
    const requestId = req.requestId || `msg_${Date.now()}`;

    if (!currentTransport) {
      // Check if we're at the pending message limit
      if (pendingMessages.length >= config.maxPendingMessages) {
        logger.warn('Pending message buffer full, rejecting request', {
          requestId,
          bufferSize: pendingMessages.length,
          maxSize: config.maxPendingMessages
        });
        return res.status(503).json({ error: "Server busy - too many pending messages" });
      }

      logger.debug('Buffering message - SSE connection not established', { requestId });
      pendingMessages.push({
        req,
        res,
        timestamp: Date.now(),
        requestId
      });
      return;
    }

    try {
      logger.debug('Processing MCP message', { requestId });
      await currentTransport.handlePostMessage(req, res);
    } catch (error) {
      appState.errorCount++;
      logger.error('Error handling MCP message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to handle message" });
      }
    }
  });

  // 404 handler
  app.use((req, res) => {
    logger.warn('Route not found', {
      method: req.method,
      path: req.path,
      requestId: req.requestId
    });
    res.status(404).json({ error: "Not Found" });
  });

  // Global error handler
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    appState.errorCount++;
    logger.error('Unhandled application error', {
      error: error.message,
      stack: error.stack,
      requestId: req.requestId,
      path: req.path,
      method: req.method
    });

    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Start the HTTP server
  const httpServer = app.listen(config.port, () => {
    logger.info('Exercise Database MCP Server started successfully', {
      port: config.port,
      environment: config.nodeEnv,
      endpoints: {
        health: `http://localhost:${config.port}/health`,
        metrics: `http://localhost:${config.port}/metrics`,
        sse: `http://localhost:${config.port}/sse`,
      }
    });
  });

  // Handle server errors
  httpServer.on('error', (error) => {
    logger.error('HTTP server error', { error: error.message });
    process.exit(1);
  });

  // Graceful shutdown for HTTP mode
  const originalShutdown = gracefulShutdown;
  gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    appState.isShuttingDown = true;

    httpServer.close((err) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: err.message });
      } else {
        logger.info('HTTP server closed successfully');
      }
      originalShutdown(signal);
    });
  };
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

logger.info('MCP Server initialization completed', {
  mode: isStdioMode ? 'stdio' : 'http',
  environment: config.nodeEnv,
  pid: process.pid,
});
