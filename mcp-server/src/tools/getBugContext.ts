import { z } from 'zod';
import { IBugDataSource } from '../data/storage.js';

export const getBugContextSchema = {
  bugId: z.string().describe('The ID of the bug report to investigate (e.g. BUG-101)'),
};

export function registerGetBugContextTool(server: any, dataSource: IBugDataSource) {
  server.tool(
    'get_bug_context',
    'Retrieve rich, AI-optimized debugging context for a specific bug report (reproduction steps, logs, environment, related files, and prior notes).',
    getBugContextSchema,
    async ({ bugId }: { bugId: string }) => {
      const bug = await dataSource.getById(bugId);

      if (!bug) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Bug with ID "${bugId}" was not found. Use "list_bugs" to see available bugs.`,
            },
          ],
        };
      }

      const formattedContext = [
        `# Bug Context: [${bug.id}] ${bug.title}`,
        '',
        `**Status**: ${bug.status} | **Severity**: ${bug.severity} | **Type**: ${bug.type}`,
        `**Reported At**: ${bug.createdAt} | **Last Updated**: ${bug.updatedAt}`,
        bug.reporterEmail ? `**Reporter**: ${bug.reporterEmail}` : '',
        '',
        '## Description',
        bug.description,
        '',
        '## Reproduction Steps',
        bug.stepsToReproduce || '_No specific reproduction steps provided._',
        '',
        '## Environment',
        bug.environment || '_No environment details provided._',
        '',
        '## Error Logs & Traces',
        bug.logs ? `\`\`\`text\n${bug.logs}\n\`\`\`` : '_No error logs attached._',
        '',
        '## Suspected Files / Impact Area',
        bug.relatedFiles && bug.relatedFiles.length > 0
          ? bug.relatedFiles.map(f => `- \`${f}\``).join('\n')
          : '_No related files specified._',
        '',
        '## Prior Investigation Notes & Hypotheses',
        bug.investigationNotes && bug.investigationNotes.length > 0
          ? bug.investigationNotes
              .map(
                (n) =>
                  `### Note by ${n.author} (${n.timestamp})\n` +
                  (n.hypothesis ? `**Hypothesis**: ${n.hypothesis}\n\n` : '') +
                  `**Details**: ${n.details}\n` +
                  (n.suggestedFix ? `\n**Suggested Fix**: ${n.suggestedFix}` : '')
              )
              .join('\n\n---\n\n')
          : '_No investigation notes recorded yet._',
        '',
        '## AI Investigation Checklist',
        '1. Inspect the stack trace and identify the exact line of failure.',
        '2. Verify if input parameters or state variables could be undefined or null.',
        '3. Check related files to understand the control flow.',
        '4. Formulate a hypothesis and log it with `add_investigation_note`.',
        '5. Propose a minimal and safe fix without introducing regressions.',
      ].filter(Boolean).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: formattedContext,
          },
        ],
      };
    }
  );
}
