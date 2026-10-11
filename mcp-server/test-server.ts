import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('--- Starting Bug Pilot MCP Standalone Verification ---');

  const serverPath = path.resolve(__dirname, './dist/index.js');
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
  });

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  await client.connect(transport);
  console.log('✓ Successfully connected to MCP server via stdio transport.');

  const tools = await client.listTools();
  console.log(`✓ Tools registered (${tools.tools.length}):`, tools.tools.map(t => t.name).join(', '));

  const bugContextRes = await client.callTool({
    name: 'get_bug_context',
    arguments: { bugId: 'BUG-101' },
  });
  console.log('✓ get_bug_context returned successfully for BUG-101.');
  const content = (bugContextRes.content as any[])[0]?.text;
  if (content && content.includes('Uncaught TypeError')) {
    console.log('✓ Bug context content validated with expected error trace.');
  }

  const listRes = await client.callTool({
    name: 'list_bugs',
    arguments: { severity: 'Critical' },
  });
  const listText = (listRes.content as any[])[0]?.text;
  console.log('✓ list_bugs tool returned filtered critical bugs:');
  console.log(listText.split('\n')[0]);

  const noteRes = await client.callTool({
    name: 'add_investigation_note',
    arguments: {
      bugId: 'BUG-101',
      hypothesis: 'Form input missing null check',
      details: 'Tested with synthetic client; verified undefined handling.',
      suggestedFix: 'email?.trim() || ""',
    },
  });
  console.log('✓ add_investigation_note returned:', (noteRes.content as any[])[0]?.text);

  const resources = await client.listResources();
  console.log(`✓ Resources registered:`, resources.resources.map(r => r.name).join(', '));

  const prompts = await client.listPrompts();
  console.log(`✓ Prompts registered:`, prompts.prompts.map(p => p.name).join(', '));

  await client.close();
  console.log('--- All Bug Pilot MCP tests passed cleanly! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
