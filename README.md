# Exercise Database MCP Server

A production-ready Model Context Protocol (MCP) server that provides Claude AI applications with access to a comprehensive database of 1300+ exercises through advanced search tools and resources.

## Features

- **1300+ Exercises**: Comprehensive database with detailed exercise information
- **Advanced Search**: Multi-field filtering with relevance scoring and fuzzy matching
- **Rich Metadata**: Equipment types, muscle groups, categories, and Apple HealthKit integration
- **Fast Performance**: In-memory indexes for sub-millisecond search responses
- **Web Server**: HTTP/HTTPS API with Streamable HTTP transport
- **Production Ready**: TypeScript, comprehensive error handling, and graceful shutdown

## Installation

```bash
# Clone or extract the project
cd exercise-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Start the web server
npm start
```

The server will start on `http://127.0.0.1:3000` by default.

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Clean build artifacts
npm run clean
```

## Configuration

### Environment Variables

- `PORT`: HTTP server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `EXERCISE_DATA_PATH`: Custom path to exercises.json file

### Example

```bash
# Start on custom port
PORT=8080 npm start

# Development with custom port
PORT=8080 npm run dev
```

## HTTP API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/mcp` | Main MCP communication endpoint |
| `GET` | `/mcp` | Server-sent events for notifications |
| `DELETE` | `/mcp` | Session termination |
| `GET` | `/health` | Health check and status |

### MCP Session Management

The server uses **Streamable HTTP** transport with session management:

1. **Initialize**: Send a POST request to `/mcp` with MCP initialization
2. **Session ID**: Server returns a session ID in the `mcp-session-id` header
3. **Subsequent requests**: Include the session ID in all future requests
4. **Cleanup**: Send DELETE request to terminate the session

### Example Usage

```bash
# Health check
curl http://127.0.0.1:3000/health

# Initialize MCP session
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  }'
```

## MCP Resources

The server provides the following resources accessible via the MCP protocol:

### Resources

| URI | Description |
|-----|-------------|
| `exercise://all` | Complete list of all exercises (paginated) |
| `exercise://categories` | All unique exercise categories |
| `exercise://equipment-types` | All equipment types used in exercises |
| `exercise://muscle-groups` | All muscle groups (primary and secondary) |
| `exercise://body-parts` | All body parts targeted by exercises |
| `exercise://apple-categories` | Apple HealthKit workout categories |
| `exercise://stats` | Database statistics and metadata |

### Tools

#### 1. `search_exercises`
Advanced exercise search with multiple filters and relevance scoring.

**Parameters:**
- `equipment` (string, optional): Filter by equipment type
- `category` (string, optional): Filter by exercise category
- `primaryMuscles` (string[], optional): Filter by primary muscles
- `secondaryMuscles` (string[], optional): Filter by secondary muscles
- `bodyPart` (string, optional): Filter by body part
- `appleCategory` (string, optional): Filter by Apple HealthKit category
- `query` (string, optional): Text search across names and instructions
- `limit` (number, optional): Max results (1-100, default: 20)
- `offset` (number, optional): Pagination offset (default: 0)

**Example:**
```typescript
search_exercises({
  equipment: "dumbbells",
  primaryMuscles: ["chest"],
  query: "press",
  limit: 10
})
```

#### 2. `get_exercise_by_id`
Get detailed information about a specific exercise.

**Parameters:**
- `id` (string, required): UUID of the exercise

**Example:**
```typescript
get_exercise_by_id({
  id: "874ce7a1-2022-449f-92c4-742c17be51bb"
})
```

#### 3. `filter_exercises_by_equipment`
Filter exercises by equipment type with pagination.

**Parameters:**
- `equipment` (string, required): Equipment type to filter by
- `limit` (number, optional): Max results (1-100, default: 20)
- `offset` (number, optional): Pagination offset (default: 0)

**Example:**
```typescript
filter_exercises_by_equipment({
  equipment: "body weight",
  limit: 20
})
```

#### 4. `get_exercises_by_category`
Get exercises in a specific category with pagination.

**Parameters:**
- `category` (string, required): Category to filter by
- `limit` (number, optional): Max results (1-100, default: 20)
- `offset` (number, optional): Pagination offset (default: 0)

**Example:**
```typescript
get_exercises_by_category({
  category: "abs",
  limit: 15
})
```

#### 5. `find_exercise_alternatives`
Find alternative exercises targeting similar muscles.

**Parameters:**
- `exerciseId` (string, required): UUID of the reference exercise
- `targetMuscles` (string[], optional): Specific muscles to target
- `equipment` (string, optional): Filter alternatives by equipment
- `limit` (number, optional): Max alternatives (1-50, default: 10)

**Example:**
```typescript
find_exercise_alternatives({
  exerciseId: "874ce7a1-2022-449f-92c4-742c17be51bb",
  equipment: "body weight",
  limit: 5
})
```

#### 6. `validate_exercise_keys`
Validate that exercise IDs exist in the database.

