import { useState, useEffect, useCallback, useRef } from "react";
import {
  getBugs,
  createBug,
  deleteBug,
  updateBug,
  type Bug,
  type CreateBugPayload,
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

const emptyForm: CreateBugPayload = {
  title: "",
  description: "",
  bugType: "UI",
  severity: "Medium",
  priority: "P2",
  assignee: "",
  reporter: "",
  environment: "",
  tags: [],
};

// Older documents may predate the visibility flag; the schema defaults
// to public, so treat a missing value as public.
export function isFormPublic(bug: Pick<Bug, "isPublic">): boolean {
  return bug.isPublic !== false;
}

export default function FeedbackForms() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [draft, setDraft] = useState<CreateBugPayload>(emptyForm);
  const [tagInput, setTagInput] = useState("");
  const [active, setActive] = useState<Bug | null>(null);
  const [editingBug, setEditingBug] = useState<Bug | null>(null);
  const [editTagInput, setEditTagInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const builderRef = useRef<HTMLFormElement>(null);

  const focusBuilder = () => {
    builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => titleInputRef.current?.focus({ preventScroll: true }), 300);
  };

  const loadBugs = useCallback(async () => {
    try {
      const data = await getBugs();
      setBugs(data);
    } catch (err) {
      console.error("Failed to load bugs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBugs();
  }, [loadBugs]);

  const addBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || submitting) return;

    setSubmitting(true);
    try {
      const newBug = await createBug({
        ...draft,
        title: draft.title.trim(),
        description: draft.description?.trim() || "",
        assignee: draft.assignee?.trim() || "Unassigned",
        tags: tagInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setBugs((prev) => [newBug, ...prev]);
      setDraft(emptyForm);
      setTagInput("");
    } catch (err) {
      console.error("Failed to create bug:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (bug: Bug) => {
    setEditingBug({ ...bug });
    setEditTagInput((bug.tags || []).join(", "));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBug || !editingBug.title.trim() || savingEdit) return;

    setSavingEdit(true);
    try {
      const updatedTags = editTagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await updateBug(editingBug.formId, {
        title: editingBug.title.trim(),
        description: editingBug.description || "",
        bugType: editingBug.bugType,
        severity: editingBug.severity,
        priority: editingBug.priority,
        status: editingBug.status,
        assignee: editingBug.assignee || "Unassigned",
        environment: editingBug.environment || "",
        tags: updatedTags,
        isPublic: isFormPublic(editingBug),
      });

      setBugs((prev) =>
        prev.map((b) => (b.formId === editingBug.formId ? updated : b))
      );
      if (active?.formId === editingBug.formId) {
        setActive(updated);
      }
      setEditingBug(null);
    } catch (err) {
      console.error("Failed to update bug form:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const removeBug = async (formId: string) => {
    if (!window.confirm("Are you sure you want to delete this feedback form?")) return;
    try {
      await deleteBug(formId);
      setBugs((prev) => prev.filter((b) => b.formId !== formId));
      if (active?.formId === formId) setActive(null);
      if (editingBug?.formId === formId) setEditingBug(null);
    } catch (err) {
      console.error("Failed to delete bug:", err);
    }
  };

  const handleStatusChange = async (formId: string, status: BugStatus) => {
    try {
      const updated = await updateBug(formId, { status });
      setBugs((prev) => prev.map((b) => (b.formId === formId ? updated : b)));
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const publicLink = (formId: string) =>
    `${window.location.origin}/#/feedback/${formId}`;

  const copyLink = (formId: string) => {
    navigator.clipboard.writeText(publicLink(formId));
    setCopySuccess(formId);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const update = <K extends keyof CreateBugPayload>(
    key: K,
    value: CreateBugPayload[K]
  ) => setDraft((d) => ({ ...d, [key]: value }));

  if (loading) {
    return (
      <div className="admin-loading">
        <p>Loading forms...</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Feedback forms</h1>
          <p>Create and customize forms to collect bug and feedback info from your users.</p>
        </div>
        <div className="admin-head-actions">
          <span className="count">{bugs.length} {bugs.length === 1 ? "form" : "forms"}</span>
        </div>
      </div>

      <div className="admin-grid">
        {/* New Form Builder */}
        <form className="form-builder" onSubmit={addBug} ref={builderRef}>
          <h2>New feedback form</h2>
          <label>
            <span>Form Title *</span>
            <input
              ref={titleInputRef}
              value={draft.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Checkout bug report, Customer Feedback"
              required
            />
          </label>
          <label>
            <span>Description / Instructions</span>
            <textarea
              value={draft.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Explain to users what details to provide..."
              rows={3}
            />
          </label>

          <button
            type="button"
            className="collapse-toggle"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <i className={`fa-solid fa-chevron-${showAdvanced ? "down" : "right"}`}></i>
            Defaults & team <span className="collapse-hint">optional</span>
          </button>

          {showAdvanced && (
            <div className="advanced-fields">
              <div className="two-col">
                <label>
                  <span>Default Bug type</span>
                  <select
                    value={draft.bugType}
                    onChange={(e) => update("bugType", e.target.value as BugType)}
                  >
                    {BUG_TYPES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Default Severity</span>
                  <select
                    value={draft.severity}
                    onChange={(e) =>
                      update("severity", e.target.value as Severity)
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
                  <span>Priority</span>
                  <select
                    value={draft.priority}
                    onChange={(e) =>
                      update("priority", e.target.value as Priority)
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Target Environment</span>
                  <input
                    value={draft.environment}
                    onChange={(e) => update("environment", e.target.value)}
                    placeholder="e.g. Production, Staging"
                  />
                </label>
              </div>
              <label>
                <span>Assignee / Team</span>
                <input
                  value={draft.assignee}
                  onChange={(e) => update("assignee", e.target.value)}
                  placeholder="e.g. Frontend Team"
                />
              </label>
              <label>
                <span>Tags (comma separated)</span>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="ui, payment, checkout"
                />
              </label>
            </div>
          )}
          <button
            className="btn primary lg block"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Creating..." : "+ Create form"}
          </button>
        </form>

        {/* Forms List */}
        <div className="form-list">
          <h2>Created forms</h2>
          {bugs.length === 0 && (
            <div className="empty-state">
              <i className="fa-solid fa-clipboard-list empty-state-icon"></i>
              <h3>No feedback forms yet</h3>
              <p>Create your first form — it takes 10 seconds. Share the link anywhere and bug reports land here.</p>
              <button type="button" className="btn primary" onClick={focusBuilder}>
                <i className="fa-solid fa-plus"></i> Create your first form
              </button>
            </div>
          )}
          {bugs.map((b) => {
            const pub = isFormPublic(b);
            return (
            <div className="form-item" key={b.formId}>
              <div className="fi-top">
                <div className="fi-title-block">
                  <div className="fi-title-row">
                    <h3>{b.title}</h3>
                    <span className={`badge sm ${pub ? "vis-public" : "vis-private"}`}>
                      {pub ? "● Public" : "◆ Private"}
                    </span>
                  </div>
                  {b.description && <p className="fi-desc">{b.description}</p>}
                </div>
                <div className="fi-top-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => startEditing(b)}
                    title="Edit form"
                    aria-label="Edit form"
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeBug(b.formId)}
                    title="Delete form"
                    aria-label="Delete form"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>

              {/* Shareable Link Box */}
              <div className="fi-link-box">
                <span className="fi-link-label">Form URL</span>
                <code className="fi-link-url">{window.location.origin}/#/feedback/{b.formId}</code>
                <div className="fi-link-btns">
                  <button
                    type="button"
                    className="btn sm btn-copy"
                    onClick={() => copyLink(b.formId)}
                    title={pub ? "Copy public link" : "Form is private"}
                  >
                    <i className={`fa-solid ${copySuccess === b.formId ? "fa-check" : "fa-copy"}`}></i>
                    {copySuccess === b.formId ? "Copied" : "Copy link"}
                  </button>
                  {pub ? (
                    <a
                      href={`/#/feedback/${b.formId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn sm ghost"
                      title="Open form in new tab"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i> Open
                    </a>
                  ) : (
                    <button className="btn sm ghost" disabled title="Private form">
                      Private
                    </button>
                  )}
                </div>
              </div>

              <div className="fi-meta">
                <span className="fi-meta-item">
                  <span className="fi-meta-k">Severity</span>
                  <span className={`badge sm sev-${b.severity.toLowerCase()}`}>{b.severity}</span>
                </span>
                <span className="fi-meta-item">
                  <span className="fi-meta-k">Type</span>
                  <span className="badge sm badge-type">{b.bugType}</span>
                </span>
                <span className="fi-meta-item">
                  <span className="fi-meta-k">Priority</span>
                  <span className="badge sm badge-priority">{b.priority}</span>
                </span>
                {b.assignee && (
                  <span className="fi-meta-item">
                    <span className="fi-meta-k">Assignee</span>
                    <span className="fi-assignee">{b.assignee}</span>
                  </span>
                )}
              </div>

              {b.tags && b.tags.length > 0 && (
                <div className="fi-tags">
                  {b.tags.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* Edit Form Modal */}
      {editingBug && (
        <div className="modal" onClick={() => setEditingBug(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "600px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-x"
              onClick={() => setEditingBug(null)}
            >
              ✕
            </button>
            <span className="eyebrow">{editingBug.formId}</span>
            <h2 style={{ marginBottom: "16px" }}>Edit Feedback Form</h2>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Form Title *</span>
                <input
                  value={editingBug.title}
                  onChange={(e) =>
                    setEditingBug({ ...editingBug, title: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Description / Subtitle</span>
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
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Target Environment</span>
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

              <div className="visibility-row">
                <div>
                  <span className="visibility-title">
                    <i className={`fa-solid ${isFormPublic(editingBug) ? "fa-earth-americas" : "fa-lock"}`}></i>
                    {isFormPublic(editingBug) ? "Public form" : "Private form"}
                  </span>
                  <p className="visibility-sub">
                    {isFormPublic(editingBug)
                      ? "Anyone with the link can submit feedback."
                      : "Link disabled — submissions are blocked until you make it public."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isFormPublic(editingBug)}
                  aria-label="Toggle form visibility"
                  className={`switch ${isFormPublic(editingBug) ? "on" : ""}`}
                  onClick={() =>
                    setEditingBug({ ...editingBug, isPublic: !isFormPublic(editingBug) })
                  }
                >
                  <span className="knob" />
                </button>
              </div>

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
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {active && (
        <div className="modal" onClick={() => setActive(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-x"
              onClick={() => setActive(null)}
            >
              ✕
            </button>
            <span className="eyebrow">
              {active.formId}
            </span>
            <h2>{active.title}</h2>
            <p>{active.description || "No description provided."}</p>

            <div className="modal-meta">
              <div className="two-col">
                <label>
                  <span>Status</span>
                  <select
                    value={active.status}
                    onChange={(e) =>
                      handleStatusChange(
                        active.formId,
                        e.target.value as BugStatus
                      )
                    }
                  >
                    {BUG_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Assignee</span>
                  <input
                    value={active.assignee}
                    onChange={(e) => {
                      const updated = {
                        ...active,
                        assignee: e.target.value,
                      };
                      setActive(updated);
                    }}
                    onBlur={() =>
                      updateBug(active.formId, {
                        assignee: active.assignee,
                      })
                    }
                  />
                </label>
              </div>
              <div className="fi-meta">
                <span
                  className={`badge sev-${active.severity.toLowerCase()}`}
                >
                  {active.severity}
                </span>
                <span className="badge badge-type">
                  {active.bugType}
                </span>
                <span className="badge badge-priority">
                  {active.priority}
                </span>
                <span className={`badge ${isFormPublic(active) ? "vis-public" : "vis-private"}`}>
                  {isFormPublic(active) ? "● Public" : "◆ Private"}
                </span>
              </div>
              {active.tags && active.tags.length > 0 && (
                <label>
                  <span>Tags</span>
                  <div className="fi-tags">
                    {active.tags.map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                  </div>
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                className="btn sm btn-copy"
                onClick={() => copyLink(active.formId)}
              >
                {copySuccess === active.formId
                  ? "✓ Copied!"
                  : "Copy shareable link"}
              </button>
              <button
                className="btn sm ghost"
                onClick={() => {
                  const target = active;
                  setActive(null);
                  startEditing(target);
                }}
              >
                <i className="fa-solid fa-pen-to-square"></i> Edit Full Form
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
