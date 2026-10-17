import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import {
  BugReport,
  BugFilter,
  CreateBugInput,
  AddInvestigationNoteInput,
  BugStatus,
  InvestigationNote,
} from '../types/bug.js';

// Setup reliable DNS resolution for MongoDB Atlas SRV connection strings
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Allowed to fail in environments restricting custom DNS
}

export interface IBugDataSource {
  getAll(filter?: BugFilter): Promise<BugReport[]>;
  getById(id: string): Promise<BugReport | null>;
  create(input: CreateBugInput): Promise<BugReport>;
  updateStatus(id: string, status: BugStatus): Promise<BugReport | null>;
  addInvestigationNote(input: AddInvestigationNoteInput): Promise<BugReport | null>;
}

// Schemas for direct database access when operating as database data source
const bugSchema = new mongoose.Schema(
  {
    bugId: { type: String, required: true, unique: true, index: true },
    formId: { type: String, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    bugType: { type: String, default: 'UI' },
    severity: { type: String, default: 'Medium' },
    priority: { type: String, default: 'P2' },
    status: { type: String, default: 'New' },
    stepsToReproduce: { type: String, default: '' },
    environment: { type: String, default: '' },
    reporterEmail: { type: String, default: '' },
    reporter: { type: String, default: '' },
    assignee: { type: String, default: 'Unassigned' },
    attachments: { type: [String], default: [] },
    logs: { type: String, default: '' },
    relatedFiles: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    isPublic: { type: Boolean, default: true },
    userId: { type: String, default: 'dev-user' },
  },
  { timestamps: true, collection: 'bugs' }
);

const noteSchema = new mongoose.Schema(
  {
    noteId: { type: String, required: true, unique: true, index: true },
    bugId: { type: String, required: true, index: true },
    userId: { type: String, default: 'dev-user' },
    author: { type: String, default: 'AI Agent' },
    hypothesis: { type: String, default: '' },
    details: { type: String, required: true },
    suggestedFix: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'investigation_notes' }
);

const BugModel = mongoose.models.Bug || mongoose.model('Bug', bugSchema);
const NoteModel = mongoose.models.InvestigationNote || mongoose.model('InvestigationNote', noteSchema);

// Database-backed data source querying persistent MongoDB
export class DatabaseBugDataSource implements IBugDataSource {
  private uri: string;
  private connected: boolean = false;

  constructor(uri?: string) {
    this.uri =
      uri ||
      process.env.MONGODB_URI ||
      'mongodb+srv://sajal:Saja2005@cluster0.acw0pev.mongodb.net/bugpilot?retryWrites=true&w=majority';
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected && mongoose.connection.readyState === 1) return;

    if (!this.uri) {
      throw new Error('[MCP Storage] MONGODB_URI is not set. Cannot connect to database.');
    }

    try {
      await mongoose.connect(this.uri, {
        dbName: process.env.MONGODB_DB_NAME || 'bugpilot',
        serverSelectionTimeoutMS: 20000,
      });
      this.connected = true;
    } catch (err: any) {
      console.error('[MCP Storage] Database connection error:', err.message);
      throw err;
    }
  }

  private mapBugDocument(doc: any, notes: any[] = []): BugReport {
    return {
      id: doc.bugId || doc.formId || String(doc._id),
      title: doc.title,
      description: doc.description || '',
      type: doc.bugType || 'UI',
      severity: doc.severity || 'Medium',
      status: doc.status || 'New',
      stepsToReproduce: doc.stepsToReproduce || '',
      environment: doc.environment || '',
      reporterEmail: doc.reporterEmail || '',
      attachments: doc.attachments || [],
      logs: doc.logs || '',
      relatedFiles: doc.relatedFiles || [],
      investigationNotes: notes.map((n) => ({
        id: n.noteId || String(n._id),
        author: n.author || 'AI Agent',
        hypothesis: n.hypothesis || undefined,
        details: n.details,
        suggestedFix: n.suggestedFix || undefined,
        timestamp: n.timestamp ? new Date(n.timestamp).toISOString() : new Date().toISOString(),
      })),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  async getAll(filter?: BugFilter): Promise<BugReport[]> {
    await this.ensureConnected();

    const query: any = {};
    if (filter?.status) {
      query.status = { $regex: new RegExp(`^${filter.status}$`, 'i') };
    }
    if (filter?.severity) {
      query.severity = { $regex: new RegExp(`^${filter.severity}$`, 'i') };
    }
    if (filter?.type) {
      query.bugType = { $regex: new RegExp(`^${filter.type}$`, 'i') };
    }
    if (filter?.search) {
      const q = filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { logs: { $regex: q, $options: 'i' } },
        { bugId: { $regex: q, $options: 'i' } },
      ];
    }

    const limit = filter?.limit && filter.limit > 0 ? filter.limit : 50;
    const docs = await BugModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();

    const bugIds = docs.map((d: any) => d.bugId);
    const notes = await NoteModel.find({ bugId: { $in: bugIds } }).lean();

    const notesMap: Record<string, any[]> = {};
    for (const note of notes) {
      if (!notesMap[note.bugId]) notesMap[note.bugId] = [];
      notesMap[note.bugId].push(note);
    }

    return docs.map((doc: any) => this.mapBugDocument(doc, notesMap[doc.bugId] || []));
  }

  async getById(id: string): Promise<BugReport | null> {
    await this.ensureConnected();

    const query: any = {
      $or: [{ bugId: id }, { formId: id }],
    };
    if (mongoose.isValidObjectId(id)) {
      query.$or.push({ _id: id });
    }

    const doc = await BugModel.findOne(query).lean();
    if (!doc) return null;

    const notes = await NoteModel.find({ bugId: doc.bugId }).sort({ createdAt: 1 }).lean();
    return this.mapBugDocument(doc, notes);
  }

  async create(input: CreateBugInput): Promise<BugReport> {
    await this.ensureConnected();

    const count = await BugModel.countDocuments();
    let bugId = `BUG-${count + 101}`;

    const exists = await BugModel.findOne({ bugId });
    if (exists) {
      bugId = `BUG-${Date.now()}`;
    }

    const doc = await BugModel.create({
      bugId,
      formId: bugId,
      title: input.title,
      description: input.description || '',
      bugType: input.type || 'UI',
      severity: input.severity || 'Medium',
      status: 'New',
      stepsToReproduce: input.stepsToReproduce || '',
      environment: input.environment || '',
      reporterEmail: input.reporterEmail || '',
      reporter: input.reporterEmail || '',
      logs: input.logs || '',
      relatedFiles: input.relatedFiles || [],
      attachments: [],
      tags: [],
    });

    return this.mapBugDocument(doc.toObject(), []);
  }

  async updateStatus(id: string, status: BugStatus): Promise<BugReport | null> {
    await this.ensureConnected();

    const query: any = {
      $or: [{ bugId: id }, { formId: id }],
    };
    if (mongoose.isValidObjectId(id)) {
      query.$or.push({ _id: id });
    }

    const doc = await BugModel.findOneAndUpdate(
      query,
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    ).lean();

    if (!doc) return null;

    const notes = await NoteModel.find({ bugId: doc.bugId }).sort({ createdAt: 1 }).lean();
    return this.mapBugDocument(doc, notes);
  }

  async addInvestigationNote(input: AddInvestigationNoteInput): Promise<BugReport | null> {
    await this.ensureConnected();

    const bug = await this.getById(input.bugId);
    if (!bug) return null;

    const count = await NoteModel.countDocuments();
    const noteId = `NOTE-${count + 1}-${Date.now().toString().slice(-4)}`;

    await NoteModel.create({
      noteId,
      bugId: bug.id,
      author: input.author || 'AI Agent',
      hypothesis: input.hypothesis || '',
      details: input.details,
      suggestedFix: input.suggestedFix || '',
      timestamp: new Date(),
    });

    await BugModel.findOneAndUpdate(
      { $or: [{ bugId: bug.id }, { formId: bug.id }] },
      { $set: { updatedAt: new Date() } }
    );

    return this.getById(bug.id);
  }
}

// API-backed data source querying Bug Pilot REST API
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
      'X-User-Id': 'mcp-agent',
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
    if (filter?.type) params.set('bugType', filter.type);
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
  if (process.env.DATA_SOURCE_MODE === 'bugpilot_api') {
    return new BugPilotApiDataSource();
  }
  return new DatabaseBugDataSource();
}
