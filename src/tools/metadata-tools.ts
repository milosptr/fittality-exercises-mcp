import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getExerciseCategories,
  getEquipmentTypes,
  getMuscleGroups,
  getBodyParts
} from "../exercise-functions/metadata.js";

export function registerMetadataTools(server: McpServer): void {
  // Get exercise categories tool
  server.tool(
    "get_categories",
    "Get all available exercise categories",
    {},
    async () => {
      const categories = getExerciseCategories();
      return {
        content: [{ type: "text", text: JSON.stringify(categories, null, 2) }],
      };
    }
  );

  // Get equipment types tool
  server.tool(
    "get_equipment_types",
    "Get all available equipment types",
    {},
    async () => {
      const equipment = getEquipmentTypes();
      return {
        content: [{ type: "text", text: JSON.stringify(equipment, null, 2) }],
      };
    }
  );

  // Get muscle groups tool
  server.tool(
    "get_muscle_groups",
    "Get all available muscle groups (primary and secondary)",
    {},
    async () => {
      const muscles = getMuscleGroups();
      return {
        content: [{ type: "text", text: JSON.stringify(muscles, null, 2) }],
      };
    }
  );

  // Get body parts tool
  server.tool(
    "get_body_parts",
    "Get all available body parts targeted by exercises",
    {},
    async () => {
      const bodyParts = getBodyParts();
      return {
        content: [{ type: "text", text: JSON.stringify(bodyParts, null, 2) }],
      };
    }
  );
}
