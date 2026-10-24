import { useState, useEffect, useCallback } from "react";
import {
  getSubmissions,
  updateSubmission,
  type Submission,
} from "../../lib/api";

export default function Submissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    try {
      const data = await getSubmissions(filterStatus || undefined);
      setSubmissions(data);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleTriage = async (id: string, status: string) => {
    try {
      const updated = await updateSubmission(id, status);
      setSubmissions((prev) =>
        prev.map((s) => (s._id === id ? updated : s))
      );
    } catch (err) {
      console.error("Failed to update submission:", err);
    }
  };

  const newCount = submissions.filter((s) => s.status === "New").length;
  const reviewedCount = submissions.filter(
    (s) => s.status === "Reviewed"
  ).length;
  const acceptedCount = submissions.filter(
    (s) => s.status === "Accepted"
  ).length;
  const rejectedCount = submissions.filter(
    (s) => s.status === "Rejected"
  ).length;

  if (loading) {
    return (
      <div className="admin-loading">
        <p>Loading submissions...</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Submissions</h1>
          <p>Review and triage user-submitted bug reports.</p>
        </div>
        <span className="count">{submissions.length} submissions</span>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-open">
            <i className="fa-solid fa-inbox"></i>
          </div>
          <div className="stat-value">{newCount}</div>
          <div className="stat-label">New</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-muted">
            <i className="fa-solid fa-eye"></i>
          </div>
          <div className="stat-value">{reviewedCount}</div>
          <div className="stat-label">Reviewed</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-resolved">
            <i className="fa-solid fa-check"></i>
          </div>
          <div className="stat-value">{acceptedCount}</div>
          <div className="stat-label">Accepted</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-critical">
            <i className="fa-solid fa-xmark"></i>
          </div>
          <div className="stat-value">{rejectedCount}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      <div className="filter-bar">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="New">New</option>
          <option value="Reviewed">Reviewed</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {submissions.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-inbox"></i>
          <h3>No submissions yet</h3>
          <p>Share a form link to start collecting feedback.</p>
        </div>
      ) : (
        <div className="form-list">
          {submissions.map((s) => (
            <div className="submission-card" key={s._id}>
              <div className="sub-top">
                <div>
                  <div className="sub-meta">
                    <h3>{s.bugTitle || s.formTitle}</h3>
                    {s.bugTitle && s.formTitle && (
                      <span className="badge sub-via">via {s.formTitle}</span>
                    )}
                  </div>
                  <span className="sub-time">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="sub-badges">
                  {s.severity && (
                    <span className={`badge sev-${s.severity.toLowerCase()}`}>
                      {s.severity}
                    </span>
                  )}
                  {s.bugType && (
                    <span className="badge badge-type">
                      {s.bugType}
                    </span>
                  )}
                  <span
                    className={`badge status-${s.status.toLowerCase()}`}
                  >
                    {s.status}
                  </span>
                </div>
              </div>

              <p className="sub-desc">{s.bugDescription}</p>

              {expanded === s._id && (
                <>
                  {s.stepsToReproduce && (
                    <div className="sub-field">
                      <strong className="sub-field-label">Steps to reproduce</strong>
                      <div className="sub-steps">
                        {s.stepsToReproduce}
                      </div>
                    </div>
                  )}
                  {s.environment && (
                    <div className="sub-detail">
                      <strong>Environment:</strong> {s.environment}
                    </div>
                  )}
                  {s.reporterEmail && (
                    <div className="sub-detail">
                      <strong>Reporter email:</strong> {s.reporterEmail}
                    </div>
                  )}
                  {s.attachments && s.attachments.length > 0 && (
                    <div className="sub-field">
                      <strong className="sub-field-label">Attachments ({s.attachments.length})</strong>
                      <div className="sub-attachments">
                        {s.attachments.map((att, idx) => (
                          att.startsWith("data:image/") ? (
                            <a key={idx} href={att} target="_blank" rel="noreferrer" className="sub-thumb-link">
                              <img
                                src={att}
                                alt={`attachment-${idx}`}
                                className="sub-thumb"
                              />
                            </a>
                          ) : (
                            <a
                              key={idx}
                              href={att}
                              download={`attachment-${idx}`}
                              className="badge sub-attachment"
                            >
                              <i className="fa-solid fa-paperclip"></i> Attachment {idx + 1}
                            </a>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="sub-actions">
                <button
                  className="btn sm ghost"
                  onClick={() =>
                    setExpanded(expanded === s._id ? null : s._id)
                  }
                  aria-expanded={expanded === s._id}
                >
                  {expanded === s._id ? "Collapse" : "Expand"}
                </button>
                {s.status === "New" && (
                  <>
                    <button
                      className="btn sm btn-success"
                      onClick={() => handleTriage(s._id, "Accepted")}
                    >
                      Accept
                    </button>
                    <button
                      className="btn sm btn-danger"
                      onClick={() => handleTriage(s._id, "Rejected")}
                    >
                      Reject
                    </button>
                  </>
                )}
                {s.status === "New" && (
                  <button
                    className="btn sm ghost"
                    onClick={() => handleTriage(s._id, "Reviewed")}
                  >
                    Mark Reviewed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
