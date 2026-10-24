import './src/config/env.js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, './mcp.manifest.json');
const SERVER_PATH = path.resolve(__dirname, './dist/index.js');

type ToolResult = Awaited<ReturnType<Client['callTool']>>;

function textOf(result: ToolResult): string {
  const content = result.content as Array<{ type: string; text?: string }> | undefined;
  return (content || [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n');
}

async function cleanup(bugId?: string) {
  if (!bugId) return;

  // Verification always cleans up through the same REST seam it used to create
  // the fixture, so no database credentials are needed.
  const apiUrl = (process.env.BUG_PILOT_API_URL || 'http://localhost:3001/api').replace(
    /\/$/,
    ''
  );
  const res = await fetch(`${apiUrl}/bugs/${encodeURIComponent(bugId)}`, {
    method: 'DELETE',
    headers: {
      'X-MCP-Agent': 'bug-pilot-mcp',
      'X-User-Id': process.env.BUG_PILOT_USER_ID || 'mcp-agent',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Could not clean up ${bugId} via API: ${res.status}${body ? ` ${body}` : ''}`
    );
  }

  console.log(`✓ Cleaned up verification bug via API: ${bugId}`);
}

const FAIL_FAST_TIMEOUT_MS = 10_000;

// The server is supposed to refuse to start when the Bug module is unreachable.
// Exercise that path directly so a broken fail-fast cannot pass verification.
async function assertStartupFailsWhenApiIsUnreachable() {
  const child = spawn(process.execPath, [SERVER_PATH], {
    env: {
      ...process.env,
      BUG_PILOT_API_URL: 'http://127.0.0.1:1/api',
      BUG_PILOT_USER_ID: 'mcp-verify-failfast',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('MCP server did not fail fast when the API was unreachable'));
    }, FAIL_FAST_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    // "close" fires after stderr has been drained, so the startup message is
    // complete before we assert on it.
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  assert.notEqual(exitCode, 0, 'MCP server must exit non-zero when the API is unreachable');
  assert.match(
    stderr,
    /Cannot reach the Bug Pilot API/,
    `Expected a clear startup error, got: ${stderr}`
  );
  console.log('✓ MCP server fails fast when the API is unreachable.');
}

async function runTests() {
  console.log('--- Starting Bug Pilot MCP Verification ---');

  assert.ok(fs.existsSync(SERVER_PATH), `MCP server build not found at ${SERVER_PATH}. Run "npm run build" in mcp-server.`);
  await assertStartupFailsWhenApiIsUnreachable();

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
    tools: Array<{ name: string }>;
    resources: Array<{ name: string }>;
    prompts: Array<{ name: string }>;
  };

  const unique = `MCP-VERIFY-${Date.now()}`;
  let createdBugId = '';
  let client: Client | null = null;
  let failure: unknown;

  try {
    const forwardedEnv = Object.fromEntries(
      [
        'BUG_PILOT_API_URL',
        'BUG_PILOT_API_KEY',
        'BUG_PILOT_USER_ID',
      ].flatMap((key) => (process.env[key] ? [[key, process.env[key] as string]] : []))
    );

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_PATH],
      env: forwardedEnv,
    });

    client = new Client({ name: 'verify-client', version: '1.0.0' });

    await client.connect(transport);
    console.log('✓ Connected to MCP server over stdio.');

    // --- Capability catalog matches the shared manifest -------------------
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name).sort();
    const manifestToolNames = manifest.tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, manifestToolNames, 'Registered tools must match mcp.manifest.json');
    console.log(`✓ ${toolNames.length} tools match the manifest: ${toolNames.join(', ')}`);

    const resources = await client.listResources();
    const resourceTemplates = await client.listResourceTemplates();
    const resourceNames = [
      ...new Set([
        ...resources.resources.map((resource) => resource.name),
        ...resourceTemplates.resourceTemplates.map((template) => template.name),
      ]),
    ].sort();
    const manifestResourceNames = manifest.resources.map((resource) => resource.name).sort();
    assert.deepEqual(
      resourceNames,
      manifestResourceNames,
      'Registered resources and resource templates must match mcp.manifest.json'
    );
    console.log(`✓ Resources match the manifest: ${resourceNames.join(', ')}`);

    const prompts = await client.listPrompts();
    assert.deepEqual(
      prompts.prompts.map((prompt) => prompt.name).sort(),
      manifest.prompts.map((prompt) => prompt.name).sort(),
      'Registered prompts must match mcp.manifest.json'
    );
    console.log(`✓ Prompts match the manifest: ${prompts.prompts.map((p) => p.name).join(', ')}`);

    // --- Create a real bug through the tool interface ----------------------
    const createResult = await client.callTool({
      name: 'create_bug_report',
      arguments: {
        title: `[MCP verification] ${unique}`,
        description: `Temporary bug created by mcp-server/test-server.ts (${unique}).`,
        type: 'Other',
        severity: 'Low',
        stepsToReproduce: '1. Run npm run test in mcp-server',
        environment: 'MCP verification harness',
        logs: `verification-token=${unique}`,
      },
    });
    assert.ok(!createResult.isError, `create_bug_report failed: ${textOf(createResult)}`);

    const createText = textOf(createResult);
    const match = createText.match(/created with ID:\s*\*\*(.+?)\*\*/i);
    assert.ok(match, `Could not parse created bug ID from: ${createText}`);
    createdBugId = match![1];
    console.log(`✓ create_bug_report created ${createdBugId}.`);

    // --- Read it back with full context -----------------------------------
    const contextResult = await client.callTool({
      name: 'get_bug_context',
      arguments: { bugId: createdBugId },
    });
    assert.ok(!contextResult.isError, `get_bug_context failed: ${textOf(contextResult)}`);
    const contextText = textOf(contextResult);
    assert.ok(contextText.includes(unique), 'get_bug_context did not return the created bug');
    assert.ok(contextText.includes('MCP verification'), 'get_bug_context did not return the title');
    console.log('✓ get_bug_context returns the created bug and its logs.');

    // --- Search finds it ---------------------------------------------------
    const listResult = await client.callTool({
      name: 'list_bugs',
      arguments: { search: unique, limit: 5 },
    });
    assert.ok(!listResult.isError, `list_bugs failed: ${textOf(listResult)}`);
    assert.ok(textOf(listResult).includes(createdBugId), 'list_bugs did not return the created bug');
    console.log('✓ list_bugs finds the created bug by search term.');

    // --- Notes are written and read back ----------------------------------
    const noteToken = `hypothesis-${unique}`;
    const noteResult = await client.callTool({
      name: 'add_investigation_note',
      arguments: {
        bugId: createdBugId,
        hypothesis: noteToken,
        details: 'Verification note written by the MCP integration test.',
        suggestedFix: 'No fix required; this is a temporary verification fixture.',
      },
    });
    assert.ok(!noteResult.isError, `add_investigation_note failed: ${textOf(noteResult)}`);
    assert.ok(textOf(noteResult).includes('successfully appended'), 'Note was not acknowledged');

    const contextWithNote = await client.callTool({
      name: 'get_bug_context',
      arguments: { bugId: createdBugId },
    });
    assert.ok(
      textOf(contextWithNote).includes(noteToken),
      'Investigation note was not returned by get_bug_context'
    );
    console.log('✓ add_investigation_note persists and is returned in context.');

    // --- Status transitions ------------------------------------------------
    const statusResult = await client.callTool({
      name: 'update_bug_status',
      arguments: { bugId: createdBugId, status: 'In Progress' },
    });
    assert.ok(!statusResult.isError, `update_bug_status failed: ${textOf(statusResult)}`);
    const updatedContext = await client.callTool({
      name: 'get_bug_context',
      arguments: { bugId: createdBugId },
    });
    assert.ok(
      textOf(updatedContext).includes('**Status**: In Progress'),
      'Bug status was not persisted'
    );
    console.log('✓ update_bug_status persists the new lifecycle state.');

    // --- Resources and prompts --------------------------------------------
    const allBugs = await client.readResource({ uri: 'bugs://all' });
    const allBugsText = allBugs.contents
      .map((item) => ('text' in item ? item.text : ''))
      .join('\n');
    assert.ok(allBugsText.includes(createdBugId), 'bugs://all did not include the created bug');
    console.log('✓ bugs://all returns the live bug set.');

    const bugDetail = await client.readResource({ uri: `bugs://${createdBugId}` });
    const bugDetailText = bugDetail.contents
      .map((item) => ('text' in item ? item.text : ''))
      .join('\n');
    assert.ok(bugDetailText.includes(createdBugId), 'bugs://{id} did not return the created bug');
    assert.ok(bugDetailText.includes(unique), 'bugs://{id} did not return the fixture payload');
    console.log('✓ bugs://{id} returns the created bug.');

    const prompt = await client.getPrompt({
      name: 'investigate_bug',
      arguments: { bugId: createdBugId },
    });
    assert.ok(prompt.messages.length > 0, 'investigate_bug returned no messages');
    const promptText = prompt.messages
      .map((message) => (message.content.type === 'text' ? message.content.text : ''))
      .join('\n');
    assert.ok(promptText.includes(createdBugId), 'investigate_bug did not reference the bug ID');
    assert.ok(promptText.includes(unique), 'investigate_bug did not load the fixture bug');
    console.log('✓ investigate_bug prompt renders with the fixture bug.');

    // --- Unknown IDs fail loudly ------------------------------------------
    const missing = await client.callTool({
      name: 'get_bug_context',
      arguments: { bugId: 'BUG-DOES-NOT-EXIST' },
    });
    assert.equal(missing.isError, true, 'Unknown bug IDs must return an error');
    console.log('✓ Unknown bug IDs return an error instead of an empty success.');

    // --- Invalid input fails loudly ---------------------------------------
    let invalidInputRejected = false;
    try {
      const invalid = await client.callTool({
        name: 'create_bug_report',
        arguments: { description: 'Missing title should be rejected' },
      });
      invalidInputRejected = invalid.isError === true;
    } catch {
      invalidInputRejected = true;
    }
    assert.ok(invalidInputRejected, 'create_bug_report must reject missing required arguments');
    console.log('✓ Invalid tool input is rejected.');
  } catch (err) {
    failure = err;
  } finally {
    if (client) await client.close().catch(() => undefined);

    try {
      await cleanup(createdBugId || undefined);
    } catch (err) {
      console.error('MCP verification cleanup failed:', err);
      failure ??= err;
    }
  }

  if (failure) throw failure;

  console.log('--- All Bug Pilot MCP checks passed ---');
}

runTests().catch((err) => {
  console.error('MCP verification failed:', err);
  process.exit(1);
});
