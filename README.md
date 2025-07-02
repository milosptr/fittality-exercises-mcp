# Exercise MCP Server

A production-ready **Model Context Protocol (MCP)** server providing Claude AI applications with access to a comprehensive database of 1300+ exercises. Built with TypeScript, Express.js, and the official MCP SDK.

## 🎯 Overview

This MCP server enables AI applications (like Claude) to access and utilize a rich exercise database through standardized MCP protocols. It implements all three core MCP primitives - **Tools**, **Resources**, and **Prompts** - making it a complete fitness-focused AI integration.

### Key Features

- 🏋️ **1300+ Exercise Database** - Comprehensive exercise data with instructions, muscle groups, and equipment
- 🔧 **6 Powerful Tools** - Search, filter, and find exercise alternatives
- 📚 **7 Resource Endpoints** - Access categorized exercise data
- 📝 **5 Fitness Prompts** - Guided workout planning and form guidance
- 🔐 **OAuth Authentication** - Secure client registration and token management
- 🚀 **Production Ready** - Railway deployment, health monitoring, and performance tracking
- 🌐 **Web Compatible** - SSE transport for browser-based Claude integrations

## 📦 Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- TypeScript

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/fittality-exercises-mcp.git
cd fittality-exercises-mcp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Build the project
npm run build

# Start the server
npm start

# Or run in development mode
npm run dev
```

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGINS=https://claude.ai,https://*.anthropic.com

# Database
EXERCISE_DATA_PATH=./data/exercises.json

# OAuth
OAUTH_CLIENT_ID_PREFIX=exercise-mcp-client
OAUTH_TOKEN_EXPIRY=86400

# Logging
LOG_LEVEL=info
```

## 🔗 API Endpoints

### Health & Info

#### `GET /health`
Returns server health status and capabilities.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-02T02:40:54.198Z",
  "version": "1.0.0",
  "services": {
    "mcp": "disconnected",
    "exercises": "healthy",
    "database": {
      "totalExercises": 1324,
      "categoriesLoaded": 19,
      "lastUpdated": "2025-07-02T02:40:48.868Z"
    }
  },
  "endpoints": {
    "mcp_sse": "/mcp/sse",
    "oauth_discovery": "/.well-known/oauth-authorization-server",
    "registration": "/oauth/register"
  },
  "capabilities": {
    "tools": 6,
    "resources": 7,
    "prompts": 5,
    "features": [
      "tools",
      "resources",
      "prompts",
      "structured_content",
      "performance_monitoring"
    ]
  }
}
```

#### `GET /` or `POST /`
Returns API information and statistics.

### OAuth Authentication

#### `GET /.well-known/oauth-authorization-server`
OAuth 2.0 discovery endpoint for client auto-configuration.

**Response:**
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

#### `POST /oauth/register`
Register a new OAuth client.

**Request:**
```json
{
  "client_name": "Claude MCP Client",
  "client_uri": "https://claude.ai",
  "scope": "mcp:read mcp:write"
}
```

**Response:**
```json
{
  "client_id": "exercise-mcp-client-12345",
  "client_secret": "not-required-for-public-client",
  "client_id_issued_at": 1640995200,
  "scope": "mcp:read mcp:write"
}
```

#### `GET /oauth/authorize`
OAuth authorization endpoint (auto-approves for simplicity).

#### `POST /oauth/token`
Exchange credentials for access tokens.

**Request:**
```json
{
  "grant_type": "client_credentials",
  "client_id": "exercise-mcp-client-12345",
  "scope": "mcp:read mcp:write"
}
```

### MCP Transport

#### `GET /mcp/sse` 🔒
**Authentication Required**

Server-Sent Events endpoint for MCP communication. Requires valid OAuth token.

#### `POST /mcp/message` 🔒
**Authentication Required**

Handles bidirectional MCP message communication.

## 🛠️ MCP Tools

The server provides 6 powerful tools for exercise data interaction:

### 1. `search_exercises`
Advanced multi-field search with relevance scoring.

**Parameters:**
- `equipment` (string, optional) - Filter by equipment type
- `category` (string, optional) - Filter by exercise category
- `primaryMuscles` (array, optional) - Filter by primary muscles
- `secondaryMuscles` (array, optional) - Filter by secondary muscles
- `bodyPart` (string, optional) - Filter by body part
- `appleCategory` (string, optional) - Filter by Apple HealthKit category
- `query` (string, optional) - Text search across names and instructions
- `limit` (number, 1-100, default: 20) - Maximum results
- `offset` (number, default: 0) - Pagination offset

**Example:**
```json
{
  "equipment": "dumbbell",
  "primaryMuscles": ["biceps"],
  "limit": 10
}
```

### 2. `get_exercise_by_id`
Retrieve specific exercise by UUID.

**Parameters:**
- `id` (string, required) - Exercise UUID

### 3. `filter_exercises_by_equipment`
Equipment-based filtering with pagination.

**Parameters:**
- `equipment` (string, required) - Equipment type
- `limit` (number, default: 20) - Maximum results
- `offset` (number, default: 0) - Pagination offset

### 4. `get_exercises_by_category`
Category-based filtering with pagination.

**Parameters:**
- `category` (string, required) - Exercise category
- `limit` (number, default: 20) - Maximum results
- `offset` (number, default: 0) - Pagination offset

### 5. `find_exercise_alternatives`
Find similar exercises targeting the same muscles.

**Parameters:**
- `exerciseId` (string, required) - ID of exercise to find alternatives for
- `targetMuscles` (array, optional) - Specific muscles to target
- `equipment` (string, optional) - Preferred equipment type
- `limit` (number, 1-50, default: 10) - Maximum alternatives

### 6. `validate_exercise_keys`
Validate that exercise IDs exist in the database.

**Parameters:**
- `exerciseIds` (array, required) - Array of exercise IDs to validate

**Response:**
```json
{
  "valid": ["uuid1", "uuid2"],
  "invalid": ["bad-uuid"],
  "totalChecked": 3,
  "validCount": 2,
  "invalidCount": 1
}
```

## 📚 MCP Resources

Access structured exercise data through 7 resource endpoints:

### 1. `exercise://all`
Paginated list of all exercises in the database.

