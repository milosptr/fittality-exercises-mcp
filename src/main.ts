import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { loadExercises, getExerciseById } from "./exercise-functions/loader.js";
import { getDatabaseStats, getDatabaseHealth } from "./exercise-functions/health.js";
import { getPerformanceMetrics } from "./exercise-functions/performance.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { registerLookupTools } from "./tools/lookup-tools.js";
import { registerFilterTools } from "./tools/filter-tools.js";
import { registerMetadataTools } from "./tools/metadata-tools.js";
import { registerHealthTools } from "./tools/health-tools.js";
import { oauthHandlers } from "./oauth/simple-oauth.js";

// Load exercise data on startup
await loadExercises();

// Create an MCP server
const server = new McpServer({
  name: "Exercise Database",
  version: "1.0.0",
});

// Register all tool categories
registerSearchTools(server);
registerLookupTools(server);
registerFilterTools(server);
registerMetadataTools(server);
registerHealthTools(server);

// Add dynamic exercise resources
server.resource(
  "exercise",
  new ResourceTemplate("exercise://{id}", { list: undefined }),
  async (uri, { id }) => {
    // Ensure id is a string
    const exerciseId = Array.isArray(id) ? id[0] : id;
    if (!exerciseId || typeof exerciseId !== 'string') {
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
  }
);

// Add database statistics resource
server.resource(
  "exercise-stats",
  new ResourceTemplate("exercise://stats", { list: undefined }),
  async (uri) => {
    const stats = getDatabaseStats();
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }
);

// Add database health resource
server.resource(
  "exercise-health",
  new ResourceTemplate("exercise://health", { list: undefined }),
  async (uri) => {
    const health = getDatabaseHealth();
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
  }
);

// Add performance metrics resource
server.resource(
  "exercise-performance",
  new ResourceTemplate("exercise://performance", { list: undefined }),
  async (uri) => {
    const performance = getPerformanceMetrics();
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(performance, null, 2),
        },
      ],
    };
  }
);

// Determine transport mode based on environment
// Claude Desktop uses stdio, so default to stdio unless explicitly requesting HTTP
const isHttpMode = process.argv.includes('--http') || process.env.PORT;
const isStdioMode = !isHttpMode;

if (isStdioMode) {
  // Claude Desktop mode - use stdio transport
  console.error("Starting Exercise Database MCP Server in stdio mode...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server connected via stdio transport");
} else {
  // HTTP mode - use SSE transport with Express
  console.error("Starting Exercise Database MCP Server in HTTP mode...");

  // Create Express app for SSE transport
  const app = express();
  app.use(express.json());

  let transport: SSEServerTransport | undefined = undefined;

  // Health check endpoint
  app.get("/health", async (req, res) => {
    try {
      // Basic health check - ensure exercises are loaded
      const exerciseCount = (await import("./exercise-functions/loader.js")).getExerciseData().length;
      res.json({
        status: "healthy",
        service: "Exercise Database MCP Server",
        version: "1.0.0",
        exerciseCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        service: "Exercise Database MCP Server",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // OAuth 2.0 Authorization Server endpoints for Claude Web
  app.get("/.well-known/oauth-authorization-server", oauthHandlers.metadata);
  app.get("/authorize", oauthHandlers.authorize);
  app.post("/token", oauthHandlers.token);
  app.post("/revoke", oauthHandlers.revoke);

    // Root MCP endpoint for Claude Web (requires OAuth)
  app.post("/", oauthHandlers.validateToken, async (req, res) => {
    console.error("Claude Web MCP request to root endpoint:", JSON.stringify(req.body, null, 2));

    // Handle JSON-RPC MCP requests
    try {
      const { method, params, id } = req.body;

      // Basic JSON-RPC response structure
      const jsonRpcResponse = {
        jsonrpc: "2.0",
        id: id || null
      };

      // Handle basic MCP methods
      if (method === "initialize") {
        res.json({
          ...jsonRpcResponse,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              resources: {}
            },
            serverInfo: {
              name: "Exercise Database",
              version: "1.0.0"
            }
          }
        });
      } else if (method === "ping") {
        res.json({
          ...jsonRpcResponse,
          result: {}
        });
      } else {
        // For other methods, return method not found
        res.json({
          ...jsonRpcResponse,
          error: {
            code: -32601,
            message: "Method not found",
            data: { method }
          }
        });
      }
    } catch (error) {
      console.error("MCP request error:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error"
        }
      });
    }
  });

  // Protected MCP endpoints for Claude Web (require OAuth)
  app.get("/mcp/sse", oauthHandlers.validateToken, async (req, res) => {
    console.error("New OAuth-protected SSE connection established");
    transport = new SSEServerTransport("/mcp/messages", res);
    await server.connect(transport);
  });

  app.post("/mcp/messages", oauthHandlers.validateToken, async (req, res) => {
    if (!transport) {
      res.status(400).json({ error: "No SSE transport connection established" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // SSE endpoint for MCP communication
  app.get("/sse", async (req, res) => {
    console.error("New SSE connection established");
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
  });

  // POST endpoint for handling MCP messages
  app.post("/messages", async (req, res) => {
    if (!transport) {
      res.status(400).json({ error: "No SSE transport connection established" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // Start the HTTP server
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.error(`Exercise Database MCP Server is running on port ${PORT}`);
    console.error(`Health check available at: http://localhost:${PORT}/health`);
    console.error(`SSE endpoint available at: http://localhost:${PORT}/sse`);
  });
}
