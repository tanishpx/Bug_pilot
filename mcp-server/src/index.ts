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

  registerGetBugContextTool(server, dataSource);
  registerListBugsTool(server, dataSource);
  registerCreateBugTool(server, dataSource);
  registerAddInvestigationNoteTool(server, dataSource);
  registerUpdateBugStatusTool(server, dataSource);
  registerBugResources(server, dataSource);
  registerInvestigateBugPrompt(server, dataSource);

  await server.connect(new StdioServerTransport());

  console.error(`[BugPilot MCP] Running on stdio (${process.env.DATA_SOURCE_MODE || 'standalone'})`);
}

main().catch((err) => {
  console.error('[BugPilot MCP] Fatal initialization error:', err);
  process.exit(1);
});
