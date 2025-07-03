# Exercise Database MCP Server

> A production-ready Model Context Protocol (MCP) server providing comprehensive access to a database of 1,300+ exercises through Claude AI applications.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.13.3-green.svg)](https://github.com/modelcontextprotocol/sdk)
[![Express](https://img.shields.io/badge/Express-5.1.0-lightgrey.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [MCP Tools](#mcp-tools)
- [MCP Resources](#mcp-resources)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Health Monitoring](#health-monitoring)
- [Development](#development)
- [Deployment](#deployment)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The Exercise Database MCP Server is a comprehensive fitness data service that provides Claude AI applications with access to over 1,300 exercises through the Model Context Protocol. Built with TypeScript and Express, it offers advanced search capabilities, health monitoring, and performance tracking.

### What is MCP?

The [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/docs) is a standard for connecting AI applications with external data sources and tools. This server implements MCP to provide Claude with seamless access to exercise data.

### Key Capabilities

- 🔍 **Advanced Search** - Multi-field exercise search with filtering and pagination
- 📊 **Health Monitoring** - Real-time database health and performance metrics
- 🎯 **Exercise Recommendations** - Find alternative exercises based on equipment and muscle groups
- 📋 **Data Validation** - Exercise ID validation and database integrity checks
- 🚀 **Production Ready** - Built for scale with comprehensive error handling

## ✨ Features

### Exercise Database
- **1,324 exercises** with comprehensive metadata
- **10 equipment types** (body weight, dumbbells, barbells, etc.)
- **15+ exercise categories** (chest, back, legs, abs, etc.)
- **50+ muscle groups** for targeted workouts
- **Apple HealthKit integration** with proper categories

### Search & Filtering
- **Text search** across exercise names and instructions
- **Equipment filtering** for available gym equipment
- **Category filtering** by muscle groups and body parts
- **Multi-criteria search** with pagination support
- **Relevance scoring** for optimal search results

### Health & Monitoring
- **Real-time health checks** with detailed status reporting
- **Performance metrics** tracking search latency and memory usage
- **Database integrity validation** checking for duplicates and missing fields
- **System information** reporting Node.js and runtime details

### MCP Integration
- **11 MCP tools** for comprehensive exercise access
- **4 MCP resources** for direct data access
- **SSE transport** over HTTP for real-time communication
- **Zod schema validation** for type safety

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd fittality-exercises-mcp

# Install dependencies
pnpm install

# Build the project
pnpm build

# Start the server
pnpm dev
```

The server will start on `http://localhost:8080` with health checks at `/health`.

## 📦 Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (or npm/yarn)
- **TypeScript** 5.8+ (included in dev dependencies)

### Environment Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd fittality-exercises-mcp
   pnpm install
   ```

2. **Configure environment (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the project:**
   ```bash
   pnpm build
   ```

4. **Start the server:**
   ```bash
   # Development mode (with hot reload)
   pnpm dev

   # Production mode
   node dist/main.js
   ```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `JWT_SECRET` | - | JWT secret for authentication (if needed) |

## 🎮 Usage

### Claude Desktop Integration

Add this server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "exercise-database": {
      "command": "node",
      "args": ["/path/to/fittality-exercises-mcp/dist/main.js"],
      "env": {
        "PORT": "8080"
      }
    }
  }
}
```

### Claude Web Integration (OAuth 2.0)

The server supports OAuth 2.0 for Claude Web integration. When deployed, Claude Web can connect using these OAuth endpoints:

#### OAuth Endpoints

- **OAuth Metadata**: `/.well-known/oauth-authorization-server`
- **Authorization**: `/authorize`
- **Token Exchange**: `/token`
- **Token Revocation**: `/revoke`

#### OAuth Configuration

Set these environment variables for secure operation:

```bash
CLAUDE_CLIENT_SECRET=your-secure-secret-here
BASE_URL=https://your-deployed-server.com
```

#### Protected MCP Endpoints

Claude Web accesses MCP functionality through OAuth-protected endpoints:

- **SSE Connection**: `/mcp/sse` (requires Bearer token)
- **Message Handling**: `/mcp/messages` (requires Bearer token)

#### OAuth Flow

1. Claude Web redirects to `/authorize?client_id=claude-web&response_type=code`
2. Server auto-approves and redirects back with authorization code
3. Claude Web exchanges code for access token at `/token`
4. Access token authenticates subsequent MCP requests

**OAuth Features:**
- Authorization Code flow
- Bearer token authentication
- 1-hour token expiration
- Token revocation support
- Pre-configured for Claude Web client

### Basic Examples

#### Search for exercises
```
Find me some chest exercises using dumbbells
```

#### Get exercise alternatives
```
I want alternatives to push-ups that use body weight
```

#### Validate exercise IDs
```
Check if these exercise IDs are valid: 874ce7a1-2022-449f-92c4-742c17be51bb
```

#### Get database statistics
```
Show me statistics about the exercise database
```

## 🛠️ MCP Tools

The server provides 11 comprehensive MCP tools:

### Core Exercise Tools

#### `search_exercises`
Search exercises with multiple criteria and pagination.

**Parameters:**
- `query` (string, optional) - Text search across names and instructions
- `equipment` (string, optional) - Filter by equipment type
- `category` (string, optional) - Filter by exercise category
- `primaryMuscles` (array, optional) - Filter by primary muscle groups
- `secondaryMuscles` (array, optional) - Filter by secondary muscle groups
- `limit` (number, optional) - Results per page (default: 20, max: 100)
- `offset` (number, optional) - Results offset for pagination

**Example:**
```json
{
  "name": "search_exercises",
  "arguments": {
    "equipment": "body weight",
    "category": "chest",
    "limit": 10
  }
}
```

#### `get_exercise_by_id`
Retrieve a specific exercise by its unique ID.

**Parameters:**
- `id` (string, required) - Exercise UUID

#### `find_exercise_alternatives`
Find alternative exercises based on the target exercise.

**Parameters:**
- `exerciseId` (string, required) - Target exercise ID
- `equipment` (string, optional) - Preferred equipment for alternatives
- `limit` (number, optional) - Number of alternatives (default: 5)

### Filtering Tools

#### `filter_exercises_by_equipment`
Get exercises filtered by specific equipment.

**Parameters:**
- `equipment` (string, required) - Equipment type
- `limit` (number, optional) - Results limit
- `offset` (number, optional) - Results offset

#### `get_exercises_by_category`
Get exercises filtered by category.

**Parameters:**
- `category` (string, required) - Exercise category
- `limit` (number, optional) - Results limit
- `offset` (number, optional) - Results offset

### Validation Tools

#### `validate_exercise_keys`
Validate multiple exercise IDs at once.

**Parameters:**
- `exerciseIds` (array, required) - Array of exercise IDs to validate

### Metadata Tools

#### `get_categories`
Get all available exercise categories.

#### `get_equipment_types`
Get all available equipment types.

#### `get_muscle_groups`
Get all available muscle groups.

### Health Monitoring Tools

#### `get_database_health`
Get comprehensive database health status.

#### `get_database_stats`
Get detailed database statistics.

**Parameters:**
- `limit` (number, optional) - Limit for category breakdowns
- `offset` (number, optional) - Offset for pagination

#### `get_performance_metrics`
Get real-time performance metrics.

#### `validate_database_integrity`
Validate database integrity and check for issues.

**Parameters:**
- `limit` (number, optional) - Limit for duplicate checks
- `offset` (number, optional) - Offset for pagination

#### `get_system_info`
Get system and runtime information.

#### `reset_performance_metrics`
Reset performance tracking metrics.

## 📚 MCP Resources

The server provides 4 MCP resources for direct data access:

### `exercise://{id}`
Direct access to individual exercises by ID.

**Example:** `exercise://874ce7a1-2022-449f-92c4-742c17be51bb`

### `exercise://stats`
Database statistics and metrics.

### `exercise://health`
Real-time health status information.

### `exercise://performance`
Performance metrics and monitoring data.

## 📖 API Reference

### Exercise Data Structure

```typescript
interface Exercise {
  id: string;                    // UUID identifier
  name: string;                  // Exercise name
  equipment: string;             // Required equipment
  category: string;              // Exercise category
  appleCategory: string;         // Apple HealthKit category
  bodyPart: string;              // Target body part
  primaryMuscles: string[];      // Primary muscle groups
  secondaryMuscles: string[];    // Secondary muscle groups
  instructions: string[];        // Step-by-step instructions
  images: string[];              // Exercise images/GIFs
}
```

### Health Check Endpoint

**GET** `/health`

Returns server health status and basic metrics.

**Response:**
```json
{
  "status": "healthy",
  "service": "Exercise Database MCP Server",
  "version": "1.0.0",
  "exerciseCount": 1324,
  "timestamp": "2025-07-02T22:42:18.406Z"
}
```

### SSE Endpoint

**GET** `/sse`

Establishes Server-Sent Events connection for MCP communication.

### Messages Endpoint

**POST** `/messages`

Handles MCP message processing over HTTP.

## 🏗️ Architecture

### Project Structure

```
fittality-exercises-mcp/
├── src/
│   ├── main.ts                     # Server entry point
│   ├── types.ts                    # TypeScript interfaces
│   ├── exercise-functions/         # Business logic
│   │   ├── loader.ts              # Data loading & retrieval
│   │   ├── search.ts              # Search & filtering
│   │   ├── validation.ts          # ID validation
│   │   ├── alternatives.ts        # Exercise alternatives
│   │   ├── metadata.ts            # Categories & equipment
│   │   ├── health.ts              # Health monitoring
│   │   └── performance.ts         # Performance tracking
│   └── tools/                     # MCP tool implementations
│       ├── search-tools.ts        # Search functionality
│       ├── lookup-tools.ts        # ID lookups & validation
│       ├── filter-tools.ts        # Filtering tools
│       ├── metadata-tools.ts      # Resource listings
│       └── health-tools.ts        # Health monitoring
├── data/
│   └── exercises.json             # Exercise database (1.2MB)
├── dist/                          # Compiled JavaScript
├── package.json                   # Project configuration
├── tsconfig.json                  # TypeScript configuration
└── .env                           # Environment variables
```

### Technology Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.8.3
- **Web Framework:** Express 5.1.0
- **MCP SDK:** @modelcontextprotocol/sdk 1.13.3
- **Validation:** Zod 3.25.69
- **Transport:** Server-Sent Events (SSE)
- **Build Tool:** TypeScript Compiler
- **Package Manager:** pnpm

### Design Patterns

- **Domain-Driven Design** - Functions organized by business domain
- **Separation of Concerns** - Clear separation between MCP tools and business logic
- **Factory Pattern** - Tool registration and server configuration
- **Observer Pattern** - SSE event streaming
- **Strategy Pattern** - Multiple search and filtering strategies

## 🏥 Health Monitoring

### Health Check

The server provides comprehensive health monitoring:

```bash
curl http://localhost:8080/health
```

### Performance Metrics

Track key performance indicators:

- **Search Latency** - Average search response time
- **Memory Usage** - Current memory consumption
- **Request Count** - Total processed requests
- **Error Rate** - Failed request percentage

### Database Integrity

Regular integrity checks include:

- **Duplicate Detection** - Find duplicate exercise entries
- **Missing Fields** - Validate required field presence
- **Data Consistency** - Check referential integrity
- **Schema Validation** - Ensure proper data types

### Monitoring Tools

Use the built-in MCP tools for monitoring:

```javascript
// Get health status
get_database_health()

// Get performance metrics
get_performance_metrics()

// Validate database integrity
validate_database_integrity()

// Get system information
get_system_info()
```

## 🛠️ Development

### Setup Development Environment

```bash
# Clone and install
git clone <repository-url>
cd fittality-exercises-mcp
pnpm install

# Start development server with hot reload
pnpm dev
```

### Available Scripts

```bash
# Build the project
pnpm build

# Start development server
pnpm dev

# Run in production mode
node dist/main.js

# Type checking
tsc --noEmit

# Format code (if prettier is configured)
pnpm format
```

### Adding New Tools

1. **Create tool function** in appropriate domain file under `src/exercise-functions/`
2. **Add MCP tool** in corresponding file under `src/tools/`
3. **Register tool** in `src/main.ts`
4. **Update types** in `src/types.ts` if needed
5. **Add tests** and documentation

Example:

```typescript
// src/exercise-functions/my-feature.ts
export function myNewFunction(params: MyParams): MyResult {
  // Implementation
}

// src/tools/my-tools.ts
export function registerMyTools(server: McpServer) {
  server.tool("my_new_tool", {
    description: "Does something useful",
    inputSchema: {
      type: "object",
      properties: {
        param: { type: "string" }
      }
    }
  }, async (request) => {
    // Tool implementation
  });
}
```

### Code Style

- **TypeScript strict mode** enabled
- **ESM modules** throughout
- **Functional programming** patterns preferred
- **Comprehensive error handling** required
- **Zod validation** for all inputs

### Testing

While formal tests aren't included, validate functionality using:

```bash
# Health check
curl http://localhost:8080/health

# Manual MCP testing via Claude Desktop
# Or create custom test scripts
```

## 🚀 Deployment

### Production Build

```bash
# Clean build
rm -rf dist/
pnpm build

# Verify build
ls -la dist/
```

### Railway Deployment

The project includes a pre-configured `railway.toml` file for easy deployment:

1. **Deploy directly:**
   ```bash
   railway login
   railway link
   railway deploy
   ```

The `railway.toml` configuration includes:
- **Nixpacks builder** for Node.js projects
- **Automatic TypeScript compilation** with `pnpm build`
- **Health checks** on `/health` endpoint
- **Zero-downtime deployments** with overlap and draining settings
- **Environment-specific configurations** for production and staging
- **Smart watch patterns** to trigger rebuilds only when needed

2. **Alternative JSON configuration:**
   A `railway.json` file is also provided for teams preferring JSON format.

### Heroku Deployment

1. **Create `Procfile`:**
   ```
   web: node dist/main.js
   ```

2. **Deploy:**
   ```bash
   heroku create your-app-name
   git push heroku main
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY data/ ./data/

EXPOSE 8080
CMD ["node", "dist/main.js"]
```

### Environment Configuration

Production environment variables:

```bash
NODE_ENV=production
PORT=8080
```

### Health Monitoring in Production

Monitor these endpoints:

- **Health:** `GET /health` - Basic health check
- **SSE:** `GET /sse` - MCP connectivity
- **Performance:** Use MCP tools for detailed metrics

## ⚡ Performance

### Benchmarks

- **Exercise Loading:** < 2 seconds (1,324 exercises)
- **Search Response:** < 100ms (typical queries)
- **Memory Usage:** < 200MB (production)
- **Concurrent Users:** 100+ (depends on hardware)

### Optimization Features

- **Efficient Data Structures** - In-memory arrays for fast access
- **Lazy Loading** - Resources loaded on demand
- **Request Caching** - Built-in Express caching
- **Pagination** - Prevent large result sets
- **Performance Tracking** - Real-time metrics

### Scaling Considerations

- **Horizontal Scaling:** Multiple server instances
- **Load Balancing:** Distribute requests across instances
- **Database Caching:** Redis for frequently accessed data
- **CDN Integration:** Serve exercise images from CDN

## 🔧 Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check Node.js version
node --version  # Should be 18+

# Verify build
pnpm build

# Check port availability
lsof -i :8080
```

#### Exercise Data Not Loading
```bash
# Verify file exists
ls -la data/exercises.json

# Check JSON validity
jq . data/exercises.json > /dev/null
```

#### MCP Connection Issues
```bash
# Verify SSE endpoint
curl -N http://localhost:8080/sse

# Check health endpoint
curl http://localhost:8080/health
```

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development pnpm dev
```

### Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review server logs for error messages
3. Verify all dependencies are installed correctly
4. Test with the health endpoint first

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Process

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes with proper TypeScript types
4. **Test** your changes thoroughly
5. **Document** any new features or APIs
6. **Submit** a pull request

### Code Standards

- **TypeScript** strict mode compliance
- **ESM** module format
- **Comprehensive** error handling
- **Zod** validation for all inputs
- **Clear** function and variable naming

### Adding Features

When adding new features:

1. **Update types** in `src/types.ts`
2. **Add business logic** in appropriate `exercise-functions/` file
3. **Create MCP tools** in corresponding `tools/` file
4. **Register tools** in `src/main.ts`
5. **Update documentation** in README.md

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Model Context Protocol** team for the excellent MCP SDK
- **Exercise database** contributors for comprehensive exercise data
- **TypeScript** team for excellent tooling
- **Express.js** team for reliable web framework
- **Zod** team for runtime type validation

## 📞 Support

For questions, issues, or contributions:

- **Issues:** GitHub Issues
- **Documentation:** This README and inline code comments
- **Health Check:** `http://localhost:8080/health`

---

**Built with ❤️ for the fitness and AI community**

*Last updated: July 2025*
