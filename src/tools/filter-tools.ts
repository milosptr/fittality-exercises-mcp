import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { filterByEquipment, filterByCategory } from "../exercise-functions/search.js";
import { findAlternatives } from "../exercise-functions/alternatives.js";

export function registerFilterTools(server: McpServer): void {
  // Find alternative exercises tool
  server.tool(
    "find_alternatives",
    "Find alternative exercises that target similar muscle groups",
    {
      exerciseId: z.string(),
      limit: z.number().optional(),
    },
    async ({ exerciseId, limit = 5 }) => {
      const alternatives = findAlternatives(exerciseId, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(alternatives, null, 2) }],
      };
    }
  );

  // Filter by equipment tool
  server.tool(
    "filter_by_equipment",
    "Filter exercises by specific equipment type",
    {
      equipment: z.string(),
      limit: z.number().optional(),
    },
    async ({ equipment, limit = 20 }) => {
      const results = filterByEquipment(equipment);
      const limitedResults = limit ? results.slice(0, limit) : results;
      return {
        content: [{ type: "text", text: JSON.stringify(limitedResults, null, 2) }],
      };
    }
  );

  // Filter by category tool
  server.tool(
    "filter_by_category",
    "Filter exercises by specific category",
    {
      category: z.string(),
      limit: z.number().optional(),
    },
    async ({ category, limit = 20 }) => {
      const results = filterByCategory(category);
      const limitedResults = limit ? results.slice(0, limit) : results;
      return {
        content: [{ type: "text", text: JSON.stringify(limitedResults, null, 2) }],
      };
    }
  );
}
