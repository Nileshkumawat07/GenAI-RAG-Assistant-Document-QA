import React, { useEffect, useMemo, useState } from "react";

import {
  createCareerApplication,
  createCareerOpening,
  downloadCareerResume,
  getCareerManagementOverview,
  listCareerOpenings,
  listMyCareerApplications,
  updateCareerApplication,
  updateCareerOpening,
  withdrawCareerApplication,
} from "./careersApi";

const DEFAULT_TABS = [
  { id: "positions", label: "Open Positions" },
  { id: "life", label: "Life Here" },
  { id: "internship", label: "Internships" },
  { id: "process", label: "Hiring Process" },
  { id: "applications", label: "Applications" },
];

const MANAGEMENT_TABS = [
  { id: "studio", label: "Careers Studio" },
];

const OPENING_TEMPLATE = {
  title: "",
  department: "Engineering",
  location: "Jaipur, India",
  workMode: "Hybrid",
  employmentType: "Full-time",
  experienceLevel: "Mid Level",
  salaryRange: "",
  summary: "",
  responsibilities: "",
  requirements: "",
  perks: "",
  skills: "",
  seatsOpen: "1",
  applicationDeadline: "",
  isPublished: true,
  isFeatured: false,
};

const APPLICATION_TEMPLATE = {
  fullName: "",
  email: "",
  mobile: "",
  city: "",
  currentCompany: "",
  currentRole: "",
  totalExperience: "",
  noticePeriod: "",
  currentCtc: "",
  expectedCtc: "",
  portfolioUrl: "",
  linkedinUrl: "",
  coverLetter: "",
  resume: null,
};

const APPLICATION_STATUSES = [
  "Submitted",
  "In Review",
  "Shortlisted",
  "Interview Scheduled",
  "Offered",
  "Hired",
  "Rejected",
  "Withdrawn",
];

const MANAGEMENT_APPLICATION_STATUSES = APPLICATION_STATUSES.filter((status) => status !== "Withdrawn");

const CULTURE_POINTS = [
  "High-ownership teams with product, design, and engineering working from one shared operating rhythm.",
  "Clear performance expectations, fast feedback loops, and real room to grow into broader responsibility.",
  "Remote-friendly collaboration with thoughtful documentation, strong review culture, and delivery discipline.",
];

const INTERNSHIP_POINTS = [
  "Structured internship tracks across frontend, backend, product, and AI operations.",
  "Hands-on project ownership instead of observation-only shadowing.",
  "Mentor reviews, portfolio feedback, and outcome-based conversion opportunities.",
];

const PROCESS_STEPS = [
  "Application review and profile screening",
  "Introductory recruiter or hiring manager conversation",
  "Role-specific task, portfolio review, or technical round",
  "Team fit and execution interview",
  "Decision, offer discussion, and onboarding",
];

function splitLines(value) {
  return (value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value) {
  if (!value) return "Not available";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Not available";
  }
}

function buildOpeningPayload(form) {
  return {
    title: form.title,
    department: form.department,
    location: form.location,
    workMode: form.workMode,
    employmentType: form.employmentType,
    experienceLevel: form.experienceLevel,
    salaryRange: form.salaryRange,
    summary: form.summary,
    responsibilities: splitLines(form.responsibilities),
    requirements: splitLines(form.requirements),
    perks: splitLines(form.perks),
    skills: splitLines(form.skills),
    seatsOpen: Number(form.seatsOpen) || 1,
    applicationDeadline: form.applicationDeadline ? new Date(form.applicationDeadline).toISOString() : null,
    isPublished: !!form.isPublished,
    isFeatured: !!form.isFeatured,
  };
}

function statusStyle(status) {
  if (status === "Hired" || status === "Offered") return { background: "#e7f8ef", color: "#0c6b3d" };
  if (status === "Shortlisted" || status === "Interview Scheduled") return { background: "#eef4ff", color: "#1d4f9a" };
  if (status === "Rejected" || status === "Withdrawn") return { background: "#fff1f1", color: "#a53a3a" };
  return { background: "#f5f0ff", color: "#5b3aa5" };
}

