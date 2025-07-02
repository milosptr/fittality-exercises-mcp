import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchExercises } from "../exercise-functions/search.js";

export function registerSearchTools(server: McpServer): void {
  // Search exercises tool
  server.tool(
    "search_exercises",
    "Search for exercises by equipment, muscle group, category, or general query",
    {
      equipment: z.string().optional(),
      category: z.string().optional(),
      primaryMuscles: z.array(z.string()).optional(),
      query: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ equipment, category, primaryMuscles, query, limit = 20 }) => {
      const results = await searchExercises({
        equipment,
        category,
        primaryMuscles,
        query,
        limit
      });
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );
}
