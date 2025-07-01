# Build Production-Ready Exercise MCP Server from Scratch

## Project Overview

Build a complete, production-ready MCP (Model Context Protocol) server from scratch that provides Claude AI applications with access to a comprehensive database of 1300+ exercises. The server must be compatible with **both Claude web integrations and Claude API calls**, using proper authentication flows and transport protocols.

## Critical Requirements Learned from Previous Attempts

**IMPORTANT**: Previous attempts using `StreamableHTTPServerTransport` failed with Claude web integrations. Claude's web client expects:
- OAuth discovery endpoints (`/.well-known/oauth-authorization-server`)
- Client registration endpoints (`POST /register`)
- Token endpoints for authentication
- SSE (Server-Sent Events) or WebSocket transport, NOT StreamableHTTP

## Exercise Data Structure

The server will serve exercise data from a JSON file containing 1300+ exercises in this format:

```json
{
  "id": "874ce7a1-2022-449f-92c4-742c17be51bb",
  "name": "3/4 sit-up",
  "equipment": "body weight",
  "category": "abs",
  "appleCategory": "coreTraining",
  "bodyPart": "waist",
  "primaryMuscles": ["abs"],
  "secondaryMuscles": ["hip flexors", "lower back"],
  "instructions": [
    "Lie flat on your back with your knees bent and feet flat on the ground.",
    "Place your hands behind your head with your elbows pointing outwards.",
    "Engaging your abs, slowly lift your upper body off the ground, curling forward until your torso is at a 45-degree angle.",
    "Pause for a moment at the top, then slowly lower your upper body back down to the starting position.",
    "Repeat for the desired number of repetitions."
  ],
  "images": ["E3H0-SVdQacCFN.gif"]
}
```

## Technical Stack Requirements

### Core Technologies
- **Node.js 18+** with TypeScript
- **Express.js** for HTTP server
- **@modelcontextprotocol/sdk** for MCP implementation
- **SSEServerTransport** or **WebSocket transport** (NOT StreamableHTTPServerTransport)
- **Zod** for data validation and schemas
- **CORS** middleware for web browser compatibility
- **ESM modules** (not CommonJS)

### Project Structure
```
exercise-mcp-server/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # Main MCP server with web compatibility
│   ├── mcpServer.ts          # MCP protocol implementation
│   ├── authServer.ts         # OAuth-compatible authentication
│   ├── exerciseService.ts    # Exercise business logic
│   ├── types.ts              # TypeScript interfaces
│   └── utils.ts              # Helper functions
├── data/
│   └── exercises.json        # Exercise database (1300+ exercises)
├── dist/                     # Compiled TypeScript output
└── README.md
```

## MCP Server Functionality Requirements

### Required Resources
1. **`exercise://all`** - Paginated list of all exercises
2. **`exercise://categories`** - Unique exercise categories
3. **`exercise://equipment-types`** - All equipment types
4. **`exercise://muscle-groups`** - All primary/secondary muscles
5. **`exercise://body-parts`** - All targeted body parts
6. **`exercise://apple-categories`** - Apple HealthKit categories
7. **`exercise://stats`** - Database statistics

### Required Tools
1. **`search_exercises`** - Advanced multi-field search with relevance scoring
   - Parameters: equipment, category, primaryMuscles, secondaryMuscles, bodyPart, appleCategory, query, limit, offset
   - Returns: Filtered exercises with pagination and relevance scores

2. **`get_exercise_by_id`** - Retrieve specific exercise by UUID
   - Parameters: id (required)
   - Returns: Complete exercise object or error

3. **`filter_exercises_by_equipment`** - Equipment-based filtering
   - Parameters: equipment (required), limit, offset
   - Returns: Exercises matching equipment type

4. **`get_exercises_by_category`** - Category-based filtering  
   - Parameters: category (required), limit, offset
   - Returns: Exercises in specified category

5. **`find_exercise_alternatives`** - Find similar exercises
   - Parameters: exerciseId (required), targetMuscles, equipment, limit
   - Returns: Alternative exercises targeting same muscles

6. **`validate_exercise_keys`** - Validate exercise IDs exist
   - Parameters: exerciseIds (array, required)
   - Returns: {valid: string[], invalid: string[]}