function Careers({
  currentUser = null,
  canAccessManagement = false,
  activeCategory = "",
  onCategoryChange = null,
  hideEmbeddedTabs = false,
}) {
  const embedded = Boolean(activeCategory && onCategoryChange);
  const [localCategory, setLocalCategory] = useState("positions");
  const selectedCategory = embedded ? activeCategory : localCategory;
  const [openings, setOpenings] = useState([]);
  const [managementOverview, setManagementOverview] = useState({ summary: {}, openings: [], applications: [], managementUsers: [] });
  const [userApplications, setUserApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedOpeningId, setSelectedOpeningId] = useState("");
  const [applicationOpeningId, setApplicationOpeningId] = useState("");
  const [applicationForm, setApplicationForm] = useState(() => ({
    ...APPLICATION_TEMPLATE,
    fullName: currentUser?.fullName || currentUser?.name || "",
    email: currentUser?.email || "",
    mobile: currentUser?.mobile || "",
  }));
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [openingForm, setOpeningForm] = useState(OPENING_TEMPLATE);
  const [savingOpening, setSavingOpening] = useState(false);
  const [editingOpeningId, setEditingOpeningId] = useState("");
  const [applicationDrafts, setApplicationDrafts] = useState({});
  const [queueFilter, setQueueFilter] = useState("all");
  const [queueSearch, setQueueSearch] = useState("");
  const [studioSection, setStudioSection] = useState("openings");

  const setCategory = (nextCategory) => {
    if (embedded) {
      onCategoryChange(nextCategory);
      return;
    }
    setLocalCategory(nextCategory);
  };

  const tabs = canAccessManagement ? [...DEFAULT_TABS, ...MANAGEMENT_TABS] : DEFAULT_TABS;

  const reload = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const [nextOpenings, nextUserApplications, nextOverview] = await Promise.all([
        listCareerOpenings(),
        currentUser?.id ? listMyCareerApplications(currentUser.id) : Promise.resolve([]),
        canAccessManagement ? getCareerManagementOverview() : Promise.resolve({ summary: {}, openings: [], applications: [], managementUsers: [] }),
      ]);
      setOpenings(nextOpenings || []);
      setUserApplications(nextUserApplications || []);
      setManagementOverview(nextOverview || { summary: {}, openings: [], applications: [], managementUsers: [] });
      setSelectedOpeningId((current) => current || nextOpenings?.[0]?.id || "");
      setApplicationDrafts(
        Object.fromEntries(
          ((nextOverview?.applications) || []).map((item) => [
            item.id,
            {
              status: item.status,
              adminMessage: item.adminMessage || "",
              assignedManagerUserId: item.assignedManagerUserId || "",
            },
          ])
        )
      );
    } catch (error) {
      setErrorMessage(error.message || "Failed to load careers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [currentUser?.id, canAccessManagement]);

  useEffect(() => {
    setApplicationForm((current) => ({
      ...current,
      fullName: current.fullName || currentUser?.fullName || currentUser?.name || "",
      email: current.email || currentUser?.email || "",
      mobile: current.mobile || currentUser?.mobile || "",
    }));
  }, [currentUser?.id]);

  const managementUsers = managementOverview.managementUsers || [];
  const applicantQueue = useMemo(() => {
    const items = managementOverview.applications || [];
    return items.filter((item) => {
      if (item.status === "Withdrawn") return false;
      const matchesStatus = queueFilter === "all" || item.status === queueFilter;
      const matchesSearch = !queueSearch.trim() || JSON.stringify(item).toLowerCase().includes(queueSearch.trim().toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [managementOverview.applications, queueFilter, queueSearch]);

  const selectedOpening =
    openings.find((item) => item.id === selectedOpeningId)
    || openings[0]
    || null;

  const selectOpeningForEdit = (opening) => {
    if (!opening) {
      setEditingOpeningId("");
      setOpeningForm(OPENING_TEMPLATE);
      return;
    }
    setEditingOpeningId(opening.id);
    setOpeningForm({
      title: opening.title || "",
      department: opening.department || "",
      location: opening.location || "",
      workMode: opening.workMode || "Hybrid",
      employmentType: opening.employmentType || "Full-time",
      experienceLevel: opening.experienceLevel || "Mid Level",
      salaryRange: opening.salaryRange || "",
      summary: opening.summary || "",
      responsibilities: (opening.responsibilities || []).join("\n"),
      requirements: (opening.requirements || []).join("\n"),
      perks: (opening.perks || []).join("\n"),
      skills: (opening.skills || []).join("\n"),
      seatsOpen: String(opening.seatsOpen || 1),
      applicationDeadline: opening.applicationDeadline ? opening.applicationDeadline.slice(0, 16) : "",
      isPublished: !!opening.isPublished,
      isFeatured: !!opening.isFeatured,
    });
  };

  const handleApplicationChange = (key, value) => {
    setApplicationForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmitApplication = async () => {
    if (!currentUser?.id) {
      setErrorMessage("Please log in before applying.");
      return;
    }
    if (!applicationOpeningId) {
      setErrorMessage("Choose an opening first.");
      return;
    }
    try {
      setSubmittingApplication(true);
      setErrorMessage("");
      await createCareerApplication({
        openingId: applicationOpeningId,
        fullName: applicationForm.fullName,
        email: applicationForm.email,
        mobile: applicationForm.mobile,
        city: applicationForm.city,
        currentCompany: applicationForm.currentCompany,
        currentRole: applicationForm.currentRole,
        totalExperience: applicationForm.totalExperience,
        noticePeriod: applicationForm.noticePeriod,
        currentCtc: applicationForm.currentCtc,
        expectedCtc: applicationForm.expectedCtc,
        portfolioUrl: applicationForm.portfolioUrl,
        linkedinUrl: applicationForm.linkedinUrl,
        coverLetter: applicationForm.coverLetter,
        resume: applicationForm.resume,
      });
      setStatusMessage("Application submitted successfully.");
      setApplicationOpeningId("");
      setApplicationForm({
        ...APPLICATION_TEMPLATE,
        fullName: currentUser?.fullName || currentUser?.name || "",
        email: currentUser?.email || "",
        mobile: currentUser?.mobile || "",
      });
      await reload();
      setCategory("applications");
    } catch (error) {
      setErrorMessage(error.message || "Failed to submit the application.");
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleSaveOpening = async () => {
    try {
      setSavingOpening(true);
      setErrorMessage("");
      const payload = buildOpeningPayload(openingForm);
      if (editingOpeningId) {
        await updateCareerOpening(editingOpeningId, payload);
        setStatusMessage("Opening updated.");
      } else {
        await createCareerOpening(payload);
        setStatusMessage("Opening created.");
      }
      setEditingOpeningId("");
      setOpeningForm(OPENING_TEMPLATE);
      await reload();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save the opening.");
    } finally {
      setSavingOpening(false);
    }
  };

  const handleApplicationDraftChange = (applicationId, key, value) => {
    setApplicationDrafts((current) => ({
      ...current,
      [applicationId]: {
        ...(current[applicationId] || {}),
        [key]: value,
      },
    }));
  };

  const handleApplicationStatusSave = async (applicationId) => {
    const draft = applicationDrafts[applicationId];
    if (!draft) return;
    try {
      setErrorMessage("");
      await updateCareerApplication(applicationId, draft);
      setStatusMessage("Application status updated.");
      await reload();
    } catch (error) {
      setErrorMessage(error.message || "Failed to update the application.");
    }
  };

  const handleWithdraw = async (applicationId) => {
    try {
      setErrorMessage("");
      await withdrawCareerApplication(applicationId);
      setStatusMessage("Application withdrawn.");
      await reload();
    } catch (error) {
      setErrorMessage(error.message || "Failed to withdraw the application.");
    }
  };

  const renderSidebar = () => (
    <div style={styles.sidebar}>
      <h2 style={styles.sidebarTitle}>Careers</h2>
      <p style={styles.sidebarCopy}>Premium hiring experience with live openings, cleaner role briefs, and structured application tracking.</p>
      <div style={styles.sidebarTabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategory(tab.id)}
            style={{
              ...styles.sidebarTab,
              ...(selectedCategory === tab.id ? styles.sidebarTabActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.sidebarFootnote}>
        <strong>Hiring Notes</strong>
        <p>Openings are live from admin and management controls. Applicants can track status updates from the same workspace.</p>
      </div>
    </div>
  );

  const renderOpeningHighlights = () => (
    <>
      <section style={styles.heroSection}>
        <div style={styles.heroCopy}>
          <span style={styles.heroEyebrow}>Talent Studio</span>
          <h3 style={styles.heroTitle}>Build with a team that ships serious AI products with polish, speed, and accountability.</h3>
          <p style={styles.heroText}>
            Explore live roles, understand the work environment, and apply through a hiring flow built to feel crisp and professional.
          </p>
          <div style={styles.heroStats}>
            <div style={styles.statCard}>
              <strong>{openings.length}</strong>
              <span>Live openings</span>
            </div>
            <div style={styles.statCard}>
              <strong>{(managementOverview.summary || {}).totalApplications || userApplications.length}</strong>
              <span>Applications tracked</span>
            </div>
            <div style={styles.statCard}>
              <strong>{(managementOverview.summary || {}).interviewScheduled || 0}</strong>
              <span>Interviews in motion</span>
            </div>
          </div>
        </div>
        <div style={styles.heroPanel}>
          <p style={styles.heroPanelLabel}>Why this page now feels premium</p>
          <ul style={styles.heroList}>
            <li>Live opening cards with responsibilities, requirements, skills, and perks</li>
            <li>Structured application submission and candidate status tracking</li>
            <li>Admin and management controls for openings plus recruiter-style queue handling</li>
          </ul>
        </div>
      </section>

      {openings.length > 0 || canAccessManagement ? (
        <section style={styles.openingsGrid}>
          <div style={styles.roleRail}>
            {(openings || []).map((opening) => (
              <button
                key={opening.id}
                type="button"
                onClick={() => setSelectedOpeningId(opening.id)}
                style={{
                  ...styles.roleCard,
                  ...(selectedOpening?.id === opening.id ? styles.roleCardActive : {}),
                }}
              >
                <div style={styles.roleCardHeader}>
                  <div>
                    <strong>{opening.title}</strong>
                    <p>{opening.department}</p>
                  </div>
                  {opening.isFeatured ? <span style={styles.featureBadge}>Featured</span> : null}
                </div>
                <div style={styles.roleMetaRow}>
                  <span>{opening.location}</span>
                  <span>{opening.workMode}</span>
                  <span>{opening.employmentType}</span>
                </div>
                <div style={styles.roleMetaRow}>
                  <span>{opening.experienceLevel}</span>
                  <span>{opening.salaryRange || "Compensation discussed with shortlisted candidates"}</span>
                </div>
                <div style={styles.roleMetaRow}>
                  <span>{opening.totalApplications || 0} applications</span>
                  <span>{opening.seatsOpen} seats</span>
                </div>
              </button>
            ))}
          </div>

          <div style={styles.roleDetailCard}>
            {selectedOpening ? (
            <>
              <div style={styles.roleDetailHead}>
                <div>
                  <span style={styles.roleDetailCode}>Opening #{selectedOpening.openingCode}</span>
                  <h3 style={styles.roleDetailTitle}>{selectedOpening.title}</h3>
                  <p style={styles.roleDetailSummary}>{selectedOpening.summary}</p>
                </div>
                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={() => {
                    setApplicationOpeningId(selectedOpening.id);
                    setCategory("applications");
                  }}
                >
                  Apply Now
                </button>
              </div>

              <div style={styles.badgeRow}>
                {[selectedOpening.department, selectedOpening.location, selectedOpening.workMode, selectedOpening.employmentType, selectedOpening.experienceLevel].map((item) => (
                  <span key={item} style={styles.badge}>{item}</span>
                ))}
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailColumn}>
                  <h4 style={styles.sectionTitle}>Responsibilities</h4>
                  <ul style={styles.cleanList}>
                    {(selectedOpening.responsibilities || []).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div style={styles.detailColumn}>
                  <h4 style={styles.sectionTitle}>Requirements</h4>
                  <ul style={styles.cleanList}>
                    {(selectedOpening.requirements || []).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div style={styles.detailColumn}>
                  <h4 style={styles.sectionTitle}>Skills</h4>
                  <ul style={styles.cleanList}>
                    {(selectedOpening.skills || []).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div style={styles.detailColumn}>
                  <h4 style={styles.sectionTitle}>Perks</h4>
                  <ul style={styles.cleanList}>
                    {(selectedOpening.perks || []).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </>
            ) : canAccessManagement ? (
              <div style={styles.emptyState}>
                <h4>Careers studio is ready</h4>
                <p>Create and publish the first opening from the new Careers Studio tab.</p>
                <div style={styles.actionRow}>
                  <button type="button" style={styles.primaryButton} onClick={() => setCategory("studio")}>
                    Open Careers Studio
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );

  const renderStudio = () => {
    const studioNav = [
      { id: "openings", label: "Openings Studio", copy: "Create and refine hiring briefs." },
      { id: "pipeline", label: "Applications Pipeline", copy: "Review received applications and move candidates forward." },
    ];

    const renderOpeningsStudio = () => (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h3 style={styles.panelTitle}>Openings Studio</h3>
            <p style={styles.panelCopy}>Create, edit, publish, and feature polished career openings from one focused control surface.</p>
          </div>
        </div>
        <div style={styles.studioGrid}>
          <aside style={styles.studioRail}>
            <div style={styles.studioRailHeader}>
              <span style={styles.studioEyebrow}>Saved openings</span>
              <strong>{(managementOverview.openings || []).length} role briefs</strong>
              <p>Pick an opening to edit it, or start a fresh one with a clean form.</p>
            </div>
            <div style={styles.managementList}>
              {(managementOverview.openings || []).map((opening) => (
                <button
                  key={opening.id}
                  type="button"
                  style={{
                    ...styles.managementListItem,
                    ...(editingOpeningId === opening.id ? styles.managementListItemActive : {}),
                  }}
                onClick={() => {
                  if (editingOpeningId === opening.id) {
                    selectOpeningForEdit(null);
                    return;
                  }
                  selectOpeningForEdit(opening);
                }}
              >
                <strong>{opening.title}</strong>
                <span>{opening.department}</span>
                <span>{opening.totalApplications || 0} active applicants</span>
              </button>
            ))}
          </div>
          </aside>

          <div style={styles.studioEditor}>
            <div style={styles.studioEditorHeader}>
              <div>
                <span style={styles.studioEyebrow}>{editingOpeningId ? "Editing opening" : "New opening"}</span>
                <h4 style={styles.studioEditorTitle}>{editingOpeningId ? "Update the selected role brief" : "Build a premium opening brief"}</h4>
              </div>
              <div style={styles.studioBadgeRow}>
                <span style={styles.studioMetricBadge}>{openingForm.isPublished ? "Live" : "Draft"}</span>
                {openingForm.isFeatured ? <span style={styles.studioMetricBadge}>Featured</span> : null}
              </div>
            </div>
            <div style={styles.formGrid}>
              <input style={styles.input} placeholder="Role title" value={openingForm.title} onChange={(e) => setOpeningForm((c) => ({ ...c, title: e.target.value }))} />
              <input style={styles.input} placeholder="Department" value={openingForm.department} onChange={(e) => setOpeningForm((c) => ({ ...c, department: e.target.value }))} />
              <input style={styles.input} placeholder="Location" value={openingForm.location} onChange={(e) => setOpeningForm((c) => ({ ...c, location: e.target.value }))} />
              <select style={styles.input} value={openingForm.workMode} onChange={(e) => setOpeningForm((c) => ({ ...c, workMode: e.target.value }))}>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
              </select>
              <select style={styles.input} value={openingForm.employmentType} onChange={(e) => setOpeningForm((c) => ({ ...c, employmentType: e.target.value }))}>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Internship</option>
              </select>
              <input style={styles.input} placeholder="Experience level" value={openingForm.experienceLevel} onChange={(e) => setOpeningForm((c) => ({ ...c, experienceLevel: e.target.value }))} />
              <input style={styles.input} placeholder="Salary range" value={openingForm.salaryRange} onChange={(e) => setOpeningForm((c) => ({ ...c, salaryRange: e.target.value }))} />
              <input style={styles.input} type="number" min="1" placeholder="Seats open" value={openingForm.seatsOpen} onChange={(e) => setOpeningForm((c) => ({ ...c, seatsOpen: e.target.value }))} />
              <input style={styles.input} type="datetime-local" value={openingForm.applicationDeadline} onChange={(e) => setOpeningForm((c) => ({ ...c, applicationDeadline: e.target.value }))} />
              <textarea style={styles.textareaWide} rows={4} placeholder="Role summary" value={openingForm.summary} onChange={(e) => setOpeningForm((c) => ({ ...c, summary: e.target.value }))} />
              <textarea style={styles.textareaWide} rows={4} placeholder="Responsibilities, one per line" value={openingForm.responsibilities} onChange={(e) => setOpeningForm((c) => ({ ...c, responsibilities: e.target.value }))} />
              <textarea style={styles.textareaWide} rows={4} placeholder="Requirements, one per line" value={openingForm.requirements} onChange={(e) => setOpeningForm((c) => ({ ...c, requirements: e.target.value }))} />
              <textarea style={styles.textareaWide} rows={4} placeholder="Perks, one per line" value={openingForm.perks} onChange={(e) => setOpeningForm((c) => ({ ...c, perks: e.target.value }))} />
              <textarea style={styles.textareaWide} rows={3} placeholder="Skills, one per line" value={openingForm.skills} onChange={(e) => setOpeningForm((c) => ({ ...c, skills: e.target.value }))} />
              <div style={styles.studioToggleRow}>
                <label style={styles.checkboxField}>
                  <input type="checkbox" checked={openingForm.isPublished} onChange={(e) => setOpeningForm((c) => ({ ...c, isPublished: e.target.checked }))} />
                  <span>Publish this opening</span>
                </label>
                <label style={styles.checkboxField}>
                  <input type="checkbox" checked={openingForm.isFeatured} onChange={(e) => setOpeningForm((c) => ({ ...c, isFeatured: e.target.checked }))} />
                  <span>Feature on top</span>
                </label>
              </div>
              <button type="button" style={styles.primaryButton} onClick={handleSaveOpening} disabled={savingOpening}>
                {savingOpening ? "Saving..." : editingOpeningId ? "Update Opening" : "Create Opening"}
              </button>
            </div>
          </div>
        </div>
      </section>
    );

    const renderPipelineStudio = () => (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h3 style={styles.panelTitle}>Applications Pipeline</h3>
            <p style={styles.panelCopy}>Review received applications, assign owners, download resumes, and move candidates through a cleaner hiring workflow.</p>
          </div>
          <div style={styles.filterRow}>
            <input style={styles.inputCompact} placeholder="Search applicant" value={queueSearch} onChange={(e) => setQueueSearch(e.target.value)} />
            <select style={styles.inputCompact} value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {MANAGEMENT_APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.pipelineSummary}>
          {[
            ["Openings", managementOverview.summary.totalOpenings || 0],
            ["Applications", managementOverview.summary.totalApplications || 0],
            ["In Review", managementOverview.summary.inReview || 0],
            ["Shortlisted", managementOverview.summary.shortlisted || 0],
            ["Interviews", managementOverview.summary.interviewScheduled || 0],
          ].map(([label, value]) => (
            <div key={label} style={styles.pipelineStatCard}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div style={styles.stack}>
          {applicantQueue.length === 0 ? (
            <div style={styles.emptyState}>
              <h4>No applicants matched</h4>
              <p>Adjust the filters or wait for new submissions to arrive.</p>
            </div>
          ) : applicantQueue.map((application) => {
            const draft = applicationDrafts[application.id] || {
              status: application.status,
              adminMessage: application.adminMessage || "",
              assignedManagerUserId: application.assignedManagerUserId || "",
            };
            return (
              <article key={application.id} style={styles.pipelineCard}>
                <div style={styles.applicationCardHead}>
                  <div>
                    <strong>{application.fullName}</strong>
                    <p>{application.openingTitle} | {application.email} | {application.mobile}</p>
                  </div>
                  <span style={{ ...styles.statusPill, ...statusStyle(application.status) }}>{application.status}</span>
                </div>
                <div style={styles.applicationMeta}>
                  <span>#{application.applicationCode}</span>
                  <span>{application.currentRole || "Role not shared"} @ {application.currentCompany || "No company"}</span>
                  <span>{application.totalExperience || "Experience not shared"}</span>
                </div>
                <div style={styles.formGrid}>
                  <select style={styles.input} value={draft.status} onChange={(e) => handleApplicationDraftChange(application.id, "status", e.target.value)}>
                    {MANAGEMENT_APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <select style={styles.input} value={draft.assignedManagerUserId || ""} onChange={(e) => handleApplicationDraftChange(application.id, "assignedManagerUserId", e.target.value)}>
                    <option value="">Unassigned</option>
                    {managementUsers.filter((item) => !item.accessSuspended).map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.fullName}</option>
                    ))}
                  </select>
                  <textarea style={styles.textareaWide} rows={4} placeholder="Internal note or candidate update" value={draft.adminMessage || ""} onChange={(e) => handleApplicationDraftChange(application.id, "adminMessage", e.target.value)} />
                </div>
                <div style={styles.actionRow}>
                  {application.hasResume ? (
                    <button type="button" style={styles.ghostButton} onClick={() => downloadCareerResume(application.id)}>
                      Download Resume
                    </button>
                  ) : null}
                  <button type="button" style={styles.primaryButton} onClick={() => handleApplicationStatusSave(application.id)}>
                    Save Update
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );

    return (
      <div style={styles.stack}>
        <div style={styles.studioTabsRow}>
          {studioNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStudioSection(item.id)}
              style={{
                ...styles.studioPill,
                ...(studioSection === item.id ? styles.studioPillActive : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {studioSection === "openings" ? renderOpeningsStudio() : renderPipelineStudio()}
      </div>
    );
  };

  const renderApplications = () => (
    <div style={styles.stack}>
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h3 style={styles.panelTitle}>Apply With A Complete Profile</h3>
            <p style={styles.panelCopy}>Candidates can submit a proper professional profile with compensation, notice period, links, and resume attachment.</p>
          </div>
        </div>

        {!currentUser?.id ? (
          <div style={styles.emptyState}>
            <h4>Login required</h4>
            <p>Sign in to apply for openings and track your application progress.</p>
          </div>
        ) : (
          <div style={styles.formGrid}>
            <select style={styles.input} value={applicationOpeningId} onChange={(event) => setApplicationOpeningId(event.target.value)}>
              <option value="">Select an opening</option>
              {openings.map((opening) => (
                <option key={opening.id} value={opening.id}>
                  {opening.title} | {opening.department}
                </option>
              ))}
            </select>
            <input style={styles.input} placeholder="Full name" value={applicationForm.fullName} onChange={(e) => handleApplicationChange("fullName", e.target.value)} />
            <input style={styles.input} placeholder="Email" value={applicationForm.email} onChange={(e) => handleApplicationChange("email", e.target.value)} />
            <input style={styles.input} placeholder="Mobile" value={applicationForm.mobile} onChange={(e) => handleApplicationChange("mobile", e.target.value)} />
            <input style={styles.input} placeholder="City" value={applicationForm.city} onChange={(e) => handleApplicationChange("city", e.target.value)} />
            <input style={styles.input} placeholder="Current company" value={applicationForm.currentCompany} onChange={(e) => handleApplicationChange("currentCompany", e.target.value)} />
            <input style={styles.input} placeholder="Current role" value={applicationForm.currentRole} onChange={(e) => handleApplicationChange("currentRole", e.target.value)} />
            <input style={styles.input} placeholder="Total experience" value={applicationForm.totalExperience} onChange={(e) => handleApplicationChange("totalExperience", e.target.value)} />
            <input style={styles.input} placeholder="Notice period" value={applicationForm.noticePeriod} onChange={(e) => handleApplicationChange("noticePeriod", e.target.value)} />
            <input style={styles.input} placeholder="Current CTC" value={applicationForm.currentCtc} onChange={(e) => handleApplicationChange("currentCtc", e.target.value)} />
            <input style={styles.input} placeholder="Expected CTC" value={applicationForm.expectedCtc} onChange={(e) => handleApplicationChange("expectedCtc", e.target.value)} />
            <input style={styles.input} placeholder="Portfolio URL" value={applicationForm.portfolioUrl} onChange={(e) => handleApplicationChange("portfolioUrl", e.target.value)} />
            <input style={styles.input} placeholder="LinkedIn URL" value={applicationForm.linkedinUrl} onChange={(e) => handleApplicationChange("linkedinUrl", e.target.value)} />
            <textarea style={styles.textareaWide} rows={5} placeholder="Cover letter" value={applicationForm.coverLetter} onChange={(e) => handleApplicationChange("coverLetter", e.target.value)} />
            <div style={styles.fileField}>
              <label style={styles.fileLabel}>Resume (PDF, DOC, DOCX)</label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={(event) => handleApplicationChange("resume", event.target.files?.[0] || null)} />
              <span style={styles.helperText}>{applicationForm.resume?.name || "No file selected"}</span>
            </div>
            <button type="button" style={styles.primaryButton} onClick={handleSubmitApplication} disabled={submittingApplication}>
              {submittingApplication ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h3 style={styles.panelTitle}>My Applications</h3>
            <p style={styles.panelCopy}>Track every application with recruiter comments, assignments, and timeline-aware status updates.</p>
          </div>
        </div>
        {userApplications.length === 0 ? (
          <div style={styles.emptyState}>
            <h4>No applications yet</h4>
            <p>Apply for one of the open roles and the status history will appear here.</p>
          </div>
        ) : (
          <div style={styles.stack}>
            {userApplications.map((item) => (
              <article key={item.id} style={styles.applicationCard}>
                <div style={styles.applicationCardHead}>
                  <div>
                    <strong>{item.openingTitle}</strong>
                    <p>{item.openingDepartment} | {item.openingLocation}</p>
                  </div>
                  <span style={{ ...styles.statusPill, ...statusStyle(item.status) }}>{item.status}</span>
                </div>
                <div style={styles.applicationMeta}>
                  <span>Application #{item.applicationCode}</span>
                  <span>Submitted {formatDateTime(item.createdAt)}</span>
                  <span>{item.assignedManagerName ? `Assigned to ${item.assignedManagerName}` : "Not assigned yet"}</span>
                </div>
                {item.adminMessage ? <p style={styles.applicationNote}>{item.adminMessage}</p> : null}
                <div style={styles.actionRow}>
                  {item.hasResume ? (
                    <button type="button" style={styles.ghostButton} onClick={() => downloadCareerResume(item.id)}>
                      Download Resume
                    </button>
                  ) : null}
                  {!["Hired", "Rejected", "Withdrawn"].includes(item.status) ? (
                    <button type="button" style={styles.ghostDangerButton} onClick={() => handleWithdraw(item.id)}>
                      Withdraw
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );

  const renderStaticSection = (title, points, accent) => (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.panelTitle}>{title}</h3>
          <p style={styles.panelCopy}>Designed to feel more deliberate, more premium, and more informative than the earlier placeholder content.</p>
        </div>
      </div>
      <div style={styles.storyPanel}>
        {points.map((item) => (
          <article key={item} style={{ ...styles.storyCard, borderColor: accent }}>
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  );

  const content = (() => {
    if (selectedCategory === "positions") {
      return renderOpeningHighlights();
    }
    if (selectedCategory === "life") {
      return renderStaticSection("Life At Unified AI Workspace", CULTURE_POINTS, "#214d8f");
    }
    if (selectedCategory === "internship") {
      return renderStaticSection("Internship Program", INTERNSHIP_POINTS, "#16735d");
    }
    if (selectedCategory === "process") {
      return renderStaticSection("Hiring Process", PROCESS_STEPS, "#8f5a21");
    }
    if (selectedCategory === "applications") {
      return renderApplications();
    }
    if (selectedCategory === "studio" && canAccessManagement) {
      return renderStudio();
    }
    return renderOpeningHighlights();
  })();

  return (
    <div style={embedded ? styles.embeddedPage : styles.page}>
      {!embedded ? renderSidebar() : null}
      <div style={styles.main}>
        {embedded && !hideEmbeddedTabs ? (
          <div style={styles.inlineTabs}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                style={{
                  ...styles.inlineTab,
                  ...(selectedCategory === tab.id ? styles.inlineTabActive : {}),
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
        {loading ? <div style={styles.emptyState}><h4>Loading careers</h4><p>Fetching live openings and application data.</p></div> : null}
        {statusMessage ? <p style={styles.successText}>{statusMessage}</p> : null}
        {errorMessage ? <p style={styles.errorText}>{errorMessage}</p> : null}
        {!loading ? content : null}
      </div>
    </div>
  );
}

const styles = {
  page: { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: "24px", minHeight: "100%" },
  embeddedPage: { display: "block" },
  sidebar: { background: "linear-gradient(180deg, #f3f7ff 0%, #eef2fb 100%)", border: "1px solid #d9e2f4", borderRadius: "24px", padding: "24px", alignSelf: "start", position: "sticky", top: "24px" },
  sidebarTitle: { margin: 0, fontSize: "30px", color: "#17315f" },
  sidebarCopy: { color: "#5a6780", lineHeight: 1.6 },
  sidebarTabs: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" },
  sidebarTab: { border: "1px solid #c9d5ec", borderRadius: "14px", background: "#ffffff", color: "#1d325d", padding: "14px 16px", textAlign: "left", cursor: "pointer", fontWeight: 600 },
  sidebarTabActive: { background: "linear-gradient(135deg, #17315f 0%, #2b5ca9 100%)", color: "#ffffff", borderColor: "#17315f", boxShadow: "0 16px 32px rgba(23,49,95,0.18)" },
  sidebarFootnote: { marginTop: "20px", padding: "16px", borderRadius: "16px", background: "#ffffff", border: "1px solid #d7e1f1", color: "#58657b", lineHeight: 1.6 },
  main: { display: "flex", flexDirection: "column", gap: "20px" },
  inlineTabs: { display: "flex", flexWrap: "wrap", gap: "10px" },
  inlineTab: { padding: "12px 16px", borderRadius: "999px", border: "1px solid #c6d3eb", background: "#f8fbff", color: "#22406f", cursor: "pointer", fontWeight: 600 },
  inlineTabActive: { background: "#17315f", color: "#fff", borderColor: "#17315f" },
  heroSection: { display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 0.9fr)", gap: "20px" },
  heroCopy: { padding: "28px", borderRadius: "28px", background: "linear-gradient(135deg, #17315f 0%, #234e93 58%, #3f7ad8 100%)", color: "#fff", boxShadow: "0 20px 60px rgba(24,51,95,0.24)" },
  heroEyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.8 },
  heroTitle: { fontSize: "34px", lineHeight: 1.15, margin: "14px 0 12px" },
  heroText: { fontSize: "15px", lineHeight: 1.7, maxWidth: "720px", opacity: 0.92 },
  heroPanel: { padding: "24px", borderRadius: "28px", background: "linear-gradient(180deg, #fffdf7 0%, #fff7e8 100%)", border: "1px solid #f0ddaf", color: "#5f4b1b" },
  heroPanelLabel: { marginTop: 0, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 },
  heroList: { paddingLeft: "18px", lineHeight: 1.8 },
  heroStats: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginTop: "20px" },
  statCard: { background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "18px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "6px" },
  openingsGrid: { display: "grid", gridTemplateColumns: "minmax(280px, 0.8fr) minmax(0, 1.2fr)", gap: "18px" },
  roleRail: { display: "flex", flexDirection: "column", gap: "14px" },
  roleCard: { borderRadius: "20px", border: "1px solid #d7e3f7", background: "#fff", padding: "18px", textAlign: "left", cursor: "pointer", boxShadow: "0 10px 30px rgba(22,43,79,0.06)" },
  roleCardActive: { borderColor: "#285ca8", boxShadow: "0 18px 44px rgba(40,92,168,0.18)" },
  roleCardHeader: { display: "flex", justifyContent: "space-between", gap: "12px" },
  featureBadge: { alignSelf: "flex-start", padding: "6px 10px", borderRadius: "999px", background: "#fff1c7", color: "#7d5e06", fontSize: "12px", fontWeight: 700 },
  roleMetaRow: { display: "flex", flexWrap: "wrap", gap: "10px", color: "#627089", fontSize: "13px", marginTop: "10px" },
  roleDetailCard: { borderRadius: "28px", background: "#ffffff", border: "1px solid #dbe5f4", padding: "26px", boxShadow: "0 14px 42px rgba(21,40,74,0.08)" },
  roleDetailHead: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" },
  roleDetailCode: { display: "inline-block", color: "#667894", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase" },
  roleDetailTitle: { margin: "10px 0 8px", fontSize: "32px", color: "#17315f" },
  roleDetailSummary: { margin: 0, color: "#54627a", lineHeight: 1.7 },
  badgeRow: { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "18px" },
  badge: { padding: "8px 12px", borderRadius: "999px", background: "#eff5ff", color: "#1e4f98", fontSize: "13px", fontWeight: 600 },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", marginTop: "22px" },
  detailColumn: { borderRadius: "20px", border: "1px solid #e4ebf6", background: "#fbfdff", padding: "18px" },
  sectionTitle: { marginTop: 0, marginBottom: "10px", color: "#17315f" },
  cleanList: { margin: 0, paddingLeft: "18px", color: "#54627a", lineHeight: 1.8 },
  stack: { display: "flex", flexDirection: "column", gap: "18px" },
  panel: { borderRadius: "24px", background: "#ffffff", border: "1px solid #dbe4f3", padding: "22px", boxShadow: "0 12px 36px rgba(19,36,67,0.06)" },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: "18px", marginBottom: "16px", alignItems: "flex-start", flexWrap: "wrap" },
  panelTitle: { margin: 0, fontSize: "24px", color: "#17315f" },
  panelCopy: { margin: "8px 0 0", color: "#5d6a80", lineHeight: 1.6, maxWidth: "760px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  input: { width: "100%", borderRadius: "14px", border: "1px solid #cfdaec", padding: "12px 14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box" },
  inputCompact: { borderRadius: "12px", border: "1px solid #cfdaec", padding: "10px 12px", minWidth: "180px", background: "#fff" },
  textareaWide: { gridColumn: "1 / -1", width: "100%", borderRadius: "16px", border: "1px solid #cfdaec", padding: "14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box" },
  fileField: { gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "8px", padding: "14px", borderRadius: "16px", border: "1px dashed #c7d5eb", background: "#f8fbff" },
  fileLabel: { fontWeight: 700, color: "#17315f" },
  helperText: { color: "#6b7890", fontSize: "13px" },
  primaryButton: { border: "none", borderRadius: "14px", background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#fff", padding: "12px 18px", cursor: "pointer", fontWeight: 700, boxShadow: "0 14px 28px rgba(23,49,95,0.18)" },
  ghostButton: { border: "1px solid #cad7eb", borderRadius: "12px", background: "#fff", color: "#17315f", padding: "10px 14px", cursor: "pointer", fontWeight: 600 },
  ghostDangerButton: { border: "1px solid #efc0c0", borderRadius: "12px", background: "#fff6f6", color: "#963939", padding: "10px 14px", cursor: "pointer", fontWeight: 600 },
  applicationCard: { borderRadius: "18px", border: "1px solid #dde6f4", background: "#fbfdff", padding: "18px" },
  pipelineCard: { borderRadius: "24px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #ffffff 0%, #fafdff 100%)", padding: "20px", boxShadow: "0 16px 40px rgba(19,36,67,0.06)" },
  applicationCardHead: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" },
  applicationMeta: { display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "10px", color: "#66748d", fontSize: "13px" },
  applicationNote: { marginTop: "12px", padding: "12px 14px", borderRadius: "14px", background: "#eef4ff", color: "#244e91" },
  statusPill: { display: "inline-flex", alignItems: "center", padding: "8px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 700 },
  actionRow: { display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "14px" },
  managementLayout: { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: "16px" },
  managementList: { display: "flex", flexDirection: "column", gap: "10px" },
  managementListItem: { textAlign: "left", borderRadius: "16px", border: "1px solid #d5dff0", background: "#fbfdff", padding: "14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px", color: "#17315f" },
  managementEditor: { borderRadius: "18px", border: "1px solid #dde6f4", background: "#fbfdff", padding: "16px" },
  filterRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  pipelineSummary: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px", marginBottom: "16px" },
  pipelineStatCard: { borderRadius: "18px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)", padding: "16px", display: "flex", flexDirection: "column", gap: "8px", color: "#17315f" },
  studioTabsRow: { display: "flex", flexWrap: "wrap", gap: "12px", paddingBottom: "2px" },
  studioPill: { padding: "14px 22px", borderRadius: "999px", border: "1px solid #c6d3eb", background: "#f8fbff", color: "#22406f", cursor: "pointer", fontWeight: 700, boxShadow: "0 8px 22px rgba(20,42,80,0.05)" },
  studioPillActive: { background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#ffffff", borderColor: "#17315f", boxShadow: "0 14px 28px rgba(23,49,95,0.18)" },
  studioEyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.82 },
  studioGrid: { display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: "18px" },
  studioRail: { borderRadius: "24px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)", padding: "18px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: "0 16px 40px rgba(19,36,67,0.05)" },
  studioRailHeader: { display: "grid", gap: "6px", color: "#5d6a80", lineHeight: 1.6 },
  managementListItemActive: { borderColor: "#285ca8", background: "linear-gradient(180deg, #eef4ff 0%, #ffffff 100%)", boxShadow: "0 14px 32px rgba(40,92,168,0.14)" },
  studioEditor: { borderRadius: "26px", border: "1px solid #dbe5f4", background: "#ffffff", padding: "20px", boxShadow: "0 18px 48px rgba(19,36,67,0.08)" },
  studioEditorHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap" },
  studioEditorTitle: { margin: "8px 0 0", fontSize: "24px", color: "#17315f" },
  studioBadgeRow: { display: "flex", flexWrap: "wrap", gap: "8px" },
  studioMetricBadge: { display: "inline-flex", alignItems: "center", padding: "8px 12px", borderRadius: "999px", background: "#eef4ff", color: "#244e91", fontSize: "12px", fontWeight: 700 },
  studioToggleRow: { gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "16px", padding: "4px 0" },
  storyPanel: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" },
  storyCard: { borderRadius: "18px", border: "1px solid #d7e3f7", background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)", padding: "18px", color: "#52627a", lineHeight: 1.7 },
  checkboxField: { display: "flex", alignItems: "center", gap: "10px", color: "#17315f", fontWeight: 600 },
  emptyState: { borderRadius: "18px", border: "1px dashed #ccd8eb", background: "#f8fbff", padding: "24px", color: "#5d6a80" },
  successText: { color: "#0f6a3e", margin: 0, fontWeight: 600 },
  errorText: { color: "#9f3f3f", margin: 0, fontWeight: 600 },
};

export default Careers;