**Parameters:**
- `exerciseIds` (string[], required): Array of exercise UUIDs to validate

**Example:**
```typescript
validate_exercise_keys({
  exerciseIds: [
    "874ce7a1-2022-449f-92c4-742c17be51bb",
    "f0a9d07e-d392-49f8-af20-af48aeb1d79f"
  ]
})
```

## Exercise Data Structure

Each exercise contains the following information:

```typescript
interface Exercise {
  id: string;              // Unique UUID
  name: string;            // Exercise name
  equipment: string;       // Required equipment
  category: string;        // Exercise category
  appleCategory: string;   // Apple HealthKit category
  bodyPart: string;        // Primary body part
  primaryMuscles: string[]; // Main muscles targeted
  secondaryMuscles: string[]; // Supporting muscles
  instructions: string[];  // Step-by-step instructions
  images: string[];        // Image/GIF filenames
}
```

## Search Capabilities

### Text Search
- Searches across exercise names, instructions, and muscle groups
- Fuzzy matching handles typos and partial matches
- Relevance scoring ranks results by match quality

### Multi-field Filtering
- Combine equipment, category, muscles, and body parts
- Efficient index-based filtering for fast responses
- Supports both primary and secondary muscle targeting

### Pagination
- All search results support limit/offset pagination
- Includes `hasMore` flag for UI pagination controls
- Efficient memory usage for large result sets

## Performance

- **Cold start**: ~200ms (loading and indexing 1300 exercises)
- **Search response**: <5ms for most queries
- **Memory usage**: ~50MB for full dataset with indexes
- **HTTP server**: Express.js with async handlers
- **Concurrent sessions**: Multiple MCP sessions supported
- **Horizontal scaling**: Stateless design allows load balancing

## Error Handling

The server provides comprehensive error handling with standardized MCP error responses:

- **Invalid Parameters**: Detailed validation errors with field-specific messages
- **Not Found**: Clear messages when exercises or resources don't exist
- **Internal Errors**: Graceful handling with informative error messages
- **Service Unavailable**: Health checks and initialization status

## Data Location

By default, the server looks for exercise data in:
- `./data/exercises.json`
- `./data/availableAppleCategories.json`

## Security

- **CORS**: Configured for local development (`localhost`, `127.0.0.1`)
- **Session management**: Secure session ID generation using `crypto.randomUUID()`
- **Input validation**: All inputs validated with Zod schemas
- **Error handling**: Comprehensive error responses without information leakage

## Integration with Claude

This MCP server can be used with Claude AI applications via HTTP transport. Configure Claude to connect to:

```json
{
  "mcpServers": {
    "exercise-server": {
      "transport": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "timeout": 30000
    }
  }
}
```

Once connected, Claude can:

1. **Search for exercises** based on user requirements (equipment, goals, muscles)
2. **Get detailed exercise information** including step-by-step instructions
3. **Validate exercise selections** for workout plans
4. **Find alternative exercises** when equipment or preferences change
5. **Access categorized data** for structured workout programming

### Example Claude Interactions

**User**: "Find me some chest exercises I can do with dumbbells"

**Claude** (via MCP):
```typescript
search_exercises({
  equipment: "dumbbells",
  primaryMuscles: ["chest", "pectorals"],
  limit: 10
})
```

**User**: "What are the instructions for exercise ID 874ce7a1-2022-449f-92c4-742c17be51bb?"

**Claude** (via MCP):
```typescript
get_exercise_by_id({
  id: "874ce7a1-2022-449f-92c4-742c17be51bb"
})
```

## HTTP Client Examples

### Python
```python
import requests

# Initialize session
response = requests.post('http://127.0.0.1:3000/mcp', json={
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "python-client", "version": "1.0.0"}
    }
})

session_id = response.headers.get('mcp-session-id')

# Call tool
tool_response = requests.post('http://127.0.0.1:3000/mcp',
    headers={'mcp-session-id': session_id},
    json={
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "search_exercises",
            "arguments": {"equipment": "dumbbells", "limit": 5}
        }
    }
)
```

### JavaScript/Node.js
```javascript
const response = await fetch('http://127.0.0.1:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'js-client', version: '1.0.0' }
    }
  })
});

const sessionId = response.headers.get('mcp-session-id');
// Continue with session ID for subsequent requests...
```

## Architecture

```
exercise-mcp-server/
├── src/
│   ├── index.ts          # MCP server implementation
│   ├── types.ts          # TypeScript interfaces & schemas
│   ├── exerciseService.ts # Business logic & data management
│   └── utils.ts          # Utility functions
├── data/
│   ├── exercises.json    # Exercise database
│   └── availableAppleCategories.json
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## Health Check

The server provides health status information:

```typescript
// Server health endpoint returns:
{
  server: "running",
  exerciseService: {
    status: "healthy",
    exerciseCount: 1300,
    initialized: true
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure TypeScript compilation passes
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please refer to the project repository or contact the development team.
