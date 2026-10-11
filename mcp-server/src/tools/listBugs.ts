import { z } from 'zod';
import { IBugDataSource } from '../data/storage.js';

export const listBugsSchema = {
  status: z
    .enum(['New', 'Reviewed', 'Accepted', 'Rejected', 'In Progress', 'Resolved'])
    .optional()
    .describe('Filter bugs by lifecycle status'),
  severity: z
    .enum(['Low', 'Medium', 'High', 'Critical'])
    .optional()
    .describe('Filter bugs by severity level'),
  type: z
    .enum(['UI', 'Backend', 'Performance', 'Security', 'Database', 'Other'])
    .optional()
    .describe('Filter bugs by category/type'),
  search: z
    .string()
    .optional()
    .describe('Search term to match across title, description, or logs'),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe('Maximum number of bugs to return (default: 20)'),
};

export function registerListBugsTool(server: any, dataSource: IBugDataSource) {
  server.tool(
    'list_bugs',
    'List and filter bug reports with status, severity, and search keywords to find issues needing investigation.',
    listBugsSchema,
    async (args: any) => {
      const bugs = await dataSource.getAll({
        status: args.status,
        severity: args.severity,
        type: args.type,
        search: args.search,
        limit: args.limit || 20,
      });

      if (bugs.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No bug reports matched the specified criteria.',
            },
          ],
        };
      }

      const summary = bugs.map((b) => {
        return [
          `### [${b.id}] ${b.title}`,
          `- **Status**: ${b.status} | **Severity**: ${b.severity} | **Type**: ${b.type}`,
          `- **Description**: ${b.description.slice(0, 150)}${b.description.length > 150 ? '...' : ''}`,
          `- **Has Logs**: ${b.logs ? 'Yes' : 'No'} | **Notes Count**: ${b.investigationNotes?.length || 0}`,
        ].join('\n');
      }).join('\n\n---\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${bugs.length} bug report(s):\n\n${summary}`,
          },
        ],
      };
    }
  );
}
