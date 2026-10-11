import { BugReport, BugFilter, CreateBugInput, AddInvestigationNoteInput, BugStatus } from '../types/bug.js';
import sampleBugsRaw from './sample-bugs.json' with { type: 'json' };

export interface IBugDataSource {
  getAll(filter?: BugFilter): Promise<BugReport[]>;
  getById(id: string): Promise<BugReport | null>;
  create(input: CreateBugInput): Promise<BugReport>;
  updateStatus(id: string, status: BugStatus): Promise<BugReport | null>;
  addInvestigationNote(input: AddInvestigationNoteInput): Promise<BugReport | null>;
}

// In-memory data source using sample fixtures for standalone operation
export class StandaloneBugDataSource implements IBugDataSource {
  private bugs: BugReport[];

  constructor() {
    this.bugs = JSON.parse(JSON.stringify(sampleBugsRaw)) as BugReport[];
  }

  async getAll(filter?: BugFilter): Promise<BugReport[]> {
    let result = [...this.bugs];

    if (filter?.status) {
      result = result.filter(b => b.status.toLowerCase() === filter.status?.toLowerCase());
    }

    if (filter?.severity) {
      result = result.filter(b => b.severity.toLowerCase() === filter.severity?.toLowerCase());
    }

    if (filter?.type) {
      result = result.filter(b => b.type.toLowerCase() === filter.type?.toLowerCase());
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        (b.logs && b.logs.toLowerCase().includes(q))
      );
    }

    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async getById(id: string): Promise<BugReport | null> {
    const bug = this.bugs.find(b => b.id.toLowerCase() === id.toLowerCase());
    return bug || null;
  }

  async create(input: CreateBugInput): Promise<BugReport> {
    const nextNum = this.bugs.length + 101;
    const newBug: BugReport = {
      id: `BUG-${nextNum}`,
      title: input.title,
      description: input.description,
      type: input.type || 'UI',
      severity: input.severity || 'Medium',
      status: 'New',
      stepsToReproduce: input.stepsToReproduce || '',
      environment: input.environment || '',
      reporterEmail: input.reporterEmail || '',
      attachments: [],
      logs: input.logs || '',
      relatedFiles: input.relatedFiles || [],
      investigationNotes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.bugs.unshift(newBug);
    return newBug;
  }

  async updateStatus(id: string, status: BugStatus): Promise<BugReport | null> {
    const bug = await this.getById(id);
    if (!bug) return null;

    bug.status = status;
    bug.updatedAt = new Date().toISOString();
    return bug;
  }

  async addInvestigationNote(input: AddInvestigationNoteInput): Promise<BugReport | null> {
    const bug = await this.getById(input.bugId);
    if (!bug) return null;

    if (!bug.investigationNotes) {
      bug.investigationNotes = [];
    }

    const note = {
      id: `NOTE-${bug.investigationNotes.length + 1}`,
      author: input.author || 'AI Agent',
      hypothesis: input.hypothesis,
      details: input.details,
      suggestedFix: input.suggestedFix,
      timestamp: new Date().toISOString(),
    };

    bug.investigationNotes.push(note);
    bug.updatedAt = new Date().toISOString();
    return bug;
  }
}

// Adapter stub for Bug Pilot backend API (for future connection)
export class BugPilotApiDataSource implements IBugDataSource {
  private apiUrl: string;
  private apiKey?: string;

  constructor(apiUrl: string = process.env.BUG_PILOT_API_URL || 'http://localhost:3001/api', apiKey?: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey || process.env.BUG_PILOT_API_KEY;
  }

  async getAll(_filter?: BugFilter): Promise<BugReport[]> {
    throw new Error('BugPilotApiDataSource not connected yet. Use StandaloneBugDataSource.');
  }

  async getById(_id: string): Promise<BugReport | null> {
    throw new Error('BugPilotApiDataSource not connected yet. Use StandaloneBugDataSource.');
  }

  async create(_input: CreateBugInput): Promise<BugReport> {
    throw new Error('BugPilotApiDataSource not connected yet. Use StandaloneBugDataSource.');
  }

  async updateStatus(_id: string, _status: BugStatus): Promise<BugReport | null> {
    throw new Error('BugPilotApiDataSource not connected yet. Use StandaloneBugDataSource.');
  }

  async addInvestigationNote(_input: AddInvestigationNoteInput): Promise<BugReport | null> {
    throw new Error('BugPilotApiDataSource not connected yet. Use StandaloneBugDataSource.');
  }
}

export function getDataSource(): IBugDataSource {
  return process.env.DATA_SOURCE_MODE === 'bugpilot_api'
    ? new BugPilotApiDataSource()
    : new StandaloneBugDataSource();
}
