import { z } from 'zod';
import { IBugDataSource } from '../data/storage.js';

export const investigateBugPromptSchema = {
  bugId: z.string().describe('ID of the bug report to investigate (e.g. BUG-101)'),
};

export function registerInvestigateBugPrompt(server: any, dataSource: IBugDataSource) {
  server.prompt(
    'investigate_bug',
    'Guided AI workflow prompt for conducting an in-depth root cause analysis on a bug report.',
    investigateBugPromptSchema,
    async ({ bugId }: { bugId: string }) => {
      const bug = await dataSource.getById(bugId);

      const bugSummary = bug
        ? `Bug ID: ${bug.id}\nTitle: ${bug.title}\nSeverity: ${bug.severity}\nDescription: ${bug.description}\nSteps to Reproduce: ${bug.stepsToReproduce}\nLogs: ${bug.logs || 'None'}\nRelated Files: ${(bug.relatedFiles || []).join(', ') || 'None'}`
        : `Bug ID: ${bugId} (Not yet loaded, please fetch via get_bug_context)`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                `You are an expert software engineer and debugger investigating a reported issue in Bug Pilot.`,
                ``,
                `### Target Bug Report:`,
                bugSummary,
                ``,
                `### Your Objective:`,
                `1. Review the bug reproduction steps, environment, and error logs above.`,
                `2. Formulate 2-3 plausible hypotheses for the root cause.`,
                `3. Identify the exact files or functions in the codebase that require inspection.`,
                `4. Propose a robust fix and specify any edge cases or automated tests that should be added.`,
                `5. Log your findings and hypothesis using the \`add_investigation_note\` tool.`,
              ].join('\n'),
            },
          },
        ],
      };
    }
  );
}
