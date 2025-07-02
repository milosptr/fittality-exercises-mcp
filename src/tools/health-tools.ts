import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabaseHealth, getDatabaseStats, getSystemInfo } from "../exercise-functions/health.js";
import { getPerformanceMetrics, validateDatabaseIntegrity, resetPerformanceMetrics } from "../exercise-functions/performance.js";

export function registerHealthTools(server: McpServer): void {
  // Get database health status
  server.tool(
    "get_database_health",
    "Get the overall health status of the exercise database including load status and errors",
    {},
    async () => {
      const health = getDatabaseHealth();
      return {
        content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
      };
    }
  );

  // Get database statistics
  server.tool(
    "get_database_stats",
    "Get comprehensive statistics about exercises, categories, equipment, and muscle groups",
    {
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async ({ limit, offset }) => {
      const stats = getDatabaseStats();

      // Apply limit and offset to list data if specified
      if (limit !== undefined || offset !== undefined) {
        const startIdx = offset || 0;
        const endIdx = limit ? startIdx + limit : undefined;

        stats.categories.list = stats.categories.list.slice(startIdx, endIdx);
        stats.equipment.list = stats.equipment.list.slice(startIdx, endIdx);
        stats.muscleGroups.primary = stats.muscleGroups.primary.slice(startIdx, endIdx);
        stats.muscleGroups.secondary = stats.muscleGroups.secondary.slice(startIdx, endIdx);
        stats.bodyParts.list = stats.bodyParts.list.slice(startIdx, endIdx);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      };
    }
  );

  // Get performance metrics
  server.tool(
    "get_performance_metrics",
    "Get search performance metrics, memory usage, and system performance data",
    {},
    async () => {
      const metrics = getPerformanceMetrics();
      return {
        content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }],
      };
    }
  );

  // Validate database integrity
  server.tool(
    "validate_database_integrity",
    "Check database integrity for missing fields, duplicates, and data validation issues",
    {
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async ({ limit, offset }) => {
      const report = validateDatabaseIntegrity();

      // Apply limit and offset to error arrays if specified
      if (limit !== undefined || offset !== undefined) {
        const startIdx = offset || 0;
        const endIdx = limit ? startIdx + limit : undefined;

        report.errors = report.errors.slice(startIdx, endIdx);
        report.duplicateIds = report.duplicateIds.slice(startIdx, endIdx);
        report.missingFields = report.missingFields.slice(startIdx, endIdx);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      };
    }
  );

  // Get system information
  server.tool(
    "get_system_info",
    "Get system information including memory usage, uptime, Node.js version, and platform details",
    {},
    async () => {
      const systemInfo = getSystemInfo();
      return {
        content: [{ type: "text", text: JSON.stringify(systemInfo, null, 2) }],
      };
    }
  );

  // Reset performance metrics
  server.tool(
    "reset_performance_metrics",
    "Reset all performance tracking metrics and counters",
    {},
    async () => {
      resetPerformanceMetrics();
      return {
        content: [{ type: "text", text: JSON.stringify({
          success: true,
          message: "Performance metrics have been reset",
          timestamp: new Date().toISOString()
        }, null, 2) }],
      };
    }
  );
}