## Web Integration Compatibility Requirements

### OAuth-Compatible Authentication Endpoints

**OAuth Discovery** (`GET /.well-known/oauth-authorization-server`):
```json
{
  "authorization_endpoint": "https://your-server.com/oauth/authorize",
  "token_endpoint": "https://your-server.com/oauth/token",
  "registration_endpoint": "https://your-server.com/oauth/register",
  "scopes_supported": ["mcp:read", "mcp:write"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "client_credentials"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "none"]
}
```

**Client Registration** (`POST /oauth/register`):
```json
{
  "client_name": "Claude MCP Client",
  "client_uri": "https://claude.ai",
  "scope": "mcp:read mcp:write"
}
```

**Response**:
```json
{
  "client_id": "exercise-mcp-client-{uuid}",
  "client_secret": "not-required-for-public-client",
  "registration_access_token": "optional",
  "client_id_issued_at": 1640995200,
  "scope": "mcp:read mcp:write"
}
```

**Token Endpoint** (`POST /oauth/token`):
```json
{
  "grant_type": "client_credentials",
  "client_id": "exercise-mcp-client-{uuid}",
  "scope": "mcp:read mcp:write"
}
```

**Authorization Endpoint** (`GET /oauth/authorize`):
- Handle OAuth authorization flow
- Can auto-approve for simplified implementation
- Redirect with authorization code

### MCP Transport Implementation

**Use SSEServerTransport** (Server-Sent Events) instead of StreamableHTTPServerTransport:

```typescript
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// MCP endpoint for SSE transport
app.get('/mcp/sse', async (req, res) => {
  const transport = new SSEServerTransport('/mcp/message', res);
  await mcpServer.connect(transport);
});

// Message handling endpoint
app.post('/mcp/message', async (req, res) => {
  // Handle MCP JSON-RPC messages
});
```

### CORS Configuration
```typescript
app.use(cors({
  origin: [
    'https://claude.ai',
    'https://*.anthropic.com',
    'http://localhost:3000' // For development
  ],
  credentials: true,
  exposedHeaders: ['Authorization', 'Content-Type', 'X-MCP-Session'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-MCP-Session']
}));
```

## Exercise Service Implementation Requirements

### Data Loading and Indexing
```typescript
class ExerciseService {
  private exercises: Exercise[];
  private categoryIndex: Map<string, Exercise[]>;
  private equipmentIndex: Map<string, Exercise[]>;
  private muscleIndex: Map<string, Exercise[]>;
  
  async initialize(): Promise<void> {
    // Load exercises.json with error handling
    // Build search indexes for fast filtering
    // Validate all exercise objects
  }
  
  searchExercises(params: SearchParams): SearchResult {
    // Multi-field search with relevance scoring
    // Text search across names and instructions
    // Combine filters efficiently
    // Return paginated results
  }
}
```

### Search Capabilities
- **Fuzzy text search** across exercise names and instructions
- **Multi-field filtering** by equipment + category + muscles
- **Relevance scoring** based on match quality
- **Efficient pagination** with limit/offset
- **Performance optimization** using pre-built indexes

### Error Handling
- Comprehensive input validation with Zod schemas
- Proper MCP error responses
- Graceful handling of missing data
- Detailed error messages for debugging

## Production Requirements

