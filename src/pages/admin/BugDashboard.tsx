import { useState, useEffect, useCallback } from "react";
import {
  getBugs,
  getBug,
  createBug,
  updateBug,
  deleteBug,
  addInvestigationNote,
  type Bug,
  type BugFilters,
  type CreateBugPayload,
  type InvestigationNoteItem,
} from "../../lib/api";
import {
  BUG_TYPES,
  SEVERITIES,
  PRIORITIES,
  BUG_STATUSES,
  type BugType,
  type Severity,
  type Priority,
  type BugStatus,
} from "../../lib/forms";

const emptyNewBug: CreateBugPayload = {
  title: "",
  description: "",
  bugType: "UI",
  severity: "Medium",
  priority: "P2",
  status: "New",
  assignee: "",
  reporterEmail: "",
  environment: "",
  stepsToReproduce: "",
  logs: "",
  tags: [],
};

export default function BugDashboard() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BugFilters>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals state
  const [creatingBug, setCreatingBug] = useState(false);
  const [newBugDraft, setNewBugDraft] = useState<CreateBugPayload>(emptyNewBug);
  const [newBugTagsInput, setNewBugTagsInput] = useState("");
  const [submittingNewBug, setSubmittingNewBug] = useState(false);
  const [createBugError, setCreateBugError] = useState<string | null>(null);

  const [editingBug, setEditingBug] = useState<Bug | null>(null);
  const [editTagInput, setEditTagInput] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editBugError, setEditBugError] = useState<string | null>(null);

  const [activeBug, setActiveBug] = useState<Bug | null>(null);

  // New Note state
  const [noteHypothesis, setNoteHypothesis] = useState("");
  const [noteDetails, setNoteDetails] = useState("");
  const [noteSuggestedFix, setNoteSuggestedFix] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Engineering Team");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const loadBugs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const data = await getBugs({ ...filters, search: search || undefined });
      setBugs(data);
    } catch (err: any) {
      console.error("Failed to load bugs from database:", err);
      setLoadError(err.message || "Failed to load bugs. Check backend connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, search]);

  useEffect(() => {
    loadBugs();
  }, [loadBugs]);

  const openBugDetails = async (identifier: string) => {
    try {
      const bugData = await getBug(identifier);
      setActiveBug(bugData);
    } catch (err) {
      console.error("Failed to load bug details:", err);
      const fallback = bugs.find((b) => b.formId === identifier || b.bugId === identifier || b.id === identifier);
      if (fallback) setActiveBug(fallback);
    }
  };

  const handleStatusChange = async (identifier: string, status: BugStatus) => {
    try {
      const updated = await updateBug(identifier, { status });
      setBugs((prev) =>
        prev.map((b) =>
          b.formId === identifier || b.bugId === identifier || b.id === identifier
            ? updated
            : b
        )
      );
      if (
        activeBug &&
        (activeBug.formId === identifier || activeBug.bugId === identifier || activeBug.id === identifier)
      ) {
        setActiveBug((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err) {
      console.error("Failed to update status in database:", err);
    }
  };

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateBugError(null);
    if (!newBugDraft.title.trim() || submittingNewBug) {
      if (!newBugDraft.title.trim()) {
        setCreateBugError("Please enter a bug title.");
      }
      return;
    }

    setSubmittingNewBug(true);
    try {
      const tags = newBugTagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Strip any accidental ID so backend assigns a unique sequential ID
      const { id: _id, formId: _formId, bugId: _bugId, ...cleanPayload } = newBugDraft as any;

      const created = await createBug({
        ...cleanPayload,
        title: newBugDraft.title.trim(),
        description: newBugDraft.description?.trim() || "",
        assignee: newBugDraft.assignee?.trim() || "Unassigned",
        environment: newBugDraft.environment?.trim() || "",
        stepsToReproduce: newBugDraft.stepsToReproduce?.trim() || "",
        logs: newBugDraft.logs?.trim() || "",
        reporterEmail: newBugDraft.reporterEmail?.trim() || "",
        tags,
      });

      setBugs((prev) => [created, ...prev]);
      setCreatingBug(false);
      setNewBugDraft(emptyNewBug);
      setNewBugTagsInput("");
      setCreateBugError(null);
    } catch (err) {
      console.error("Failed to create bug in database:", err);
      const msg = err instanceof Error ? err.message : "Failed to create bug. Please check inputs.";
      setCreateBugError(msg);
    } finally {
      setSubmittingNewBug(false);
    }
  };

  const startEditing = (bug: Bug) => {
    setEditingBug({ ...bug });
    setEditTagInput((bug.tags || []).join(", "));
    setEditBugError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditBugError(null);
    if (!editingBug || !editingBug.title.trim() || savingEdit) return;

    const identifier = editingBug.bugId || editingBug.formId || editingBug.id || editingBug._id;
    setSavingEdit(true);
    try {
      const updatedTags = editTagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await updateBug(identifier, {
        title: editingBug.title.trim(),
        description: editingBug.description || "",
        bugType: editingBug.bugType,
        severity: editingBug.severity,
        priority: editingBug.priority,
        status: editingBug.status,
        assignee: editingBug.assignee || "Unassigned",
        environment: editingBug.environment || "",
        tags: updatedTags,
      });

      setBugs((prev) =>
        prev.map((b) =>
          b.formId === identifier || b.bugId === identifier || b.id === identifier
            ? updated
            : b
        )
      );
      if (activeBug && (activeBug.formId === identifier || activeBug.bugId === identifier)) {
        setActiveBug(updated);
      }
      setEditingBug(null);
      setEditBugError(null);
    } catch (err) {
      console.error("Failed to update bug:", err);
      const msg = err instanceof Error ? err.message : "Failed to update bug. Please check inputs.";
      setEditBugError(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (identifier: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete bug ${identifier}?`)) {
      return;
    }
    try {
      await deleteBug(identifier);
      setBugs((prev) =>
        prev.filter(
          (b) =>
            b.formId !== identifier &&
            b.bugId !== identifier &&
            b.id !== identifier &&
            b._id !== identifier
        )
      );
      if (
        activeBug &&
        (activeBug.formId === identifier || activeBug.bugId === identifier || activeBug.id === identifier)
      ) {
        setActiveBug(null);
      }
      if (
        editingBug &&
        (editingBug.formId === identifier || editingBug.bugId === identifier || editingBug.id === identifier)
      ) {
        setEditingBug(null);
      }
    } catch (err) {
      console.error("Failed to delete bug:", err);
    }
  };

  const handleAddInvestigationNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBug || !noteDetails.trim() || submittingNote) return;

    const identifier = activeBug.bugId || activeBug.formId || activeBug.id || activeBug._id;
    setSubmittingNote(true);
    setNoteError(null);

    try {
      const newNote = await addInvestigationNote(identifier, {
        hypothesis: noteHypothesis.trim() || undefined,
        details: noteDetails.trim(),
        suggestedFix: noteSuggestedFix.trim() || undefined,
        author: noteAuthor.trim() || "Engineering Team",
      });

      const updatedNotes: InvestigationNoteItem[] = [
        ...(activeBug.investigationNotes || []),
        newNote,
      ];

      setActiveBug((prev) => (prev ? { ...prev, investigationNotes: updatedNotes } : null));
      setBugs((prev) =>
        prev.map((b) =>
          b.formId === identifier || b.bugId === identifier
            ? { ...b, investigationNotes: updatedNotes }
            : b
        )
      );

      setNoteHypothesis("");
      setNoteDetails("");
      setNoteSuggestedFix("");
    } catch (err: any) {
      console.error("Failed to add investigation note:", err);
      setNoteError(err.message || "Failed to add investigation note");
    } finally {
      setSubmittingNote(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === bugs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(bugs.map((b) => b.bugId || b.formId || b._id)));
    }
  };

  const bulkStatusChange = async (status: BugStatus) => {
    for (const id of selected) {
      try {
        const updated = await updateBug(id, { status });
        setBugs((prev) =>
          prev.map((b) => (b.bugId === id || b.formId === id ? updated : b))
        );
      } catch (err) {
        console.error(`Failed to bulk update ${id}:`, err);
      }
    }
    setSelected(new Set());
  };

  const openCount = bugs.filter((b) => b.status === "Open" || b.status === "New").length;
  const inProgressCount = bugs.filter((b) => b.status === "In Progress").length;
  const criticalCount = bugs.filter((b) => b.severity === "Critical").length;
  const fixedCount = bugs.filter(
    (b) => b.status === "Fixed" || b.status === "Resolved" || b.status === "Closed"
  ).length;

  if (loading) {
    return (
      <div className="admin-loading">
        <i className="fa-solid fa-circle-notch fa-spin admin-loading-icon"></i>
        <p>Connecting to database and loading bugs...</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Bug Dashboard</h1>
          <p>Real-time database records, investigation notes, and bug tracking.</p>
        </div>
        <div className="admin-head-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => loadBugs(true)}
            disabled={refreshing}
            title="Reload latest records from database"
          >
            <i className={`fa-solid fa-arrows-rotate ${refreshing ? "fa-spin" : ""}`}></i>{" "}
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreatingBug(true)}
          >
            <i className="fa-solid fa-plus"></i> File New Bug
          </button>
          <span className="count">{bugs.length} bugs</span>
        </div>
      </div>

      {loadError && (
        <div className="alert-error">
          <span>
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>{" "}
            {loadError}
          </span>
          <button className="btn sm ghost" onClick={() => loadBugs(true)}>
            Retry
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fa-solid fa-bug"></i>
          </div>
          <div className="stat-value">{bugs.length}</div>
          <div className="stat-label">Total Bugs</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-open">
            <i className="fa-solid fa-circle-dot"></i>
          </div>
          <div className="stat-value">{openCount}</div>
          <div className="stat-label">Open / New</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-progress">
            <i className="fa-solid fa-spinner"></i>
          </div>
          <div className="stat-value">{inProgressCount}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-critical">
            <i className="fa-solid fa-fire"></i>
          </div>
          <div className="stat-value">{criticalCount}</div>
          <div className="stat-label">Critical</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-resolved">
            <i className="fa-solid fa-check-circle"></i>
          </div>
          <div className="stat-value">{fixedCount}</div>
          <div className="stat-label">Resolved / Fixed</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search bugs by title, logs, description, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={filters.status || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value || undefined }))
          }
        >
          <option value="">All Statuses</option>
          {BUG_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={filters.severity || ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              severity: e.target.value || undefined,
            }))
          }
        >
          <option value="">All Severities</option>
          {SEVERITIES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={filters.priority || ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              priority: e.target.value || undefined,
            }))
          }
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          value={filters.bugType || ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, bugType: e.target.value || undefined }))
          }
        >
          <option value="">All Types</option>
          {BUG_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="filter-bar">
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>
            {selected.size} selected
          </span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                bulkStatusChange(e.target.value as BugStatus);
              }
            }}
          >
            <option value="">Bulk change status...</option>
            {BUG_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {/* Bugs Table */}
      {bugs.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-bug empty-state-icon"></i>
          <h3>No bugs found in database</h3>
          <p>File a new bug or adjust your search filter.</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreatingBug(true)}
            style={{ marginTop: "12px" }}
          >
            <i className="fa-solid fa-plus"></i> File First Bug
          </button>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={selected.size === bugs.length && bugs.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Priority</th>
                <th>Type</th>
                <th>Notes</th>
                <th>Assignee</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((b) => {
                const bugIdentifier = b.bugId || b.formId || b.id || b._id;
                const notesCount = (b.investigationNotes && b.investigationNotes.length) || 0;

                return (
                  <tr key={bugIdentifier}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(bugIdentifier)}
                        onChange={() => toggleSelect(bugIdentifier)}
                      />
                    </td>
                    <td>
                      <code
                        className="bug-id"
                        onClick={() => openBugDetails(bugIdentifier)}
                      >
                        {bugIdentifier}
                      </code>
                    </td>
                    <td>
                      <strong
                        className="bug-title"
                        onClick={() => openBugDetails(bugIdentifier)}
                        title="Click to view details and investigation notes"
                      >
                        {b.title}
                      </strong>
                      {b.tags && b.tags.length > 0 && (
                        <div className="bug-tags">
                          {b.tags.map((t) => `#${t}`).join(" ")}
                        </div>
                      )}
                    </td>
                    <td>
                      <select
                        value={b.status}
                        onChange={(e) =>
                          handleStatusChange(
                            bugIdentifier,
                            e.target.value as BugStatus
                          )
                        }
                      >
                        {BUG_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`badge sev-${b.severity.toLowerCase()}`}>
                        {b.severity}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${b.priority.toLowerCase()}`}>
                        {b.priority}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-type">{b.bugType}</span>
                    </td>
                    <td>
                      <span
                        className={`badge notes-badge ${notesCount > 0 ? "has-notes" : ""}`}
                        onClick={() => openBugDetails(bugIdentifier)}
                        title="View investigation notes"
                      >
                        <i className="fa-solid fa-notes-medical" aria-hidden="true"></i>
                        {notesCount}
                      </span>
                    </td>
                    <td className="bug-assignee">{b.assignee}</td>
                    <td className="bug-updated">
                      {new Date(b.updatedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn sm ghost"
                          onClick={() => openBugDetails(bugIdentifier)}
                          title="Open Bug Details & Investigation"
                        >
                          <i className="fa-solid fa-magnifying-glass"></i>
                        </button>
                        <button
                          className="btn sm ghost"
                          onClick={() => startEditing(b)}
                          title="Quick Edit"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="btn sm ghost linkish danger"
                          onClick={() => handleDelete(bugIdentifier)}
                          title="Delete Bug"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE NEW BUG MODAL */}
      {creatingBug && (
        <div className="modal" onClick={() => setCreatingBug(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-x" onClick={() => setCreatingBug(false)}>
              ✕
            </button>
            <span className="eyebrow">Database Record</span>
            <h2 style={{ marginBottom: "16px" }}>File New Bug Report</h2>

            {createBugError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                <span>{createBugError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBug} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Title *</span>
                <input
                  value={newBugDraft.title}
                  onChange={(e) =>
                    setNewBugDraft({ ...newBugDraft, title: e.target.value })
                  }
                  placeholder="e.g. Uncaught TypeError in user checkout submission"
                  required
                />
              </label>

              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Description</span>
                <textarea
                  value={newBugDraft.description}
                  onChange={(e) =>
                    setNewBugDraft({ ...newBugDraft, description: e.target.value })
                  }
                  placeholder="Detailed description of the issue..."
                  rows={3}
                />
              </label>

              <div className="two-col">
                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Category / Bug Type</span>
                  <select
                    value={newBugDraft.bugType}
                    onChange={(e) =>
                      setNewBugDraft({
                        ...newBugDraft,
                        bugType: e.target.value,
                      })
                    }
                  >
                    {BUG_TYPES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Severity</span>
                  <select
                    value={newBugDraft.severity}
                    onChange={(e) =>
                      setNewBugDraft({
                        ...newBugDraft,
                        severity: e.target.value,
                      })
                    }
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="two-col">
                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Priority</span>
                  <select
                    value={newBugDraft.priority}
                    onChange={(e) =>
                      setNewBugDraft({
                        ...newBugDraft,
                        priority: e.target.value,
                      })
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Initial Status</span>
                  <select
                    value={newBugDraft.status}
                    onChange={(e) =>
                      setNewBugDraft({
                        ...newBugDraft,
                        status: e.target.value,
                      })
                    }
                  >
                    {BUG_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Steps to Reproduce</span>
                <textarea
                  value={newBugDraft.stepsToReproduce}
                  onChange={(e) =>
                    setNewBugDraft({
                      ...newBugDraft,
                      stepsToReproduce: e.target.value,
                    })
                  }
                  placeholder="1. Open page...&#10;2. Click button...&#10;3. Observe crash..."
                  rows={3}
                />
              </label>

              <div className="two-col">
                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Environment</span>
                  <input
                    value={newBugDraft.environment || ""}
                    onChange={(e) =>
                      setNewBugDraft({
                        ...newBugDraft,
                        environment: e.target.value,
                      })
                    }
                    placeholder="e.g. Node 20, Chrome 128, macOS Sonoma"
                  />
                </label>

                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Reporter Email / Name</span>
                  <input
                    type="text"
                    value={newBugDraft.reporterEmail || ""}
                    onChange={(e) =>
                      setNewBugDraft({
                        ...newBugDraft,
                        reporterEmail: e.target.value,
                      })
                    }
                    placeholder="reporter@example.com or user handle"
                  />
                </label>
              </div>

              <div className="two-col">
                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Assignee</span>
                  <input
                    value={newBugDraft.assignee || ""}
                    onChange={(e) =>
                      setNewBugDraft({
                        ...newBugDraft,
                        assignee: e.target.value,
                      })
                    }
                    placeholder="e.g. Backend Team, Alex"
                  />
                </label>

                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Tags (comma-separated)</span>
                  <input
                    value={newBugTagsInput}
                    onChange={(e) => setNewBugTagsInput(e.target.value)}
                    placeholder="auth, api, database"
                  />
                </label>
              </div>

              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Error Logs / Stack Trace</span>
                <textarea
                  value={newBugDraft.logs}
                  onChange={(e) =>
                    setNewBugDraft({
                      ...newBugDraft,
                      logs: e.target.value,
                    })
                  }
                  placeholder="Paste stack traces or error logs..."
                  rows={3}
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setCreatingBug(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={submittingNewBug}
                >
                  {submittingNewBug ? "Saving to Database..." : "Save to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUG DETAILS & INVESTIGATION MODAL */}
      {activeBug && (
        <div className="modal" onClick={() => setActiveBug(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "780px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-x" onClick={() => setActiveBug(null)}>
              ✕
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              <code style={{ fontSize: "14px", fontWeight: "bold", background: "var(--surface-3)", padding: "2px 8px", borderRadius: "4px" }}>
                {activeBug.bugId || activeBug.formId || activeBug.id}
              </code>
              <span className={`badge sev-${activeBug.severity.toLowerCase()}`}>
                {activeBug.severity}
              </span>
              <span className="badge badge-type">{activeBug.bugType}</span>
              <span className={`badge badge-${activeBug.priority.toLowerCase()}`}>
                {activeBug.priority}
              </span>
              <span className={`badge status-${activeBug.status.toLowerCase().replace(/\s+/g, "-")}`}>
                {activeBug.status}
              </span>
            </div>

            <h2 style={{ margin: "4px 0 12px", fontSize: "20px" }}>{activeBug.title}</h2>
            <p style={{ color: "var(--text-soft)", fontSize: "14px", lineHeight: "1.5" }}>
              {activeBug.description || "No description provided."}
            </p>

            {/* Metadata Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
                background: "var(--surface-2)",
                padding: "14px",
                borderRadius: "8px",
                margin: "16px 0",
                fontSize: "13px",
              }}
            >
              <div>
                <strong>Assignee:</strong> {activeBug.assignee || "Unassigned"}
              </div>
              <div>
                <strong>Reporter:</strong> {activeBug.reporterEmail || activeBug.reporter || "Anonymous"}
              </div>
              <div>
                <strong>Environment:</strong> {activeBug.environment || "Not specified"}
              </div>
              <div>
                <strong>Updated:</strong> {new Date(activeBug.updatedAt).toLocaleString()}
              </div>
            </div>

            {/* Reproduction Steps */}
            {activeBug.stepsToReproduce && (
              <div style={{ margin: "16px 0" }}>
                <h4 style={{ fontSize: "14px", marginBottom: "6px" }}>
                  <i className="fa-solid fa-list-ol" style={{ marginRight: "6px" }}></i>
                  Steps to Reproduce
                </h4>
                <div
                  style={{
                    background: "var(--surface-3)",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {activeBug.stepsToReproduce}
                </div>
              </div>
            )}

            {/* Error Logs */}
            {activeBug.logs && (
              <div style={{ margin: "16px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <h4 style={{ fontSize: "14px", margin: 0 }}>
                    <i className="fa-solid fa-terminal" style={{ marginRight: "6px" }}></i>
                    Error Logs & Stack Trace
                  </h4>
                  <button
                    className="btn sm ghost"
                    onClick={() => navigator.clipboard.writeText(activeBug.logs || "")}
                    style={{ fontSize: "11px", padding: "2px 8px" }}
                  >
                    Copy Logs
                  </button>
                </div>
                <pre
                  style={{
                    background: "#1e1e1e",
                    color: "#f8f8f2",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    overflowX: "auto",
                    maxHeight: "220px",
                  }}
                >
                  <code>{activeBug.logs}</code>
                </pre>
              </div>
            )}

            {/* INVESTIGATION NOTES SECTION */}
            <div style={{ marginTop: "24px", borderTop: "1px solid var(--line)", paddingTop: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "16px", margin: 0 }}>
                  <i className="fa-solid fa-brain" style={{ marginRight: "8px", color: "var(--primary)" }}></i>
                  Investigation Notes & AI Context ({(activeBug.investigationNotes || []).length})
                </h3>
              </div>

              {(!activeBug.investigationNotes || activeBug.investigationNotes.length === 0) ? (
                <p style={{ color: "var(--muted)", fontSize: "13px", fontStyle: "italic", marginBottom: "16px" }}>
                  No investigation notes recorded yet. Add your hypothesis and findings below.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                  {activeBug.investigationNotes.map((note, idx) => (
                    <div
                      key={note.id || idx}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                        padding: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                        <span>
                          <i className="fa-solid fa-user-gear" style={{ marginRight: "4px" }}></i>
                          <strong>{note.author}</strong>
                        </span>
                        <span>{new Date(note.timestamp).toLocaleString()}</span>
                      </div>
                      {note.hypothesis && (
                        <div style={{ fontSize: "13px", marginBottom: "6px" }}>
                          <span style={{ color: "#d97706", fontWeight: 600 }}>Hypothesis: </span>
                          {note.hypothesis}
                        </div>
                      )}
                      <div style={{ fontSize: "13px", whiteSpace: "pre-wrap", color: "var(--text)" }}>
                        {note.details}
                      </div>
                      {note.suggestedFix && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px 10px",
                            background: "rgba(46, 125, 50, 0.1)",
                            border: "1px solid rgba(46, 125, 50, 0.25)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "#2e7d32",
                          }}
                        >
                          <strong>Suggested Fix: </strong>
                          <code>{note.suggestedFix}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Note Form */}
              <form
                onSubmit={handleAddInvestigationNote}
                style={{
                  background: "var(--surface-3)",
                  padding: "16px",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <h4 style={{ fontSize: "13px", margin: 0, fontWeight: 600 }}>
                  Add Technical Note or Fix Hypothesis
                </h4>

                {noteError && (
                  <div style={{ color: "var(--danger)", fontSize: "12px" }}>
                    {noteError}
                  </div>
                )}

                <div className="two-col">
                  <input
                    placeholder="Author (e.g. AI Agent, SRE, Developer)"
                    value={noteAuthor}
                    onChange={(e) => setNoteAuthor(e.target.value)}
                    style={{ fontSize: "13px" }}
                  />
                  <input
                    placeholder="Hypothesis / Root Cause observation..."
                    value={noteHypothesis}
                    onChange={(e) => setNoteHypothesis(e.target.value)}
                    style={{ fontSize: "13px" }}
                  />
                </div>

                <textarea
                  placeholder="Technical findings, code trace, or test results * (required)"
                  value={noteDetails}
                  onChange={(e) => setNoteDetails(e.target.value)}
                  rows={3}
                  required
                  style={{ fontSize: "13px" }}
                />

                <input
                  placeholder="Proposed code patch / fix (optional)"
                  value={noteSuggestedFix}
                  onChange={(e) => setNoteSuggestedFix(e.target.value)}
                  style={{ fontSize: "13px" }}
                />

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="btn primary sm"
                    disabled={submittingNote}
                  >
                    {submittingNote ? "Saving Note..." : "+ Append Note"}
                  </button>
                </div>
              </form>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const target = activeBug;
                  setActiveBug(null);
                  startEditing(target);
                }}
              >
                <i className="fa-solid fa-pen-to-square"></i> Edit Full Bug
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => setActiveBug(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BUG MODAL */}
      {editingBug && (
        <div className="modal" onClick={() => setEditingBug(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "600px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-x" onClick={() => setEditingBug(null)}>
              ✕
            </button>
            <span className="eyebrow">{editingBug.bugId || editingBug.formId || editingBug.id}</span>
            <h2 style={{ marginBottom: "16px" }}>Edit Bug Details</h2>

            {editBugError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                <span>{editBugError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Title *</span>
                <input
                  value={editingBug.title}
                  onChange={(e) =>
                    setEditingBug({ ...editingBug, title: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Description</span>
                <textarea
                  value={editingBug.description}
                  onChange={(e) =>
                    setEditingBug({ ...editingBug, description: e.target.value })
                  }
                  rows={3}
                />
              </label>

              <div className="two-col">
                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Bug Type</span>
                  <select
                    value={editingBug.bugType}
                    onChange={(e) =>
                      setEditingBug({
                        ...editingBug,
                        bugType: e.target.value as BugType,
                      })
                    }
                  >
                    {BUG_TYPES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Severity</span>
                  <select
                    value={editingBug.severity}
                    onChange={(e) =>
                      setEditingBug({
                        ...editingBug,
                        severity: e.target.value as Severity,
                      })
                    }
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="two-col">
                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Priority</span>
                  <select
                    value={editingBug.priority}
                    onChange={(e) =>
                      setEditingBug({
                        ...editingBug,
                        priority: e.target.value as Priority,
                      })
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Status</span>
                  <select
                    value={editingBug.status}
                    onChange={(e) =>
                      setEditingBug({
                        ...editingBug,
                        status: e.target.value as BugStatus,
                      })
                    }
                  >
                    {BUG_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="two-col">
                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Assignee / Team</span>
                  <input
                    value={editingBug.assignee}
                    onChange={(e) =>
                      setEditingBug({ ...editingBug, assignee: e.target.value })
                    }
                  />
                </label>

                <label>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Environment</span>
                  <input
                    value={editingBug.environment || ""}
                    onChange={(e) =>
                      setEditingBug({ ...editingBug, environment: e.target.value })
                    }
                  />
                </label>
              </div>

              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Tags (comma separated)</span>
                <input
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setEditingBug(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
