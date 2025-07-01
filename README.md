# Exercise MCP Server

A production-ready Model Context Protocol (MCP) server providing Claude AI applications with access to a comprehensive database of 1300+ exercises. Compatible with both Claude web integrations and Claude API calls.

## Features

### 🏋️ Exercise Database
- **1300+ exercises** with detailed instructions and metadata
- **Multi-field search** with relevance scoring
- **Equipment-based filtering** (body weight, barbell, dumbbell, etc.)
- **Muscle group targeting** (primary and secondary muscles)
- **Apple HealthKit integration** with category mapping

### 🔗 MCP Integration
- **Complete MCP implementation** with all required tools and resources
- **SSE (Server-Sent Events) transport** for web browser compatibility
- **OAuth-compatible authentication** for Claude web integration
- **Real-time search and filtering** capabilities

### 🚀 Production Ready
- **Railway deployment compatible** with auto-scaling
- **Health monitoring** with detailed status endpoints
- **Graceful shutdown** handling
- **Comprehensive error handling** and logging
- **Performance optimized** with sub-100ms response times

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd exercise-mcp-server
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Build and start:**
```bash
npm run build
npm start
```

For development:
```bash
npm run dev
```

### Configuration

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGINS=https://claude.ai,https://*.anthropic.com,http://localhost:3000

# Authentication
JWT_SECRET=your-secret-key-here-change-in-production

# Data Configuration
EXERCISE_DATA_PATH=./data/exercises.json

# OAuth Configuration
OAUTH_CLIENT_ID_PREFIX=exercise-mcp-client
OAUTH_TOKEN_EXPIRY=86400
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status and statistics.

### OAuth Endpoints
```
GET /.well-known/oauth-authorization-server  # Discovery
POST /oauth/register                         # Client registration
GET /oauth/authorize                         # Authorization
POST /oauth/token                           # Token exchange
```

### MCP Endpoints
```
GET /mcp/sse                                # SSE transport for MCP
POST /mcp/message                           # Message handler
```

## MCP Tools

### `search_exercises`
Advanced multi-field search with relevance scoring.

**Parameters:**
- `equipment` (string, optional): Filter by equipment type
- `category` (string, optional): Filter by exercise category
- `primaryMuscles` (array, optional): Filter by primary muscles
- `secondaryMuscles` (array, optional): Filter by secondary muscles
- `bodyPart` (string, optional): Filter by body part
- `appleCategory` (string, optional): Filter by Apple HealthKit category
- `query` (string, optional): Text search across names and instructions
- `limit` (number, optional): Max results (1-100, default 20)
- `offset` (number, optional): Pagination offset (default 0)

### `get_exercise_by_id`
Retrieve specific exercise by UUID.

**Parameters:**
- `id` (string, required): Exercise UUID

### `filter_exercises_by_equipment`
Equipment-based filtering of exercises.

**Parameters:**
- `equipment` (string, required): Equipment type
- `limit` (number, optional): Max results (default 20)
- `offset` (number, optional): Pagination offset (default 0)

### `get_exercises_by_category`
Category-based filtering of exercises.

**Parameters:**
- `category` (string, required): Exercise category
- `limit` (number, optional): Max results (default 20)
- `offset` (number, optional): Pagination offset (default 0)

### `find_exercise_alternatives`
Find similar exercises targeting same muscles.

**Parameters:**
- `exerciseId` (string, required): Exercise ID to find alternatives for
- `targetMuscles` (array, optional): Specific muscles to target
- `equipment` (string, optional): Preferred equipment type
- `limit` (number, optional): Max alternatives (default 10)

### `validate_exercise_keys`
Validate that exercise IDs exist in database.

**Parameters:**
- `exerciseIds` (array, required): Array of exercise IDs to validate

## MCP Resources

### `exercise://all`
Paginated list of all exercises in the database.

### `exercise://categories`
List of all unique exercise categories.

