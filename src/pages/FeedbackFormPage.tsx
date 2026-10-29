import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getPublicForm, submitFeedback, type PublicForm } from "../lib/api";
import { BUG_TYPES, SEVERITIES, type BugType, type Severity } from "../lib/forms";
import BrandMark from "../components/BrandMark";
import { useTheme } from "../lib/theme";

type FormState = "loading" | "form" | "success" | "not-found";

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  UI: "fa-palette",
  Backend: "fa-server",
  Logic: "fa-brain",
  Performance: "fa-bolt",
  Security: "fa-shield-halved",
  Auth: "fa-key",
  Other: "fa-circle-question",
};

const SEVERITY_INFO: Record<Severity, { label: string; desc: string; icon: string }> = {
  Low: { label: "Low", desc: "Minor glitch / cosmetic", icon: "fa-circle-info" },
  Medium: { label: "Medium", desc: "Feature impaired, workaround exists", icon: "fa-triangle-exclamation" },
  High: { label: "High", desc: "Major flow blocked", icon: "fa-fire" },
  Critical: { label: "Critical", desc: "System down / data loss", icon: "fa-skull-crossbones" },
};

const DRAFT_KEY_PREFIX = "bugpilot_form_draft_";

export default function FeedbackFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const { dark, toggle } = useTheme();
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
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Submission handling
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [submittedTitle, setSubmittedTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<1 | 2 | 3>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const draftStorageKey = formId ? `${DRAFT_KEY_PREFIX}${formId}` : null;

  // Restore saved draft from localStorage
  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.bugTitle) setBugTitle(parsed.bugTitle);
        if (parsed.bugDescription) setBugDescription(parsed.bugDescription);
        if (parsed.stepsToReproduce) setStepsToReproduce(parsed.stepsToReproduce);
        if (parsed.severity) setSeverity(parsed.severity);
        if (parsed.bugType) setBugType(parsed.bugType);
        if (parsed.environment) setEnvironment(parsed.environment);
        if (parsed.reporterEmail) setReporterEmail(parsed.reporterEmail);
        setHasRestoredDraft(true);
      }
    } catch {
      // ignore
    }
  }, [draftStorageKey]);

  // Auto-save draft
  useEffect(() => {
    if (!draftStorageKey || state !== "form") return;
    const timeout = setTimeout(() => {
      if (bugTitle || bugDescription || stepsToReproduce || reporterEmail) {
        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            bugTitle,
            bugDescription,
            stepsToReproduce,
            severity,
            bugType,
            environment,
            reporterEmail,
          })
        );
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [draftStorageKey, state, bugTitle, bugDescription, stepsToReproduce, severity, bugType, environment, reporterEmail]);

  // Bring server-side / validation errors into view
  useEffect(() => {
    if (errorMsg && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errorMsg]);

  // Global paste support (Ctrl+V) for instant screenshot uploads
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        handleFilesSelected(imageFiles);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [attachments]);

  // Required-field completion
  const step1Complete = Boolean(bugTitle.trim() && severity && bugType);
  const step2Complete = Boolean(bugDescription.trim() && stepsToReproduce.trim());
  const step3Complete = Boolean(environment.trim() || reporterEmail.trim() || attachments.length > 0);

  const completedStepsCount = [
    Boolean(bugTitle.trim()),
    Boolean(bugDescription.trim()),
    Boolean(stepsToReproduce.trim()),
  ].filter(Boolean).length;
  const progressPercent = Math.round((completedStepsCount / 3) * 100);

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
        if (data.environment && !environment) {
          setEnvironment(data.environment);
        }
        setState("form");
      })
      .catch(() => {
        setState("not-found");
      });
  }, [formId]);

  const handleAutoDetectSystem = () => {
    const ua = navigator.userAgent;
    let browser = "Browser";
    let os = "OS";

    if (ua.includes("Win")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("like Mac")) os = "iOS";

    if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
    else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
    else if (ua.includes("Firefox/")) browser = "Firefox";

    const screenRes = `${window.screen.width}×${window.screen.height}`;
    const detected = `${browser} on ${os} (${screenRes}, ${navigator.language})`;
    setEnvironment(detected);
  };

  const handleInsertTemplate = (type: "standard" | "crash" | "visual") => {
    let tpl = "";
    if (type === "standard") {
      tpl = `1. Navigate to: \n2. Action performed: \n3. Observed bug: \n4. Expected outcome: `;
    } else if (type === "crash") {
      tpl = `1. Trigger: \n2. Error / Stack Trace:\n3. Reload behavior: `;
    } else {
      tpl = `1. Component / Element: \n2. Viewport / Screen: \n3. Visual artifact: `;
    }
    setStepsToReproduce((prev) => (prev.trim() ? prev + "\n\n" + tpl : tpl));
  };

  const handleFilesSelected = (files: FileList | File[] | null) => {
    if (!files) return;
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB

    const remaining = maxFiles - attachments.length;
    if (remaining <= 0) {
      setErrorMsg(`Maximum of ${maxFiles} attachments allowed.`);
      return;
    }

    const fileArray = Array.isArray(files) ? files : Array.from(files);

    fileArray.slice(0, remaining).forEach((file) => {
      if (file.size > maxSize) {
        setErrorMsg(`File "${file.name}" exceeds maximum allowed size of 10MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const newFile: AttachedFile = {
          name: file.name || `screenshot-${Date.now()}.png`,
          size: file.size,
          type: file.type || "image/png",
          dataUrl: reader.result as string,
        };
        setAttachments((prev) => (prev.length >= maxFiles ? prev : [...prev, newFile]));
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

  const clearDraft = () => {
    if (draftStorageKey) localStorage.removeItem(draftStorageKey);
    setHasRestoredDraft(false);
    handleResetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId || submitting) return;

    if (!bugTitle.trim()) {
      setErrorMsg("Please enter a summary title for the bug.");
      setActiveStepTab(1);
      return;
    }

    if (!bugDescription.trim()) {
      setErrorMsg("Please describe what happened in detail.");
      setActiveStepTab(2);
      return;
    }

    if (!stepsToReproduce.trim()) {
      setErrorMsg("Please provide steps to reproduce the issue.");
      setActiveStepTab(2);
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

      if (draftStorageKey) localStorage.removeItem(draftStorageKey);
      setSubmissionId(res.id || `SUB-${Date.now().toString().slice(-6)}`);
      setSubmittedTitle(bugTitle.trim());
      setState("success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Submission failed. Please check your connection and retry."
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
    setActiveStepTab(1);
    setState("form");
  };

  return (
    <div className="portal-wrapper">
      {/* Top Navbar */}
      <header className="portal-nav">
        <div className="portal-nav-inner">
          <Link to="/" className="portal-brand" title="BugPilot Home">
            <BrandMark className="portal-brand-logo" />
            <div className="portal-brand-text">
              <span className="portal-brand-name">BugPilot</span>
              <span className="portal-brand-tag">Defect Intake Portal</span>
            </div>
          </Link>

          <div className="portal-nav-actions">
            <div className="portal-status-pill">
              <span className="portal-status-dot"></span>
              <span>Intake Live</span>
            </div>
            <button
              type="button"
              className="portal-theme-btn"
              onClick={toggle}
              title={`Switch to ${dark ? "light" : "dark"} theme`}
              aria-label="Toggle theme"
            >
              <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"}`}></i>
            </button>
            <Link to="/" className="portal-exit-btn">
              <i className="fa-solid fa-arrow-left"></i>
              <span>Exit</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="portal-main">
        {state === "loading" && (
          <div className="portal-card portal-loading-state">
            <div className="portal-spinner"></div>
            <h3>Loading defect intake form...</h3>
            <p>Connecting to secure incident workspace</p>
          </div>
        )}

        {state === "not-found" && (
          <div className="portal-card portal-empty-state">
            <div className="portal-empty-icon">
              <i className="fa-solid fa-file-circle-question"></i>
            </div>
            <h2>Form Not Available</h2>
            <p>
              This defect intake channel does not exist, has expired, or was set to private by the engineering team.
            </p>
            <div className="portal-empty-actions">
              <Link to="/" className="portal-btn primary">
                <i className="fa-solid fa-house"></i> Return to BugPilot Home
              </Link>
            </div>
          </div>
        )}

        {state === "success" && (
          <div className="portal-card portal-success-card">
            <div className="portal-success-header">
              <div className="portal-success-badge">
                <i className="fa-solid fa-circle-check"></i>
              </div>
              <h2>Incident Report Submitted</h2>
              <p>Your defect has been logged into the queue and assigned for engineering triage.</p>
            </div>

            <div className="portal-receipt">
              <div className="portal-receipt-header">
                <span>INCIDENT RECEIPT</span>
                <span className="portal-receipt-stamp">VERIFIED</span>
              </div>
              <div className="portal-receipt-row highlight">
                <span className="portal-receipt-key">Tracking ID</span>
                <div className="portal-receipt-val copyable">
                  <code>#{submissionId}</code>
                  <button
                    type="button"
                    className="portal-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(submissionId);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`}></i>
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {submittedTitle && (
                <div className="portal-receipt-row">
                  <span className="portal-receipt-key">Summary</span>
                  <span className="portal-receipt-val">{submittedTitle}</span>
                </div>
              )}

              <div className="portal-receipt-row">
                <span className="portal-receipt-key">Severity & Type</span>
                <div className="portal-receipt-val">
                  <span className={`badge sev-${severity.toLowerCase()}`} style={{ marginRight: "6px" }}>
                    {severity}
                  </span>
                  <span className="badge badge-type">{bugType}</span>
                </div>
              </div>

              <div className="portal-receipt-row">
                <span className="portal-receipt-key">Status</span>
                <span className="portal-receipt-val">
                  <span className="badge status-open">Queued for Triage</span>
                </span>
              </div>
            </div>

            <div className="portal-next-steps">
              <div className="portal-step-item">
                <i className="fa-solid fa-robot"></i>
                <div>
                  <strong>AI Diagnostics Triggered</strong>
                  <p>MCP agents and triage bots will inspect reproduction telemetry.</p>
                </div>
              </div>
              <div className="portal-step-item">
                <i className="fa-solid fa-user-check"></i>
                <div>
                  <strong>Engineer Review</strong>
                  <p>A triage engineer will confirm severity and prioritize fixes.</p>
                </div>
              </div>
            </div>

            <div className="portal-success-actions">
              <button type="button" className="portal-btn secondary" onClick={handleResetForm}>
                <i className="fa-solid fa-plus"></i> Submit Another Report
              </button>
              <Link to="/" className="portal-btn primary">
                <i className="fa-solid fa-house"></i> Done
              </Link>
            </div>
          </div>
        )}

        {state === "form" && (
          <div className="portal-card">
            {/* Header info */}
            <div className="portal-header">
              <div className="portal-header-meta">
                <span className="portal-tag">
                  <i className="fa-solid fa-bug"></i>
                  {form?.bugType ? `${form.bugType} REPORT` : "DEFECT REPORT"}
                </span>
                {form?.formId && <span className="portal-id-chip">Channel: {form.formId}</span>}
              </div>

              <h1 className="portal-title">{form?.title || "Submit a Defect Report"}</h1>
              <p className="portal-subtitle">
                {form?.description ||
                  "Provide precise steps and details so the engineering team can swiftly diagnose, isolate, and resolve this defect."}
              </p>

              {/* Progress and Stepper */}
              <div className="portal-progress-wrapper">
                <div className="portal-progress-meta">
                  <span className="portal-progress-label">
                    Form Completion: <strong>{progressPercent}%</strong>
                  </span>
                  <span className="portal-progress-count">
                    {completedStepsCount} of 3 required fields complete
                  </span>
                </div>
                <div className="portal-progress-bar">
                  <div
                    className="portal-progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Step Tabs for quick UX navigation */}
              <div className="portal-step-tabs">
                <button
                  type="button"
                  className={`portal-tab-btn ${activeStepTab === 1 ? "active" : ""} ${step1Complete ? "completed" : ""}`}
                  onClick={() => setActiveStepTab(1)}
                >
                  <span className="tab-number">
                    {step1Complete ? <i className="fa-solid fa-check"></i> : "1"}
                  </span>
                  <span>1. Overview</span>
                </button>
                <button
                  type="button"
                  className={`portal-tab-btn ${activeStepTab === 2 ? "active" : ""} ${step2Complete ? "completed" : ""}`}
                  onClick={() => setActiveStepTab(2)}
                >
                  <span className="tab-number">
                    {step2Complete ? <i className="fa-solid fa-check"></i> : "2"}
                  </span>
                  <span>2. Reproduction</span>
                </button>
                <button
                  type="button"
                  className={`portal-tab-btn ${activeStepTab === 3 ? "active" : ""} ${step3Complete ? "completed" : ""}`}
                  onClick={() => setActiveStepTab(3)}
                >
                  <span className="tab-number">
                    {step3Complete ? <i className="fa-solid fa-check"></i> : "3"}
                  </span>
                  <span>3. Context & Files</span>
                </button>
              </div>

              {hasRestoredDraft && (
                <div className="portal-draft-banner">
                  <div className="draft-banner-text">
                    <i className="fa-solid fa-clock-rotate-left"></i>
                    <span>Restored unfinished draft from your browser.</span>
                  </div>
                  <button type="button" className="draft-discard-btn" onClick={clearDraft}>
                    Discard Draft
                  </button>
                </div>
              )}
            </div>

            {/* Form */}
            <form className="portal-form" onSubmit={handleSubmit}>
              {/* SECTION 1: OVERVIEW */}
              <div className={`portal-section ${activeStepTab === 1 ? "tab-active" : ""}`}>
                <div className="section-legend">
                  <span className="section-pill">STEP 1</span>
                  <h3>Defect Overview & Classification</h3>
                </div>

                <div className="portal-field">
                  <label className="portal-label">
                    <span className="label-text">
                      Issue Summary <span className="req">*</span>
                    </span>
                    <span className="portal-char-count">{bugTitle.length} / 120</span>
                  </label>
                  <input
                    type="text"
                    className="portal-input title-input"
                    value={bugTitle}
                    maxLength={120}
                    onChange={(e) => setBugTitle(e.target.value)}
                    placeholder="e.g. Checkout payment button unresponsive on iOS Safari 17"
                    required
                  />
                  <span className="portal-hint">
                    Write a concise, one-sentence description of the problem.
                  </span>
                </div>

                {/* Severity Card Picker */}
                <div className="portal-field">
                  <label className="portal-label">
                    <span className="label-text">
                      Severity Level <span className="req">*</span>
                    </span>
                    <span className="portal-hint-badge">Choose user impact</span>
                  </label>
                  <div className="severity-grid">
                    {SEVERITIES.map((s) => {
                      const info = SEVERITY_INFO[s];
                      const isSel = severity === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          className={`severity-card sev-${s.toLowerCase()} ${isSel ? "selected" : ""}`}
                          onClick={() => setSeverity(s)}
                        >
                          <div className="sev-card-top">
                            <span className="sev-radio-dot"></span>
                            <span className="sev-card-title">
                              <i className={`fa-solid ${info.icon}`}></i> {info.label}
                            </span>
                          </div>
                          <span className="sev-card-desc">{info.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bug Type Pills */}
                <div className="portal-field">
                  <label className="portal-label">
                    <span className="label-text">
                      Category / Defect Area <span className="req">*</span>
                    </span>
                  </label>
                  <div className="category-pills">
                    {BUG_TYPES.map((t) => {
                      const icon = CATEGORY_ICONS[t] || "fa-tag";
                      const isSel = bugType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`category-pill ${isSel ? "active" : ""}`}
                          onClick={() => setBugType(t)}
                        >
                          <i className={`fa-solid ${icon}`}></i>
                          <span>{t}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION 2: REPRODUCTION & DETAILS */}
              <div className={`portal-section ${activeStepTab === 2 ? "tab-active" : ""}`}>
                <div className="section-legend">
                  <span className="section-pill">STEP 2</span>
                  <h3>Description & Reproduction Steps</h3>
                </div>

                {/* Description */}
                <div className="portal-field">
                  <label className="portal-label">
                    <span className="label-text">
                      Detailed Description <span className="req">*</span>
                    </span>
                    <span className="portal-char-count">{bugDescription.length} / 1000</span>
                  </label>
                  <textarea
                    className="portal-textarea"
                    rows={4}
                    maxLength={1000}
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Explain what happened, what behavior you observed, and what you expected to happen instead."
                    required
                  />
                  <span className="portal-hint">
                    Include context, error notices, or specific conditions where this happens.
                  </span>
                </div>

                {/* Steps to Reproduce */}
                <div className="portal-field">
                  <div className="portal-label-row">
                    <label className="portal-label">
                      <span className="label-text">
                        Steps to Reproduce <span className="req">*</span>
                      </span>
                    </label>
                    <div className="template-pills">
                      <span className="template-label">Templates:</span>
                      <button
                        type="button"
                        className="template-btn"
                        onClick={() => handleInsertTemplate("standard")}
                      >
                        <i className="fa-solid fa-list-ol"></i> Standard
                      </button>
                      <button
                        type="button"
                        className="template-btn"
                        onClick={() => handleInsertTemplate("crash")}
                      >
                        <i className="fa-solid fa-bolt"></i> Crash
                      </button>
                      <button
                        type="button"
                        className="template-btn"
                        onClick={() => handleInsertTemplate("visual")}
                      >
                        <i className="fa-solid fa-eye"></i> UI Glitch
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="portal-textarea mono-font"
                    rows={5}
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    placeholder="1. Go to page...&#10;2. Click on button...&#10;3. Observe error message..."
                    required
                  />
                  <span className="portal-hint">
                    Clear step-by-step numbers allow engineers to replicate the defect in seconds.
                  </span>
                </div>
              </div>

              {/* SECTION 3: CONTEXT & ATTACHMENTS */}
              <div className={`portal-section ${activeStepTab === 3 ? "tab-active" : ""}`}>
                <div className="section-legend">
                  <span className="section-pill">STEP 3</span>
                  <h3>Diagnostics, Environment & Attachments</h3>
                </div>

                <div className="portal-grid-2">
                  {/* Environment */}
                  <div className="portal-field">
                    <div className="portal-label-row">
                      <label className="portal-label">
                        <span className="label-text">Device & Environment</span>
                      </label>
                      <button
                        type="button"
                        className="portal-inline-action"
                        onClick={handleAutoDetectSystem}
                        title="Auto-detect operating system, browser, and screen size"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Auto-detect
                      </button>
                    </div>
                    <input
                      type="text"
                      className="portal-input"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      placeholder="e.g. Chrome 122 on macOS 14.5 (1920×1080)"
                    />
                    <span className="portal-hint">Browser, OS, device model or screen size.</span>
                  </div>

                  {/* Reporter Email */}
                  <div className="portal-field">
                    <label className="portal-label">
                      <span className="label-text">Reporter Email (optional)</span>
                    </label>
                    <input
                      type="email"
                      className="portal-input"
                      value={reporterEmail}
                      onChange={(e) => setReporterEmail(e.target.value)}
                      placeholder="alex@company.com"
                    />
                    <span className="portal-hint">Only used if engineering needs triage follow-up.</span>
                  </div>
                </div>

                {/* Attachments Dropzone */}
                <div className="portal-field">
                  <div className="portal-label-row">
                    <label className="portal-label">
                      <span className="label-text">Screenshots & Diagnostic Files</span>
                    </label>
                    <span className="portal-char-count">
                      <i className="fa-solid fa-paperclip"></i> {attachments.length} / 5 files
                    </span>
                  </div>

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
                    className={`portal-dropzone ${isDragging ? "dragging" : ""}`}
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
                    <div className="dropzone-icon">
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                    </div>
                    <div className="dropzone-title">
                      Drop screenshots or logs here, or <span>browse files</span>
                    </div>
                    <div className="dropzone-sub">
                      Tip: You can also <strong>press Ctrl + V</strong> to paste screenshots directly!
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="portal-file-list">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="portal-file-chip">
                          {file.type.startsWith("image/") && file.dataUrl ? (
                            <img src={file.dataUrl} alt={file.name} className="file-chip-thumb" />
                          ) : (
                            <div className="file-chip-icon">
                              <i className="fa-solid fa-file-lines"></i>
                            </div>
                          )}
                          <div className="file-chip-info">
                            <span className="file-chip-name" title={file.name}>
                              {file.name}
                            </span>
                            <span className="file-chip-size">{formatFileSize(file.size)}</span>
                          </div>
                          <button
                            type="button"
                            className="file-chip-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAttachment(idx);
                            }}
                            title="Remove file"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="portal-alert-error" ref={errorRef}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="portal-actions">
                <div className="portal-actions-left">
                  <span className="shortcut-note">
                    <i className="fa-solid fa-shield-halved"></i> Secure end-to-end incident submission
                  </span>
                </div>

                <div className="portal-actions-right">
                  <Link to="/" className="portal-btn secondary">
                    Cancel
                  </Link>

                  <button className="portal-btn primary" type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i> Submitting Report...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane"></i> Submit Defect Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Portal Footer */}
      <footer className="portal-footer">
        <div className="portal-footer-inner">
          <span>Powered by <strong>BugPilot Incident Engine</strong></span>
          <span className="footer-sep">·</span>
          <span>Model Context Protocol Enabled</span>
        </div>
      </footer>
    </div>
  );
}
