import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IBugDataSource } from '../data/storage.js';

export function registerBugResources(server: any, dataSource: IBugDataSource) {
  server.resource(
    'all-bugs',
    'bugs://all',
    async (uri: any) => {
      const bugs = await dataSource.getAll();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(bugs, null, 2),
          },
        ],
      };
    }
  );

  server.resource(
    'bug-detail',
    new ResourceTemplate('bugs://{id}', { list: undefined }),
    async (uri: any, { id }: { id: string }) => {
      const bug = await dataSource.getById(id);
      if (!bug) {
        throw new Error(`Bug ${id} not found`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(bug, null, 2),
          },
        ],
      };
    }
  );
}
