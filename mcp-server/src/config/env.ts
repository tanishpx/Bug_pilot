import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// MCP clients launch the server from an arbitrary working directory, so never
// rely on process.cwd() to find configuration. Resolve from this module instead:
// src/config (tsx) and dist/config (build) are both two levels below mcp-server/.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');

// Package-local config wins; the repository root .env fills anything missing.
// quiet: stdout belongs to the MCP stdio protocol, so dotenv must not log there.
dotenv.config({ path: path.resolve(packageRoot, '.env'), quiet: true });
dotenv.config({ path: path.resolve(packageRoot, '..', '.env'), quiet: true });

export {};
