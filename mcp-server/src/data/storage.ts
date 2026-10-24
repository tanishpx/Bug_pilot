import '../config/env.js';
import {
  BugReport,
  BugFilter,
  CreateBugInput,
  AddInvestigationNoteInput,
  BugStatus,
} from '../types/bug.js';

// The Bug module lives in the Express API. This package is a client of that
// interface: it owns no schema, no MongoDB connection, and no write path of its
// own. Keeping a second implementation here previously caused schema drift and
// bypassed validation, status-change emails, and resolvedAt handling.
export interface IBugDataSource {
  getAll(filter?: BugFilter): Promise<BugReport[]>;
  getById(id: string): Promise<BugReport | null>;
  create(input: CreateBugInput): Promise<BugReport>;
  updateStatus(id: string, status: BugStatus): Promise<BugReport | null>;
  addInvestigationNote(input: AddInvestigationNoteInput): Promise<BugReport | null>;
}

export class BugPilotApiDataSource implements IBugDataSource {
  private apiUrl: string;
  private apiKey?: string;

  constructor(
    apiUrl: string = process.env.BUG_PILOT_API_URL || 'http://localhost:3001/api',
    apiKey?: string
  ) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.apiKey = apiKey || process.env.BUG_PILOT_API_KEY;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-MCP-Agent': 'bug-pilot-mcp',
      'X-User-Id': process.env.BUG_PILOT_USER_ID || 'mcp-agent',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async getAll(filter?: BugFilter): Promise<BugReport[]> {
    const params = new URLSearchParams();
    if (filter?.status) params.set('status', filter.status);
    if (filter?.severity) params.set('severity', filter.severity);
    if (filter?.type) params.set('type', filter.type);
    if (filter?.search) params.set('search', filter.search);
    if (filter?.limit) params.set('limit', String(filter.limit));

    const qs = params.toString();
    const res = await fetch(`${this.apiUrl}/bugs${qs ? `?${qs}` : ''}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`BugPilot API request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async getById(id: string): Promise<BugReport | null> {
    const res = await fetch(`${this.apiUrl}/bugs/${encodeURIComponent(id)}`, {
      headers: this.getHeaders(),
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`BugPilot API request failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as BugReport;
  }

  async create(input: CreateBugInput): Promise<BugReport> {
    const res = await fetch(`${this.apiUrl}/bugs`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<string, any>;
      throw new Error(err.error || `Failed to create bug: ${res.status}`);
    }

    return (await res.json()) as BugReport;
  }

  async updateStatus(id: string, status: BugStatus): Promise<BugReport | null> {
    const res = await fetch(`${this.apiUrl}/bugs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to update bug status: ${res.status}`);
    }

    return (await res.json()) as BugReport;
  }

  async addInvestigationNote(input: AddInvestigationNoteInput): Promise<BugReport | null> {
    const res = await fetch(
      `${this.apiUrl}/bugs/${encodeURIComponent(input.bugId)}/notes`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(input),
      }
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to add investigation note: ${res.status}`);
    }

    return this.getById(input.bugId);
  }
}

export function getDataSource(): IBugDataSource {
  return new BugPilotApiDataSource();
}
