import { z } from 'zod';
import { IBugDataSource } from '../data/storage.js';

export const addInvestigationNoteSchema = {
  bugId: z.string().describe('ID of the bug report (e.g. BUG-101)'),
  hypothesis: z.string().optional().describe('Root cause hypothesis or observation'),
  details: z.string().describe('Detailed technical notes, code traces, or investigation findings'),
  suggestedFix: z.string().optional().describe('Proposed code fix, workaround, or patch'),
  author: z.string().optional().default('AI Agent').describe('Name of author (defaults to AI Agent)'),
};

export function registerAddInvestigationNoteTool(server: any, dataSource: IBugDataSource) {
  server.tool(
    'add_investigation_note',
    'Record an investigation note, root-cause hypothesis, or proposed fix for a bug report so subsequent reasoning has full historical context.',
    addInvestigationNoteSchema,
    async (args: any) => {
      const updatedBug = await dataSource.addInvestigationNote({
        bugId: args.bugId,
        author: args.author,
        hypothesis: args.hypothesis,
        details: args.details,
        suggestedFix: args.suggestedFix,
      });

      if (!updatedBug) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Bug with ID "${args.bugId}" was not found.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Investigation note successfully appended to **${args.bugId}**.\nTotal notes: ${updatedBug.investigationNotes?.length}`,
          },
        ],
      };
    }
  );
}
