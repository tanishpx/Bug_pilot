import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getPublicForm, submitFeedback, type PublicForm } from "../lib/api";
import { BUG_TYPES, SEVERITIES, type BugType, type Severity } from "../lib/forms";

type FormState = "loading" | "form" | "success" | "not-found";

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

export default function FeedbackFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const [state, setState] = useState<FormState>("loading");
  const [form, setForm] = useState<PublicForm | null>(null);

  // Form input states
  const [bugTitle, setBugTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("Medium");
  const [bugType, setBugType] = useState<BugType>("UI");
  const [bugDescription, setBugDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [environment, setEnvironment] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Submission handling
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [submittedTitle, setSubmittedTitle] = useState("");
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Bring server-side / validation errors into view on small screens.
  useEffect(() => {
    if (errorMsg && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errorMsg]);

  // Required-field completion shown as a slim progress bar under the header.
  const completedSteps = [
    bugTitle.trim(),
    bugDescription.trim(),
    stepsToReproduce.trim(),
  ].filter(Boolean).length;
  const progressPercent = Math.round(((completedSteps + 2) / 5) * 100);

  useEffect(() => {
    if (!formId) return;

    getPublicForm(formId)
      .then((data) => {
        setForm(data);
        if (data.severity && SEVERITIES.includes(data.severity as Severity)) {
          setSeverity(data.severity as Severity);
        }
        if (data.bugType && BUG_TYPES.includes(data.bugType as BugType)) {
          setBugType(data.bugType as BugType);
        }
        if (data.environment) {
          setEnvironment(data.environment);
        }
        setState("form");
      })
      .catch(() => {
        setState("not-found");
      });
  }, [formId]);

  const handleAutoDetectSystem = () => {
    const userAgent = navigator.userAgent;
    let browser = "Browser";
    let os = "OS";

    if (userAgent.includes("Win")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "macOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("like Mac")) os = "iOS";

    if (userAgent.includes("Edg/")) browser = "Edge";
    else if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) browser = "Chrome";
    else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) browser = "Safari";
    else if (userAgent.includes("Firefox/")) browser = "Firefox";

    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const detected = `${browser} on ${os} (${screenRes})`;
    setEnvironment(detected);
  };

  const handleInsertStepsTemplate = () => {
    const template = `1. Navigate to: \n2. Action performed: \n3. Observed bug: \n4. Expected outcome: `;
    setStepsToReproduce((prev) => (prev.trim() ? prev + "\n\n" + template : template));
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB

    const remaining = maxFiles - attachments.length;
    if (remaining <= 0) {
      setErrorMsg(`Maximum of ${maxFiles} attachments allowed.`);
      return;
    }

    Array.from(files)
      .slice(0, remaining)
      .forEach((file) => {
        if (file.size > maxSize) {
          setErrorMsg(`File "${file.name}" exceeds maximum allowed size of 10MB.`);
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const newFile: AttachedFile = {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result as string,
          };
          setAttachments((prev) =>
            prev.length >= maxFiles ? prev : [...prev, newFile]
          );
        };
        reader.readAsDataURL(file);
      });
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId || submitting) return;

    if (!bugTitle.trim()) {
      setErrorMsg("Please enter a title / summary for the bug.");
      return;
    }

    if (!bugDescription.trim()) {
      setErrorMsg("Please provide a description of the bug.");
      return;
    }

    if (!stepsToReproduce.trim()) {
      setErrorMsg("Please provide steps to reproduce the issue.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await submitFeedback(formId, {
        title: bugTitle.trim(),
        bugTitle: bugTitle.trim(),
        severity,
        bugType,
        bugDescription: bugDescription.trim(),
        stepsToReproduce: stepsToReproduce.trim(),
        environment: environment.trim(),
        reporterEmail: reporterEmail.trim(),
        attachments: attachments.map((a) => a.dataUrl || a.name),
      });

      setSubmissionId(res.id || `SUB-${Date.now().toString().slice(-6)}`);
      setSubmittedTitle(bugTitle.trim());
      setState("success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Submission failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setBugTitle("");
    setBugDescription("");
    setStepsToReproduce("");
    setSeverity((form?.severity as Severity) || "Medium");
    setBugType((form?.bugType as BugType) || "UI");
    setEnvironment(form?.environment || "");
    setReporterEmail("");
    setAttachments([]);
    setErrorMsg("");
    setState("form");
  };

  if (state === "loading") {
    return (
      <div className="gate">
        <span className="logo-mark">◈</span>
        <p>Loading form...</p>
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div className="gate">
        <span className="logo-mark">◈</span>
        <h1>Form not found</h1>
        <p>
          This feedback form doesn't exist, is set to private, or is no
          longer active.
        </p>
        <Link to="/" className="btn primary lg">
          Go home
        </Link>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="saas-container">
        <div className="saas-card saas-success-card">
          <div className="saas-success-icon-wrap">
            <i className="fa-solid fa-circle-check saas-success-icon"></i>
          </div>
          <h1 className="saas-title" style={{ textAlign: "center", marginBottom: "8px" }}>
            Bug Report Submitted!
          </h1>
          <p className="saas-subtitle" style={{ textAlign: "center", marginBottom: "24px" }}>
            Thank you for reporting this issue. Our engineering team has received your report and will investigate it shortly.
          </p>

          <div className="saas-receipt-card">
            <div className="saas-receipt-row">
              <span className="saas-receipt-label">Submission ID</span>
              <div className="saas-receipt-copy">
                <code>#{submissionId}</code>
                <button
                  type="button"
                  className="saas-copy-badge-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(submissionId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            {submittedTitle && (
              <div className="saas-receipt-row">
                <span className="saas-receipt-label">Issue Title</span>
                <span className="saas-receipt-value">{submittedTitle}</span>
              </div>
            )}
            <div className="saas-receipt-row">
              <span className="saas-receipt-label">Severity</span>
              <span className={`badge sev-${severity.toLowerCase()}`}>{severity}</span>
            </div>
            <div className="saas-receipt-row">
              <span className="saas-receipt-label">Bug Category</span>
              <span className="badge badge-type">{bugType}</span>
            </div>
            <div className="saas-receipt-row">
              <span className="saas-receipt-label">Status</span>
              <span className="badge status-open">New</span>
            </div>
          </div>

          <div className="saas-actions" style={{ justifyContent: "center", gap: "16px", marginTop: "28px" }}>
            <button
              type="button"
              className="saas-btn secondary"
              onClick={handleResetForm}
            >
              <i className="fa-solid fa-plus"></i> Submit Another Issue
            </button>
            <Link to="/" className="saas-btn primary">
              <i className="fa-solid fa-house"></i> Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saas-container">
      <div className="saas-card">
        {/* Form Header */}
        <div className="saas-header">
          <div className="saas-header-top">
            <span className="saas-badge">
              <i className="fa-solid fa-bug" style={{ marginRight: "6px" }}></i>
              {form?.bugType ? `${form.bugType.toUpperCase()} REPORT` : "BUG REPORT"}
            </span>
            {form?.formId && (
              <span className="saas-form-tag">ID: {form.formId}</span>
            )}
          </div>
          <h1 className="saas-title">{form?.title || "Submit a bug report"}</h1>
          <p className="saas-subtitle">
            {form?.description || "Help us squash bugs by providing clear and detailed information."}
          </p>
          <div
            className="saas-progress"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            title={`${completedSteps + 2} of 5 required sections complete`}
          >
            <div
              className="saas-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <form className="saas-form" onSubmit={handleSubmit}>
          <div className="saas-grid-2">
            {/* Title / Summary Field */}
            <div className="saas-field full-width">
              <label className="saas-label">
                <span>Issue Title / Summary *</span>
                <span className="saas-char-counter">{bugTitle.length} / 120</span>
              </label>
              <input
                type="text"
                className="saas-input"
                value={bugTitle}
                maxLength={120}
                onChange={(e) => setBugTitle(e.target.value)}
                placeholder="e.g. Checkout payment button unresponsive on iOS Safari"
                required
              />
              <span className="saas-helper">
                A concise summary that helps developers quickly identify the problem.
              </span>
            </div>

            {/* Severity Field */}
            <div className="saas-field">
              <label className="saas-label">
                <span>Severity Level *</span>
              </label>
              <div className="saas-severity-picker">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`saas-severity-btn sev-${s.toLowerCase()} ${severity === s ? "active" : ""}`}
                    onClick={() => setSeverity(s)}
                  >
                    <span className="sev-indicator"></span>
                    {s}
                  </button>
                ))}
              </div>
              <span className="saas-helper">Impact level of this issue on your workflow.</span>
            </div>

            {/* Bug Type Field */}
            <div className="saas-field">
              <label className="saas-label">
                <span>Category / Bug Type *</span>
              </label>
              <select
                className="saas-select"
                value={bugType}
                onChange={(e) => setBugType(e.target.value as BugType)}
              >
                {BUG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="saas-helper">Select the category that best matches this bug.</span>
            </div>

            {/* Describe the Bug Field */}
            <div className="saas-field full-width">
              <label className="saas-label">
                <span>Describe the Bug *</span>
                <span className="saas-char-counter">
                  {bugDescription.length} / 1000
                </span>
              </label>
              <textarea
                className="saas-textarea"
                rows={5}
                maxLength={1000}
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder="What happened? What did you expect to happen instead?"
                required
              />
            </div>

            {/* Steps to Reproduce Field */}
            <div className="saas-field full-width">
              <div className="saas-label-with-action">
                <label className="saas-label">
                  <span>Steps to Reproduce *</span>
                </label>
                <button
                  type="button"
                  className="saas-inline-btn"
                  onClick={handleInsertStepsTemplate}
                >
                  <i className="fa-solid fa-list-ol"></i> Insert Template
                </button>
              </div>
              <textarea
                className="saas-textarea"
                rows={4}
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                placeholder="1. Go to page...&#10;2. Click on button...&#10;3. Observe error message..."
                required
              />
              <span className="saas-helper">
                Step-by-step instructions so the team can recreate and fix the issue.
              </span>
            </div>

            {/* Device / Environment Field */}
            <div className="saas-field">
              <div className="saas-label-with-action">
                <label className="saas-label">
                  <span>Device & Environment</span>
                </label>
                <button
                  type="button"
                  className="saas-inline-btn"
                  onClick={handleAutoDetectSystem}
                  title="Auto-detect operating system, browser, and screen size"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i> Auto-detect
                </button>
              </div>
              <input
                type="text"
                className="saas-input"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                placeholder="e.g. Chrome 122 on Windows 11, iPhone 15 iOS 17"
              />
              <span className="saas-helper">Browser, OS, device, or screen resolution.</span>
            </div>

            {/* Email Field */}
            <div className="saas-field">
              <label className="saas-label">
                <span>Reporter Email (optional)</span>
              </label>
              <input
                type="email"
                className="saas-input"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <span className="saas-helper">We will only notify you when this bug is resolved.</span>
            </div>

            {/* Attachments Field */}
            <div className="saas-field full-width">
              <label className="saas-label">
                <span>Screenshots & Attachments (optional)</span>
                <span className="saas-char-counter">{attachments.length} / 5 files</span>
              </label>

              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*,video/*,.pdf,.txt,.log,.json"
                style={{ display: "none" }}
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  if (e.target) e.target.value = "";
                }}
              />

              <div
                className={`saas-upload-area ${isDragging ? "dragging" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
              >
                <i className="fa-solid fa-cloud-arrow-up saas-upload-icon"></i>
                <div className="saas-upload-title">
                  Drag & drop screenshots or logs here, or <span>browse files</span>
                </div>
                <div className="saas-upload-subtitle">
                  Supports PNG, JPG, GIF, MP4, PDF, LOG (up to 10MB per file)
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="saas-file-list">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="saas-file-chip">
                      {file.type.startsWith("image/") && file.dataUrl ? (
                        <img src={file.dataUrl} alt={file.name} className="saas-file-thumb" />
                      ) : (
                        <i className="fa-solid fa-file-lines saas-file-icon"></i>
                      )}
                      <div className="saas-file-info">
                        <span className="saas-file-name" title={file.name}>
                          {file.name}
                        </span>
                        <span className="saas-file-size">{formatFileSize(file.size)}</span>
                      </div>
                      <button
                        type="button"
                        className="saas-file-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAttachment(idx);
                        }}
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="saas-alert-error" ref={errorRef}>
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="saas-actions">
            <Link to="/" className="saas-btn secondary">
              Cancel
            </Link>

            <button
              className="saas-btn primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Submitting...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i> Submit Bug Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
