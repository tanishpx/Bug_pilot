import { z } from 'zod';
import { IBugDataSource } from '../data/storage.js';

export const updateBugStatusSchema = {
  bugId: z.string().describe('ID of the bug report (e.g. BUG-101)'),
  status: z
    .enum([
      'New',
      'Open',
      'Triaged',
      'Assigned',
      'In Progress',
      'Resolved',
      'Fixed',
      'Retest',
      'Closed',
      'Reopened',
      'Accepted',
      'Rejected',
    ])
    .describe('New status for the bug'),
};

export function registerUpdateBugStatusTool(server: any, dataSource: IBugDataSource) {
  server.tool(
    'update_bug_status',
    'Update the lifecycle status of a bug report (e.g. marking as In Progress or Resolved).',
    updateBugStatusSchema,
    async ({ bugId, status }: { bugId: string; status: any }) => {
      const updatedBug = await dataSource.updateStatus(bugId, status);

      if (!updatedBug) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Bug with ID "${bugId}" was not found.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Bug **${bugId}** status updated to: **${status}**`,
          },
        ],
      };
    }
  );
}
