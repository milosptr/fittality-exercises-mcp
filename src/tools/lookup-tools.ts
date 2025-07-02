import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getExerciseById } from "../exercise-functions/loader.js";
import { validateExerciseIds } from "../exercise-functions/validation.js";

export function registerLookupTools(server: McpServer): void {
  // Get exercise by ID tool
  server.tool(
    "get_exercise",
    "Get detailed information about a specific exercise by its ID",
    {
      id: z.string(),
    },
    async ({ id }) => {
      const exercise = getExerciseById(id);
      if (!exercise) {
        return {
          content: [{ type: "text", text: `Exercise with ID "${id}" not found.` }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(exercise, null, 2) }],
      };
    }
  );

  // Validate exercise IDs tool
  server.tool(
    "validate_exercise_ids",
    "Validate that a list of exercise IDs exist in the database",
    {
      ids: z.array(z.string()),
    },
    async ({ ids }) => {
      const validation = validateExerciseIds(ids);
      return {
        content: [{ type: "text", text: JSON.stringify(validation, null, 2) }],
      };
    }
  );
}