### Package.json Configuration
```json
{
  "name": "exercise-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx --watch src/index.ts",
    "test": "jest",
    "clean": "rm -rf dist"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Required Dependencies
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "zod": "^3.22.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "jest": "^29.0.0"
  }
}
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Environment Configuration
```typescript
interface Config {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  jwtSecret: string;
  exerciseDataPath: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['https://claude.ai'],
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  exerciseDataPath: process.env.EXERCISE_DATA_PATH || './data/exercises.json'
};
```

## Railway Deployment Compatibility

### Deployment Requirements
- **PORT environment variable** support for Railway auto-assignment
- **Graceful shutdown** handling for SIGTERM/SIGINT
- **Health check endpoint** at `/health`
- **Build process** via `npm run build`
- **Start command** pointing to compiled JavaScript

### Health Check Implementation
```typescript
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      mcp: mcpServer.isConnected() ? 'connected' : 'disconnected',
      exercises: exerciseService.getHealthStatus(),
      database: {
        totalExercises: exerciseService.getTotalCount(),
        categoriesLoaded: exerciseService.getCategoriesCount(),
        lastUpdated: exerciseService.getLastUpdated()
      }
    },
    endpoints: {
      mcp_sse: '/mcp/sse',
      oauth_discovery: '/.well-known/oauth-authorization-server',
      registration: '/oauth/register'
    }
  };
  
  res.json(health);
});
```

## Authentication Implementation

### Simplified OAuth Flow
For MVP implementation, create a simplified but spec-compliant OAuth flow:
- **Client registration**: Accept any client, return static credentials
- **Authorization**: Auto-approve requests (no user interaction needed)
- **Token generation**: Return JWT or static tokens
- **Token validation**: Accept valid tokens for MCP requests

### Security Considerations
- **Rate limiting** on registration and token endpoints
- **CORS validation** for allowed origins
- **Input sanitization** for all OAuth parameters
- **Token expiration** handling (can be long-lived for simplicity)

## Testing and Validation Requirements

### Integration Tests
1. **OAuth flow**: Complete registration → authorization → token → MCP access
2. **MCP communication**: All tools and resources work correctly
3. **Exercise search**: Advanced filtering and text search function properly
4. **Error handling**: Proper responses for invalid inputs
5. **Performance**: Sub-100ms response times for most operations

### Claude Web Integration Test
1. **Discovery**: `/.well-known/oauth-authorization-server` returns valid JSON
2. **Registration**: Claude can register as a client successfully
3. **Connection**: MCP connection established without errors
4. **Tool execution**: All exercise tools work through Claude web interface
5. **Resource access**: All exercise resources accessible via Claude web

## Implementation Priority

### Phase 1: Core MCP Functionality
1. Basic Express server with health check
2. Exercise data loading and service layer
3. MCP server with SSE transport
4. All required tools and resources
5. Basic error handling

### Phase 2: Web Integration Compatibility
1. OAuth discovery endpoint
2. Client registration endpoint
3. Token endpoint (simplified)
4. CORS configuration
5. Authorization endpoint

### Phase 3: Production Readiness
1. Comprehensive error handling
2. Performance optimization
3. Security hardening
4. Monitoring and logging
5. Documentation

## Success Criteria

The completed MCP server must:
- ✅ **Connect successfully** to Claude web integrations without auth errors
- ✅ **Serve all 1300+ exercises** with fast search and filtering
- ✅ **Provide all required tools** (search, get by ID, filter, alternatives, validate)
- ✅ **Support all resources** (categories, equipment, muscles, stats)
- ✅ **Deploy easily** to Railway with auto-scaling
- ✅ **Handle errors gracefully** with proper MCP error responses
- ✅ **Perform efficiently** with sub-100ms response times
- ✅ **Follow OAuth standards** for web client compatibility
- ✅ **Include comprehensive logging** for debugging and monitoring

## Code Quality Requirements

### TypeScript Standards
- **Strict type checking** enabled
- **Comprehensive interfaces** for all data structures
- **Proper error types** and handling
- **JSDoc comments** for all public functions
- **Clean separation** of concerns across modules

### Production Code Standards
- **Error boundaries** around all async operations
- **Input validation** using Zod schemas
- **Proper logging** with structured format
- **Resource cleanup** and graceful shutdown
- **Performance monitoring** and metrics

## Expected Usage Patterns

Claude will use this server to:
1. **Search exercises** based on user equipment, goals, and muscle targets
2. **Get detailed exercise information** including step-by-step instructions
3. **Find exercise alternatives** when equipment or preferences change
4. **Validate exercise selections** for workout plan generation
5. **Access categorized data** for structured fitness programming

## Final Implementation Notes

- **Start with SSE transport** as it's most compatible with web browsers
- **Keep OAuth implementation simple** but spec-compliant for MVP
- **Focus on exercise functionality** - that's the core value
- **Test extensively** with Claude web integration during development
- **Document all endpoints** for easier debugging and maintenance
- **Plan for scalability** but implement simply first

Build a complete, working implementation that addresses all requirements while maintaining clean, maintainable code structure. The server should be production-ready for deployment to Railway and immediately compatible with Claude web integrations.