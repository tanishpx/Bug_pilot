import { z } from 'zod';
import { IBugDataSource } from '../data/storage.js';

export const createBugSchema = {
  title: z.string().describe('Short descriptive title of the bug'),
  description: z.string().describe('Detailed explanation of what went wrong'),
  type: z
    .enum([
      'UI',
      'Backend',
      'Performance',
      'Security',
      'Database',
      'Runtime',
      'API',
      'Other',
    ])
    .optional()
    .default('UI')
    .describe('Category of bug'),
  severity: z
    .enum(['Low', 'Medium', 'High', 'Critical'])
    .optional()
    .default('Medium')
    .describe('Severity level'),
  stepsToReproduce: z.string().optional().describe('Numbered steps to reproduce the issue'),
  environment: z.string().optional().describe('Environment context (OS, browser, app/runtime versions)'),
  reporterEmail: z.string().email().optional().describe('Email of reporter'),
  logs: z.string().optional().describe('Error message, stack traces, or console output'),
  relatedFiles: z.array(z.string()).optional().describe('List of suspected file paths related to the bug'),
};

export function registerCreateBugTool(server: any, dataSource: IBugDataSource) {
  server.tool(
    'create_bug_report',
    'File a new bug report with debugging details, reproduction steps, and error logs into the context store.',
    createBugSchema,
    async (args: any) => {
      const bug = await dataSource.create({
        title: args.title,
        description: args.description,
        type: args.type,
        severity: args.severity,
        stepsToReproduce: args.stepsToReproduce,
        environment: args.environment,
        reporterEmail: args.reporterEmail,
        logs: args.logs,
        relatedFiles: args.relatedFiles,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Bug report successfully created with ID: **${bug.id}**\n\nTitle: ${bug.title}\nSeverity: ${bug.severity}\nStatus: ${bug.status}`,
          },
        ],
      };
    }
  );
}