### 2. `exercise://categories`
List of all unique exercise categories.

### 3. `exercise://equipment-types`
List of all equipment types used in exercises.

### 4. `exercise://muscle-groups`
List of all primary and secondary muscle groups.

### 5. `exercise://body-parts`
List of all targeted body parts.

### 6. `exercise://apple-categories`
List of all Apple HealthKit exercise categories.

### 7. `exercise://stats`
Database statistics and metadata.

## 📝 MCP Prompts

5 intelligent prompts for guided fitness interactions:

### 1. `create-workout-plan`
Generate personalized workout plans.

**Arguments:**
- `goals` (required) - Fitness goals (strength, cardio, flexibility, etc.)
- `equipment` (optional) - Available equipment
- `experience` (required) - Experience level (beginner, intermediate, advanced)
- `duration` (optional) - Workout duration in minutes
- `frequency` (optional) - Workouts per week

### 2. `exercise-form-guide`
Get detailed form instructions and safety tips.

**Arguments:**
- `exercise_name` (required) - Name of the exercise
- `focus_area` (optional) - Specific aspect to focus on

### 3. `muscle-group-workout`
Create focused workouts targeting specific muscle groups.

**Arguments:**
- `target_muscles` (required) - Primary muscle groups to target
- `equipment` (optional) - Available equipment
- `intensity` (optional) - Workout intensity (low, moderate, high)

### 4. `exercise-alternatives`
Find alternative exercises when you can't perform specific exercises.

**Arguments:**
- `original_exercise` (required) - Exercise to find alternatives for
- `reason` (optional) - Reason for needing alternatives
- `available_equipment` (optional) - Equipment available

### 5. `progressive-overload`
Create progressive training plans with structured advancement.

**Arguments:**
- `current_exercises` (required) - Current exercises in routine
- `current_level` (optional) - Current performance level
- `timeline` (optional) - Timeline for progression

## 💾 Database Structure

Each exercise contains:

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
    "Lie flat on your back with your knees bent...",
    "Place your hands behind your head...",
    "Engaging your abs, slowly lift your upper body..."
  ],
  "images": ["E3H0-SVdQacCFN.gif"]
}
```

### Database Statistics
- **Total Exercises:** 1,324
- **Categories:** 19 unique categories
- **Equipment Types:** 15+ types
- **Muscle Groups:** 25+ primary and secondary muscles
- **Body Parts:** 10+ targeted areas

## 🎯 Usage Examples

### Claude Web Integration

1. **Add Server to Claude:**
   - Use discovery URL: `https://your-server.com/.well-known/oauth-authorization-server`
   - Claude will auto-register and authenticate