### `exercise://equipment-types`
List of all equipment types used in exercises.

### `exercise://muscle-groups`
List of all primary and secondary muscle groups.

### `exercise://body-parts`
List of all targeted body parts.

### `exercise://apple-categories`
List of all Apple HealthKit exercise categories.

### `exercise://stats`
Statistics about the exercise database.

## Claude Integration

### Web Integration

1. **Register your MCP server** with Claude:
   - Discovery URL: `https://your-server.com/.well-known/oauth-authorization-server`
   - The server will handle OAuth registration automatically

2. **Use in Claude conversations:**
   ```
   Find me 5 bodyweight exercises for abs
   Search for dumbbell exercises targeting biceps
   Get alternatives to exercise ID 874ce7a1-2022-449f-92c4-742c17be51bb
   ```

### API Integration

```typescript
import { MCPClient } from '@modelcontextprotocol/sdk';

const client = new MCPClient({
  serverUrl: 'https://your-server.com/mcp/sse',
  authentication: {
    type: 'oauth2',
    // Server handles OAuth flow automatically
  }
});

// Search exercises
const searchResult = await client.callTool('search_exercises', {
  equipment: 'dumbbell',
  primaryMuscles: ['biceps'],
  limit: 10
});
```

## Deployment

### Railway

1. **Connect your GitHub repository** to Railway
2. **Set environment variables** in Railway dashboard
3. **Deploy automatically** on push to main branch

The server is optimized for Railway with:
- PORT environment variable support
- Health check endpoint
- Graceful shutdown handling
- Auto-scaling compatibility

### Docker

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

## Development

### Scripts

```bash
npm run dev        # Development with hot reload
npm run build      # Compile TypeScript
npm run start      # Start production server
npm run test       # Run tests
npm run lint       # Lint code
npm run clean      # Clean build artifacts
```

### Project Structure

```
exercise-mcp-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── mcpServer.ts          # MCP protocol implementation
│   ├── authServer.ts         # OAuth authentication
│   ├── exerciseService.ts    # Exercise business logic
│   ├── types.ts              # TypeScript interfaces
│   └── utils.ts              # Helper functions
├── data/
│   └── exercises.json        # Exercise database
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Testing

```bash
# Test OAuth flow
curl -X POST http://localhost:3000/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"client_name": "Test Client"}'

# Test health endpoint
curl http://localhost:3000/health

# Test MCP discovery
curl http://localhost:3000/.well-known/oauth-authorization-server
```

## Performance

- **Sub-100ms response times** for most operations
- **Efficient indexing** for fast search and filtering
- **Pagination support** for large result sets
- **Memory-optimized** data structures
- **Caching** for frequently accessed data

## Security

- **OAuth 2.0 compliant** authentication
- **JWT tokens** with configurable expiration
- **CORS protection** with whitelist origins
- **Input validation** using Zod schemas
- **Rate limiting** on authentication endpoints

## Monitoring

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "mcp": "connected",
    "exercises": "healthy",
    "database": {
      "totalExercises": 1300,
      "categoriesLoaded": 15,
      "lastUpdated": "2024-01-01T00:00:00.000Z"
    }
  },
  "endpoints": {
    "mcp_sse": "/mcp/sse",
    "oauth_discovery": "/.well-known/oauth-authorization-server",
    "registration": "/oauth/register"
  }
}
```

## Troubleshooting

### Common Issues

**CORS errors with Claude web:**
- Ensure `https://claude.ai` is in CORS_ORIGINS
- Check OAuth discovery endpoint returns valid JSON

**MCP connection fails:**
- Verify authentication token is valid
- Check server logs for detailed error messages
- Ensure SSE transport is properly configured

**Exercise data not loading:**
- Verify EXERCISE_DATA_PATH points to valid JSON file
- Check file permissions and format
- Review startup logs for data validation errors

### Debugging

Enable verbose logging:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review server logs for detailed error information
