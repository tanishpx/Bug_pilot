#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getDataSource } from './data/storage.js';
import { registerGetBugContextTool } from './tools/getBugContext.js';
import { registerListBugsTool } from './tools/listBugs.js';
import { registerCreateBugTool } from './tools/createBug.js';
import { registerAddInvestigationNoteTool } from './tools/addInvestigationNote.js';
import { registerUpdateBugStatusTool } from './tools/updateBugStatus.js';
import { registerBugResources } from './resources/bugResources.js';
import { registerInvestigateBugPrompt } from './prompts/investigateBugPrompt.js';

async function main() {
  const server = new McpServer({
    name: 'bug-pilot-mcp',
    version: '0.1.0',
  });

  const dataSource = getDataSource();

  // Fail fast: an MCP client should never be told the server is ready while the
  // Bug module is unreachable. An empty result set is valid; a connection error is not.
  try {
    await dataSource.getAll({ limit: 1 });
  } catch (err) {
    console.error(
      '[BugPilot MCP] Cannot reach the Bug Pilot API. Start the server (npm run dev:server) or set BUG_PILOT_API_URL.',
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  registerGetBugContextTool(server, dataSource);
  registerListBugsTool(server, dataSource);
  registerCreateBugTool(server, dataSource);
  registerAddInvestigationNoteTool(server, dataSource);
  registerUpdateBugStatusTool(server, dataSource);
  registerBugResources(server, dataSource);
  registerInvestigateBugPrompt(server, dataSource);

  await server.connect(new StdioServerTransport());

  console.error('[BugPilot MCP] Running on stdio (data source: bugpilot_api)');
}

main().catch((err) => {
  console.error('[BugPilot MCP] Fatal initialization error:', err);
  process.exit(1);
});