2. **Example Queries:**
   ```
   Find me 5 bodyweight exercises for abs

   Search for dumbbell exercises targeting biceps

   Create a beginner workout plan for strength building

   Get alternatives to bench press for home workouts

   Show me proper form for deadlifts
   ```

### API Integration

```typescript
import { MCPClient } from '@modelcontextprotocol/sdk';

const client = new MCPClient({
  serverUrl: 'https://your-server.com/mcp/sse',
  authentication: {
    type: 'oauth2'
  }
});

// Search exercises
const searchResult = await client.callTool('search_exercises', {
  equipment: 'dumbbell',
  primaryMuscles: ['biceps'],
  limit: 10
});

// Get exercise details
const exercise = await client.callTool('get_exercise_by_id', {
  id: '874ce7a1-2022-449f-92c4-742c17be51bb'
});

// Use prompts
const workoutPlan = await client.getPrompt('create-workout-plan', {
  goals: 'strength building',
  experience: 'beginner',
  equipment: 'dumbbells'
});
```

## 🚀 Deployment

### Railway Deployment

1. **Connect Repository:** Link your GitHub repo to Railway
2. **Environment Variables:** Set required environment variables in Railway dashboard
3. **Deploy:** Railway will automatically deploy on push to main branch

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Configuration

```bash
# Production settings
NODE_ENV=production
PORT=3000

# Use Railway's provided domain or your custom domain
BASE_URL=https://your-domain.com

# Secure JWT secret (generate with openssl rand -hex 32)
JWT_SECRET=your-production-jwt-secret

# Production CORS origins
CORS_ORIGINS=https://claude.ai,https://*.anthropic.com
```

## 🔧 Development

### Project Structure
```
fittality-exercises-mcp/
├── src/
│   ├── index.ts              # Main server with HTTP endpoints
│   ├── mcpServer.ts          # MCP protocol implementation
│   ├── authServer.ts         # OAuth authentication
│   ├── exerciseService.ts    # Exercise business logic
│   ├── types.ts              # TypeScript interfaces
│   └── utils.ts              # Helper functions
├── data/
│   └── exercises.json        # Exercise database
├── dist/                     # Compiled TypeScript
└── README.md
```

### Scripts

```bash
npm run build    # Compile TypeScript
npm start        # Start production server
npm run dev      # Start development server with watch
npm test         # Run tests (when implemented)
npm run clean    # Clean build directory
```

### Adding New Exercises

1. **Format:** Follow the exercise schema in `src/types.ts`
2. **Validation:** All exercises are validated with Zod schemas
3. **Indexing:** Restart server to rebuild search indexes
4. **Categories:** New categories are automatically indexed

### Performance Monitoring

The server includes built-in performance monitoring:

- **Tool Execution Timing** - All MCP tool calls are timed
- **Request Logging** - Comprehensive request/response logging
- **Health Metrics** - Database statistics and service health
- **Error Tracking** - Enhanced error context and debugging

## 🔒 Security

- **OAuth 2.0** - Standard authentication for client access
- **CORS Protection** - Configurable allowed origins
- **Input Validation** - Zod schema validation for all inputs
- **Rate Limiting** - Planned for production endpoints
- **Error Sanitization** - Prevent sensitive data leakage

## 📊 Monitoring

### Health Checks
- **Endpoint:** `GET /health`
- **Database Status:** Exercise data loading and indexing
- **Service Health:** MCP connection status
- **Capabilities:** Available tools, resources, and prompts

### Logging
- **Structured Logging** - JSON formatted logs with context
- **Performance Metrics** - Operation timing and success rates
- **Error Tracking** - Detailed error context and stack traces
- **Request Tracing** - Full request lifecycle logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues:** [GitHub Issues](https://github.com/your-username/fittality-exercises-mcp/issues)
- **Documentation:** [MCP Documentation](https://modelcontextprotocol.io)
- **Discord:** [MCP Community](https://discord.gg/mcp)

## 🎉 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io) - The protocol specification
- [Anthropic](https://anthropic.com) - Claude AI integration
- Exercise database compiled from various fitness resources

---

**Built with ❤️ for the fitness and AI community**
