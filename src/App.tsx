import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { NavLink, Navigate, Route, Routes, useParams } from "react-router-dom";
import {
  Activity,
  Archive,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Filter,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  formatDate,
  session,
  type Activity as ActivityItem,
  type Contract,
  type DocumentItem,
  type Lead,
  type LeadState,
  type ProductLine,
  type Role,
  type SigningRequest,
  type Task,
} from "./api";

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;
type Notice = { message: string; tone?: "success" | "error" };

const states: { label: string; value: LeadState; tone: string }[] = [
  { label: "New", value: "New", tone: "slate" },
  { label: "Inquiry", value: "Inquiry", tone: "blue" },
  { label: "Incomplete", value: "InquiryIncomplete", tone: "amber" },
  { label: "Nurturing", value: "Nurturing", tone: "violet" },
  { label: "Follow-up", value: "FollowUp", tone: "orange" },
  { label: "Qualified", value: "Qualified", tone: "green" },
  { label: "Invoice & Documents", value: "DownPaymentPending", tone: "pink" },
  { label: "Payment confirmed", value: "DownPaymentConfirmed", tone: "green" },
  { label: "Contract drafting", value: "ContractDrafting", tone: "blue" },
  { label: "Contract review", value: "ContractReview", tone: "indigo" },
  { label: "Contract signed", value: "ContractSigned", tone: "green" },
  { label: "Pre-launch", value: "PreLaunch", tone: "teal" },
  { label: "Endorsed", value: "EndorsedToAdmin", tone: "red" },
];

const pipelineStages: {
  key: string;
  label: string;
  description: string;
  tone: string;
  values: LeadState[];
}[] = [
  {
    key: "new",
    label: "New",
    description: "New opportunities",
    tone: "slate",
    values: ["New"],
  },
  {
    key: "inquiry",
    label: "Inquiry",
    description: "Capture the required details",
    tone: "blue",
    values: ["Inquiry", "InquiryIncomplete"],
  },
  {
    key: "qualification",
    label: "Qualification",
    description: "Confirm readiness to proceed",
    tone: "violet",
    values: ["Nurturing", "FollowUp"],
  },
  {
    key: "invoice-documents",
    label: "Invoice & Documents",
    description: "Agent prepares the invoice and signature scan",
    tone: "pink",
    values: ["Qualified", "DownPaymentPending"],
  },
  {
    key: "finance-confirmation",
    label: "Finance confirmation",
    description: "Finance verifies the payment",
    tone: "orange",
    values: ["DownPaymentPending"],
  },
  {
    key: "contract",
    label: "Contract",
    description: "Draft, review, and sign",
    tone: "indigo",
    values: [
      "DownPaymentConfirmed",
      "ContractDrafting",
      "ContractReview",
      "ContractSigned",
    ],
  },
  {
    key: "prelaunch",
    label: "Pre-launch",
    description: "Complete launch readiness",
    tone: "teal",
    values: ["PreLaunch"],
  },
  {
    key: "endorsed",
    label: "Endorsed",
    description: "Handoff to the Admin Team",
    tone: "red",
    values: ["EndorsedToAdmin"],
  },
];

type PipelineFilter = "all" | "mine" | "attention" | "overdue";

function pipelineStageForLead(lead: Lead, submittedForFinance = false) {
  if (lead.state === "DownPaymentPending") {
    return pipelineStages.find(
      (stage) =>
        stage.key ===
        (submittedForFinance ? "finance-confirmation" : "invoice-documents"),
    )!;
  }
  return (
    pipelineStages.find((stage) => stage.values.includes(lead.state)) ??
    pipelineStages[0]
  );
}
function pipelineStageLabel(state: LeadState, submittedForFinance = false) {
  return pipelineStageForLead({ state } as Lead, submittedForFinance).label;
}
function ageInDays(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp)
    ? 0
    : Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
}
function relativeAge(value: string) {
  const days = ageInDays(value);
  return days === 0 ? "today" : days === 1 ? "1d" : `${days}d`;
}
function isOverdueLead(lead: Lead) {
  return lead.state === "FollowUp" || ageInDays(lead.updatedAt) >= 7;
}
function isAttentionLead(lead: Lead) {
  return (
    [
      "InquiryIncomplete",
      "FollowUp",
      "Qualified",
      "DownPaymentPending",
      "ContractReview",
    ].includes(lead.state) || isOverdueLead(lead)
  );
}
function leadFlag(lead: Lead) {
  if (lead.state === "InquiryIncomplete") return "Missing information";
  if (lead.state === "FollowUp") return "Follow-up needed";
  if (lead.state === "Nurturing") return "Nurturing";
  if (lead.state === "Qualified") return "Invoice pending";
  if (isOverdueLead(lead)) return "Stale";
  return null;
}

type NextStep = { label: string; detail: string; tab: string };

const contractTemplateOptions = [
  { code: "STANDARD_FRANCHISE", label: "Standard Franchise Agreement" },
] as const;

function contractTemplateLabel(code?: string | null) {
  return (
    contractTemplateOptions.find((option) => option.code === code)?.label ??
    "Configured contract template"
  );
}

function hasRequiredDocuments(documents: DocumentItem[]) {
  const uploaded = new Set(
    documents
      .filter((item) => item.status === "Uploaded")
      .map((item) => item.documentType),
  );
  return (
    uploaded.has("VALID_ID_SIGNATURES") ||
    [
      "VALID_ID",
      "SPECIMEN_SIGNATURE_1",
      "SPECIMEN_SIGNATURE_2",
      "SPECIMEN_SIGNATURE_3",
    ].every((type) => uploaded.has(type))
  );
}

type LocationDecision = "Pending" | "Passed" | "Failed";

function normaliseLocationDecision(
  value: string | undefined,
): LocationDecision {
  if (value?.toLowerCase() === "passed") return "Passed";
  if (value?.toLowerCase() === "failed") return "Failed";
  return "Pending";
}

const lifecycleSteps = [
  { label: "Inquiry", tab: "Inquiry" },
  { label: "Qualification", tab: "Qualification" },
  { label: "Invoice & Documents", tab: "Workflow" },
  { label: "Finance verification", tab: "Workflow" },
  { label: "Contract", tab: "Contract" },
  { label: "Pre-launch", tab: "Pre-launch" },
  { label: "Handoff", tab: "Handoff" },
];

function workflowStateIndex(
  state: LeadState,
  payment?: Record<string, unknown> | null,
) {
  if (state === "New") return 0;
  if (["Inquiry", "InquiryIncomplete"].includes(state)) return 0;
  if (["Nurturing", "FollowUp"].includes(state)) return 1;
  if (state === "Qualified") return 2;
  if (state === "DownPaymentPending")
    return payment?.submittedForFinance ? 3 : 2;
  if (state === "DownPaymentConfirmed") return 4;
  if (["ContractDrafting", "ContractReview"].includes(state))
    return 4;
  if (["ContractSigned", "PreLaunch"].includes(state)) return 5;
  return 6;
}

function lifecycleStageForLead(
  state: LeadState,
  payment?: Record<string, unknown> | null,
) {
  return lifecycleSteps[workflowStateIndex(state, payment)];
}

function nextStepForLead(lead: Lead, submittedForFinance = false): NextStep {
  submittedForFinance =
    submittedForFinance || Boolean(lead.downPaymentSubmittedForFinance);
  switch (lead.state) {
    case "New":
      return {
        label: "Start inquiry",
        detail: "Open the inquiry and capture the franchisee details.",
        tab: "Inquiry",
      };
    case "Inquiry":
      return {
        label: "Complete inquiry",
        detail: "Finish the required information, then submit the inquiry.",
        tab: "Inquiry",
      };
    case "InquiryIncomplete":
      return {
        label: "Complete missing information",
        detail:
          "Review the inquiry tab to see which required fields are still missing.",
        tab: "Inquiry",
      };
    case "Nurturing":
      return {
        label: "Record contact, then qualify",
        detail:
          "Open Workflow to record the contact, then choose Qualified or Follow-up.",
        tab: "Workflow",
      };
    case "FollowUp":
      return {
        label: "Complete follow-up, then reassess",
        detail:
          "Review the follow-up outcome in Workflow and choose the next decision.",
        tab: "Workflow",
      };
    case "Qualified":
      return {
        label: "Upload required documents",
        detail:
          "Upload the combined valid ID and three specimen signatures file before generating the invoice.",
        tab: "Workflow",
      };
    case "DownPaymentPending":
      if (!submittedForFinance) {
        return {
          label: "Submit to Finance",
          detail:
            "Submit the invoice and required documents so Finance can verify payment.",
          tab: "Workflow",
        };
      }
      return {
        label: "Confirm down payment",
        detail: "Finance must verify the payment and required documents.",
        tab: "Workflow",
      };
    case "DownPaymentConfirmed":
      return {
        label: "Prepare contract",
        detail: "Generate the contract using the approved franchise terms.",
        tab: "Workflow",
      };
    case "ContractDrafting":
      return {
        label: "Submit contract for review",
        detail:
          "Check the contract details and send it to the General Manager.",
        tab: "Workflow",
      };
    case "ContractReview":
      return {
        label: "Complete GM review",
        detail:
          "The General Manager must approve the contract or request revisions.",
        tab: "Workflow",
      };
    case "ContractSigned":
      return {
        label: "Complete pre-launch",
        detail:
          "Initialize and complete the product-specific readiness checklist.",
        tab: "Workflow",
      };
    case "PreLaunch":
      return {
        label: "Complete pre-launch",
        detail: "Finish every required readiness item before handoff.",
        tab: "Workflow",
      };
    case "EndorsedToAdmin":
      return {
        label: "Acknowledge handoff",
        detail:
          "The Admin Team must acknowledge the completed franchise handoff.",
        tab: "Workflow",
      };
  }
}

function nextActionOwnerForLead(
  lead: Lead,
  submittedForFinance = false,
) {
  submittedForFinance =
    submittedForFinance || Boolean(lead.downPaymentSubmittedForFinance);
  const assignedAgent = lead.assignedAgentName ?? "Assigned agent";
  switch (lead.state) {
    case "DownPaymentPending":
      return submittedForFinance ? "Finance team" : assignedAgent;
    case "DownPaymentConfirmed":
    case "ContractDrafting":
      return "Marketing admin";
    case "ContractReview":
      return "General manager";
    case "EndorsedToAdmin":
      return "Admin team";
    default:
      return assignedAgent;
  }
}

const nav: { label: string; to: string; icon: Icon; roles?: Role[] }[] = [
  {
    label: "Command center",
    to: "/",
    icon: LayoutDashboard,
    roles: ["MarketingAgent", "MarketingAdmin", "GeneralManager", "Leadership"],
  },
  {
    label: "Franchise pipeline",
    to: "/pipeline",
    icon: BriefcaseBusiness,
    roles: ["MarketingAgent", "MarketingAdmin", "GeneralManager", "Leadership"],
  },
  {
    label: "My work queue",
    to: "/tasks",
    icon: ListChecks,
    roles: ["MarketingAgent", "MarketingAdmin", "GeneralManager", "Leadership"],
  },
  {
    label: "Finance",
    to: "/finance",
    icon: WalletCards,
    roles: ["Finance", "Leadership"],
  },
  {
    label: "Documents & contracts",
    to: "/contracts",
    icon: FileText,
    roles: ["MarketingAgent", "MarketingAdmin", "GeneralManager", "Leadership"],
  },
  {
    label: "Pre-launch",
    to: "/pre-launch",
    icon: ClipboardCheck,
    roles: ["MarketingAgent", "MarketingAdmin", "Leadership"],
  },
  {
    label: "Handoff queue",
    to: "/handoff",
    icon: ClipboardCheck,
    roles: ["AdminTeam", "Leadership"],
  },
  {
    label: "Reports",
    to: "/reports",
    icon: Activity,
    roles: ["MarketingAdmin", "GeneralManager", "Finance", "Leadership"],
  },
  {
    label: "Administration",
    to: "/settings",
    icon: Settings,
    roles: ["MarketingAdmin", "Leadership"],
  },
];

const leadReadRoles: Role[] = [
  "MarketingAgent",
  "MarketingAdmin",
  "GeneralManager",
  "Finance",
  "AdminTeam",
  "Leadership",
];
const pipelineReadRoles: Role[] = [
  "MarketingAgent",
  "MarketingAdmin",
  "GeneralManager",
  "Leadership",
];
const taskReadRoles: Role[] = [
  "MarketingAgent",
  "MarketingAdmin",
  "GeneralManager",
  "Leadership",
];
const leadWriteRoles: Role[] = [
  "MarketingAgent",
  "MarketingAdmin",
  "GeneralManager",
];
const marketingWriteRoles: Role[] = ["MarketingAgent", "MarketingAdmin"];

function hasRole(role: Role | undefined, roles: Role[]) {
  return !!role && roles.includes(role);
}
function canOpenPath(role: Role, path: string) {
  if (path.startsWith("/leads/")) return hasRole(role, leadReadRoles);
  if (path === "/pipeline") return hasRole(role, pipelineReadRoles);
  if (path === "/tasks") return hasRole(role, taskReadRoles);
  const item = nav.find((entry) => entry.to === path);
  return !item?.roles || item.roles.includes(role);
}

function ProtectedPage({
  role,
  path,
  children,
}: {
  role: Role;
  path: string;
  children: ReactNode;
}) {
  return canOpenPath(role, path) ? (
    <>{children}</>
  ) : (
    <Navigate to="/" replace />
  );
}

function App() {
  const publicSigningToken = window.location.pathname.match(
    /^\/sign-contract\/([^/]+)$/,
  )?.[1];
  if (publicSigningToken)
    return <ContractSignPage token={decodeURIComponent(publicSigningToken)} />;
  const [user, setUser] = useState(session.user);
  const [restoring, setRestoring] = useState(!session.user);
  useEffect(() => {
    if (session.user) {
      setRestoring(false);
      return;
    }
    api.auth
      .refresh()
      .then((response) => {
        if (response) setUser(response.user);
      })
      .finally(() => setRestoring(false));
  }, []);
  const onLogout = async () => {
    try {
      await api.auth.logout();
    } finally {
      session.clear();
      setUser(null);
    }
  };
  if (restoring) return <Loading />;
  if (!user) return <LoginPage onLogin={(next) => setUser(next)} />;
  return <Shell user={user} onLogout={onLogout} />;
}

function LoginPage({
  onLogin,
}: {
  onLogin: (user: NonNullable<typeof session.user>) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.auth.login(email, password);
      session.set(response);
      onLogin(response.user);
    } catch (e) {
      setError(errorMessage(e, "Unable to sign in."));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-lockup">
          <img
            src="/assets/header-logo-CAyF_Iur.png"
            alt="Dr. Care Medical Group"
          />
        </div>
        <div className="brand-message">
          <span className="eyebrow">INTERNAL OPERATIONS PLATFORM</span>
          <h1>Always here for the work behind the care.</h1>
          <p>
            One calm workspace for franchise growth, teams, documents, and the
            next branch.
          </p>
        </div>
        <div className="login-decoration">
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to Dr. Care</h2>
          <p className="muted">Use your organization account to continue.</p>
          <form onSubmit={submit} className="stack-form">
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                placeholder="you@drcare.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button button-primary button-wide"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <p className="login-security">
            <ShieldCheck size={16} /> Secure session restores automatically on
            reload.
          </p>
        </div>
      </section>
    </main>
  );
}

function ContractSignPage({ token }: { token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [request, setRequest] = useState<{
    signerName: string;
    signerRole: string;
    expiresAt: string;
    documentUrl?: string;
  } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<
    "loading" | "ready" | "signed" | "error"
  >("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api.publicSigning
      .get(token)
      .then((value) => {
        setRequest(value);
        setStatus("ready");
      })
      .catch((e) => {
        setMessage(errorMessage(e, "This signing link is not available."));
        setStatus("error");
      });
  }, [token]);
  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) * canvas.width) / box.width,
      y: ((event.clientY - box.top) * canvas.height) / box.height,
    };
  };
  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    const context = event.currentTarget.getContext("2d");
    context?.beginPath();
    context?.moveTo(p.x, p.y);
  };
  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = point(event);
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#111827";
    context.lineTo(p.x, p.y);
    context.stroke();
  };
  const stop = () => {
    drawing.current = false;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };
  const sign = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !request || !accepted) return;
    const context = canvas.getContext("2d");
    if (
      !context ||
      !context
        .getImageData(0, 0, canvas.width, canvas.height)
        .data.some((value) => value !== 0)
    ) {
      setMessage("Draw your signature before signing.");
      return;
    }
    setMessage("");
    try {
      await api.publicSigning.sign(token, {
        signerName: request.signerName,
        acceptedTerms: accepted,
        signatureData: canvas.toDataURL("image/png"),
      });
      setStatus("signed");
    } catch (e) {
      setMessage(errorMessage(e, "The contract could not be signed."));
    }
  };
  return (
    <main className="public-signing-page">
      <section className="public-signing-card">
        <div className="app-mark">DC</div>
        <span className="eyebrow">DR. CARE SECURE E-SIGNATURE</span>
        {status === "loading" && <Loading />}
        {status === "error" && (
          <>
            <h1>Signing link unavailable</h1>
            <p className="form-error">{message}</p>
          </>
        )}
        {status === "signed" && (
          <div className="completion-card">
            <CheckCircle2 size={24} />
            <div>
              <strong>Contract signed successfully</strong>
              <span>
                Your signature was stamped into the private contract PDF. You
                may close this page.
              </span>
            </div>
          </div>
        )}
        {status === "ready" && request && (
          <>
            <h1>Sign the franchise agreement</h1>
            <p>
              You are signing as <strong>{request.signerName}</strong> (
              {request.signerRole}). This secure link expires{" "}
              {formatDate(request.expiresAt)}.
            </p>
            {request.documentUrl && (
              <a
                className="button button-secondary"
                href={request.documentUrl}
                target="_blank"
                rel="noreferrer"
              >
                Review contract PDF
              </a>
            )}
            <label className="signature-consent">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />{" "}
              I consent to use this electronic signature and confirm I am the
              named signer.
            </label>
            <div className="signature-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={720}
                height={220}
                onPointerDown={start}
                onPointerMove={draw}
                onPointerUp={stop}
                onPointerCancel={stop}
                aria-label="Draw signature"
              />
              <span>Draw your signature above</span>
            </div>
            {message && <div className="form-error">{message}</div>}
            <div className="button-row">
              <button className="button button-secondary" onClick={clear}>
                Clear
              </button>
              <button
                className="button button-primary"
                disabled={!accepted}
                onClick={sign}
              >
                Sign contract
              </button>
            </div>
            <p className="login-security">
              <ShieldCheck size={16} /> The signature image is validated,
              stamped into the PDF, hashed for audit, and then discarded.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

function Shell({
  user,
  onLogout,
}: {
  user: NonNullable<typeof session.user>;
  onLogout: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="app-mark">DC</div>
          <div className="sidebar-brand">
            <strong>Dr. Care</strong>
            <span>Operations</span>
          </div>
          <button
            className="icon-button sidebar-toggle"
            onClick={() =>
              mobileOpen
                ? setMobileOpen(false)
                : setCollapsed((value) => !value)
            }
            aria-label={mobileOpen ? "Close navigation" : "Toggle navigation"}
          >
            {mobileOpen ? <X size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-icon">
            <BriefcaseBusiness size={16} />
          </div>
          <div>
            <strong>Medical Group</strong>
            <span>Internal workspace</span>
          </div>
          <ChevronRight size={15} />
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav
            .filter((item) => !item.roles || item.roles.includes(user.role))
            .map((item) => {
              const IconComponent = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <IconComponent size={19} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <Sparkles size={16} />
            <span>
              <strong>Built to expand</strong>
              <small>More departments are coming.</small>
            </span>
          </div>
          <button className="user-menu" onClick={onLogout}>
            <div className="avatar avatar-small">
              {initials(user.displayName)}
            </div>
            <span>
              <strong>{user.displayName}</strong>
              <small>{roleLabel(user.role)}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/pipeline" element={<Pipeline user={user} />} />
            <Route path="/leads/:leadId" element={<LeadDetail />} />
            <Route path="/tasks" element={<Tasks user={user} />} />
            <Route
              path="/finance"
              element={
                <QueuePage
                  title="Finance queue"
                  subtitle="Payment confirmations that need a finance owner."
                  load={api.queues.finance}
                  empty="No payment confirmations are waiting."
                />
              }
            />
            <Route
              path="/contracts"
              element={
                <QueuePage
                  title="Contract review"
                  subtitle="Contracts ready for General Manager review."
                  load={api.queues.gm}
                  empty="No contracts are waiting for review."
                />
              }
            />
            <Route path="/pre-launch" element={<PreLaunchQueue />} />
            <Route path="/handoff" element={<EndorsementsQueue />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Dashboard({ user }: { user: NonNullable<typeof session.user> }) {
  if (!hasRole(user.role, pipelineReadRoles))
    return user.role === "Finance" ? (
      <Navigate to="/finance" replace />
    ) : user.role === "AdminTeam" ? (
      <Navigate to="/handoff" replace />
    ) : (
      <Page
        title="Workspace ready"
        subtitle="Your role does not have a dashboard assigned yet."
      >
        <p className="muted">
          Please use the workspace sections available to your role.
        </p>
      </Page>
    );
  return <DashboardContent user={user} />;
}

function DashboardContent({
  user,
}: {
  user: NonNullable<typeof session.user>;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api.leads.list("?limit=100&sort=updatedAt"), api.tasks.list()])
      .then(([leadResult, taskResult]) => {
        setLeads(leadResult.items);
        setTasks(taskResult);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  const attention = leads
    .filter((lead) =>
      [
        "InquiryIncomplete",
        "FollowUp",
        "Qualified",
        "DownPaymentPending",
        "ContractReview",
      ].includes(lead.state),
    )
    .slice(0, 5);
  const openTasks = tasks.filter((task) => task.status === "Open").length;
  return (
    <Page
      title={`Good morning, ${firstName(user.displayName)}.`}
      subtitle="Here is the pulse of your Dr. Care workspace."
      actions={
        <NavLink to="/pipeline" className="button button-primary">
          <Plus size={17} /> Add franchise lead
        </NavLink>
      }
    >
      <section className="hero-strip">
        <div>
          <span className="eyebrow">YOUR OPERATING RHYTHM</span>
          <h2>Make the next right move.</h2>
          <p>
            Keep every franchise opportunity moving with clarity, care, and a
            visible owner.
          </p>
        </div>
        <div className="hero-orbit">
          <div className="orbit-core">DC</div>
          <span className="orbit-dot one" />
          <span className="orbit-dot two" />
          <span className="orbit-dot three" />
        </div>
      </section>
      <section className="metric-grid">
        <Metric
          label="Active opportunities"
          value={loading ? "—" : String(leads.length)}
          hint="Across your pipeline"
          icon={BriefcaseBusiness}
          tone="red"
        />
        <Metric
          label="Need attention"
          value={loading ? "—" : String(attention.length)}
          hint="Priority work items"
          icon={Clock3}
          tone="amber"
        />
        <Metric
          label="Open tasks"
          value={loading ? "—" : String(openTasks)}
          hint="Assigned to your team"
          icon={ListChecks}
          tone="blue"
        />
        <Metric
          label="Qualified"
          value={
            loading
              ? "—"
              : String(
                  leads.filter((lead) => lead.state === "Qualified").length,
                )
          }
          hint="Ready for the next step"
          icon={CheckCircle2}
          tone="green"
        />
      </section>
      <div className="dashboard-grid">
        <section className="panel attention-panel">
          <PanelHeader
            title="Needs your attention"
            subtitle="The work most likely to move the pipeline today."
            action={
              <NavLink to="/pipeline" className="text-link">
                View pipeline <ArrowUpRight size={14} />
              </NavLink>
            }
          />
          {attention.length === 0 && !loading ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing urgent right now"
              text="Your workspace is caught up. Nice work."
            />
          ) : (
            <div className="attention-list">
              {attention.map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </section>
        <section className="panel pulse-panel">
          <PanelHeader
            title="Pipeline pulse"
            subtitle="Where opportunities are sitting right now."
          />
          <div className="pulse-list">
            {states.slice(0, 6).map((state) => {
              const count = leads.filter(
                (lead) => lead.state === state.value,
              ).length;
              return (
                <div className="pulse-row" key={state.value}>
                  <div className={`state-dot ${state.tone}`} />
                  <span>{state.label}</span>
                  <div className="pulse-bar">
                    <i
                      style={{
                        width: `${Math.min(100, Math.max(8, count * 15))}%`,
                      }}
                    />
                  </div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
          <NavLink
            to="/pipeline"
            className="button button-secondary button-wide"
          >
            Open full pipeline <ChevronRight size={16} />
          </NavLink>
        </section>
      </div>
    </Page>
  );
}

function Pipeline({ user }: { user: NonNullable<typeof session.user> }) {
  if (!hasRole(user.role, pipelineReadRoles))
    return <Navigate to="/" replace />;
  return <PipelineContent user={user} />;
}

function PipelineContent({
  user,
}: {
  user: NonNullable<typeof session.user>;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<"board" | "table">("board");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [filter, setFilter] = useState<PipelineFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const boardRef = useRef<HTMLDivElement>(null);
  const canManageLeads = hasRole(user.role, leadWriteRoles);
  useEffect(() => {
    const query =
      new URLSearchParams(window.location.search).get("search") ?? "";
    setSearch(query);
    api.leads
      .list("?limit=100&sort=updatedAt")
      .then((result) => setLeads(result.items))
      .catch((e) =>
        setNotice({
          message: errorMessage(e, "Unable to load the pipeline."),
          tone: "error",
        }),
      )
      .finally(() => setLoading(false));
  }, []);
  const filtered = leads.filter((lead) => {
    const matchesSearch =
      `${lead.fullName} ${lead.email} ${lead.preferredLocation ?? ""} ${lead.productLine ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "mine" && lead.assignedAgentId === user.id) ||
      (filter === "attention" && isAttentionLead(lead)) ||
      (filter === "overdue" && isOverdueLead(lead));
    return matchesSearch && matchesFilter;
  });
  const addLead = async (payload: unknown) => {
    const lead = await api.leads.create(payload);
    setLeads((items) => [lead, ...items]);
    setCreateOpen(false);
    setNotice({ message: "Lead added to the pipeline.", tone: "success" });
  };
  const filteredLeadKey = filtered.map((lead) => lead.id).join(",");
  useEffect(() => {
    if (loading || view !== "board" || !filteredLeadKey) return;
    const frame = window.requestAnimationFrame(() => {
      boardRef.current
        ?.querySelector<HTMLElement>(".kanban-column.has-cards")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filter, filteredLeadKey, loading, search, view]);
  const sharedFilterOptions: {
    value: PipelineFilter;
    label: string;
    count?: number;
  }[] = [
    {
      value: "all",
      label: user.role === "MarketingAgent" ? "My opportunities" : "All opportunities",
      count: leads.length,
    },
    ...(user.role === "MarketingAgent"
      ? []
      : [
          {
            value: "mine" as PipelineFilter,
            label: "My opportunities",
            count: leads.filter((lead) => lead.assignedAgentId === user.id).length,
          },
        ]),
    {
      value: "attention",
      label: "Needs attention",
      count: leads.filter(isAttentionLead).length,
    },
    {
      value: "overdue",
      label: "Stale or overdue",
      count: leads.filter(isOverdueLead).length,
    },
  ];
  return (
    <Page
      title="Franchise pipeline"
      subtitle="A clear view of every opportunity and its next step."
      actions={
        canManageLeads ? (
          <button
            className="button button-primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} /> New lead
          </button>
        ) : undefined
      }
    >
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      <div className="pipeline-toolbar">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this pipeline"
            />
          </div>
          <button
            className={`button button-secondary filter-toggle ${filtersOpen ? "active" : ""}`}
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
          >
            <Filter size={16} /> Filters
          </button>
          <div
            className="view-segmented"
            role="group"
            aria-label="Pipeline view"
          >
            <button
              className={`view-toggle ${view === "board" ? "active" : ""}`}
              onClick={() => setView("board")}
            >
              Board
            </button>
            <button
              className={`view-toggle ${view === "table" ? "active" : ""}`}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
        </div>
        {filtersOpen && (
          <div className="quick-filter-row" aria-label="Quick pipeline filters">
            {sharedFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`quick-filter ${filter === option.value ? "active" : ""}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
                <span>{option.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : view === "board" ? (
        <div
          className="kanban-board"
          aria-label="Franchise lifecycle board"
          ref={boardRef}
        >
          {pipelineStages.map((stage) => {
            const stageLeads = filtered.filter(
              (lead) =>
                pipelineStageForLead(
                  lead,
                  Boolean(lead.downPaymentSubmittedForFinance),
                ).key === stage.key,
            );
            const attentionCount = stageLeads.filter(isAttentionLead).length;
            return (
              <section
                className={`kanban-column ${stageLeads.length ? "has-cards" : "is-empty"}`}
                key={stage.key}
              >
                <div className="column-heading">
                  <div className="column-title">
                    <span className={`state-dot ${stage.tone}`} />
                    <strong>{stage.label}</strong>
                    <span className="count-badge">{stageLeads.length}</span>
                  </div>
                </div>
                <p className="column-description">{stage.description}</p>
                {attentionCount > 0 && (
                  <span className="column-attention">
                    {attentionCount} needs attention
                  </span>
                )}
                <div className="column-cards">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      submittedForFinance={Boolean(lead.downPaymentSubmittedForFinance)}
                    />
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="column-empty">No opportunities here</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel table-panel">
          <div className="lead-table">
            <div className="lead-table-head">
              <span>Franchisee</span>
              <span>Product</span>
              <span>Location</span>
              <span>Stage</span>
              <span>Updated</span>
            </div>
            {filtered.map((lead) => (
              <NavLink
                to={`/leads/${lead.id}`}
                className="lead-table-row"
                key={lead.id}
              >
                <strong>{lead.fullName}</strong>
                <span>{lead.productLine ?? "Pending"}</span>
                <span>{lead.preferredLocation ?? "Not set"}</span>
                <StatusPill
                  state={lead.state}
                  label={pipelineStageLabel(
                    lead.state,
                    Boolean(lead.downPaymentSubmittedForFinance),
                  )}
                />
                <span className="muted">{formatDate(lead.updatedAt)}</span>
              </NavLink>
            ))}
          </div>
        </section>
      )}
      {createOpen && (
        <Modal
          title="Add franchise lead"
          subtitle="Start with the minimum information needed to create a safe, trackable record."
          onClose={() => setCreateOpen(false)}
        >
          <LeadForm onSubmit={addLead} submitLabel="Add lead" />
        </Modal>
      )}
    </Page>
  );
}

function LeadDetail() {
  if (!hasRole(session.user?.role, leadReadRoles))
    return <Navigate to="/" replace />;
  return <LeadDetailContent />;
}

function LeadDetailContent() {
  const { leadId = "" } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const utilityTabs = [
    "Overview",
    "Workflow",
    "Location analysis",
    "Activities",
    "Documents",
    ...(hasRole(session.user?.role, [
      "MarketingAdmin",
      "GeneralManager",
      "Leadership",
      "AdminTeam",
    ])
      ? ["Audit"]
      : []),
  ];
  const [tab, setTab] = useState(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    return requestedTab === "Generate invoice" ||
      requestedTab === "Payment confirmation"
      ? "Workflow"
      : requestedTab && utilityTabs.includes(requestedTab)
        ? requestedTab
        : "Overview";
  });
  const [error, setError] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const load = async () => {
    try {
      const nextLead = await api.leads.get(leadId);
      if (
        session.user?.role === "Finance" ||
        session.user?.role === "AdminTeam"
      ) {
        const nextPayment =
          session.user.role === "Finance" &&
          ["Qualified", "DownPaymentPending"].includes(nextLead.state)
            ? await api.leads.downPayment(leadId).catch(() => null)
            : null;
        setLead(nextLead);
        setActivities([]);
        setTasks([]);
        setPayment(nextPayment as Record<string, unknown> | null);
        return;
      }
      const [nextActivities, nextTasks] = await Promise.all([
        api.leads.activities(leadId),
        api.leads.tasks(leadId),
      ]);
      const nextPayment = ["Qualified", "DownPaymentPending"].includes(
        nextLead.state,
      )
        ? await api.leads.downPayment(leadId).catch(() => null)
        : null;
      setLead(nextLead);
      setActivities(nextActivities);
      setTasks(nextTasks);
      setPayment(nextPayment as Record<string, unknown> | null);
    } catch (e) {
      setError(errorMessage(e, "Unable to load this franchisee."));
    }
  };
  useEffect(() => {
    void load();
  }, [leadId]);
  if (error)
    return (
      <Page title="Unable to load franchisee" subtitle={error}>
        <NavLink to="/pipeline" className="button button-secondary">
          Return to pipeline
        </NavLink>
      </Page>
    );
  if (!lead) return <Loading />;
  const nextStep = nextStepForLead(lead);
  const documentsComplete = Boolean(payment?.documentsComplete);
  const hasContact = activities.some((item) =>
    [
      "call",
      "email",
      "officevisit",
      "zoommeeting",
      "calloutcomerecorded",
    ].includes(item.type.toLowerCase()),
  );
  const openTasks = tasks.filter((task) => task.status === "Open");
  const nurturing = lead.state === "Nurturing" || lead.state === "FollowUp";
  const canEditLead = hasRole(session.user?.role, leadWriteRoles);
  const primaryLabel =
    lead.state === "Qualified"
      ? "Upload required documents"
      : lead.state === "DownPaymentPending" &&
          hasRole(session.user?.role, marketingWriteRoles)
        ? payment?.submittedForFinance
          ? "Waiting for Finance verification"
          : documentsComplete
            ? "Submit to Finance"
            : "Submit required documents"
        : nurturing
          ? hasContact
            ? "Start qualification"
            : "Record contact"
          : nextStep.label;
  const primaryDescription =
    lead.state === "Qualified"
      ? "The lead is qualified. Upload the combined valid ID and signature scan before generating the down payment invoice."
      : lead.state === "DownPaymentPending" &&
          hasRole(session.user?.role, marketingWriteRoles)
        ? payment?.submittedForFinance
          ? "The package is with Finance. Finance now verifies and confirms the down payment."
          : documentsComplete
            ? "The invoice and required document are complete. Submit the package to Finance for verification."
            : "The invoice is complete. Upload the combined ID and signature scan so Finance can verify payment."
        : lead.state === "Nurturing" && !hasContact
          ? "Contact the candidate and determine whether they are ready for qualification."
          : lead.state === "Nurturing"
            ? "Contact recorded. Review the candidate against the qualification requirements."
            : nextStep.detail;
  const primaryAction = async () => {
    if (lead.state === "Nurturing" && !hasContact) {
      setActivityOpen(true);
      return;
    }
    if (nurturing) {
      setTab("Workflow");
      return;
    }
    if (
      lead.state === "Qualified" ||
      (lead.state === "DownPaymentPending" && !documentsComplete)
    ) {
      setTab("Workflow");
      return;
    }
    if (lead.state === "New") {
      try {
        await api.leads.startInquiry(lead.id);
        await load();
        setNotice({ message: "Inquiry started.", tone: "success" });
      } catch (e) {
        setNotice({
          message: errorMessage(e, "Unable to start inquiry."),
          tone: "error",
        });
      }
      return;
    }
    setTab(nextStep.tab);
  };
  const saveActivity = async (payload: unknown) => {
    await api.leads.addActivity(lead.id, payload);
    setActivityOpen(false);
    setNotice({ message: "Activity added.", tone: "success" });
    await load();
  };
  const saveTask = async (payload: unknown) => {
    await api.leads.createTask(lead.id, payload);
    setTaskOpen(false);
    setNotice({ message: "Task created.", tone: "success" });
    await load();
  };
  const primaryMeta =
    lead.state === "Qualified"
      ? "Down payment invoice is the next required action"
      : lead.state === "DownPaymentPending" &&
          hasRole(session.user?.role, marketingWriteRoles)
        ? payment?.submittedForFinance
          ? "Package submitted · Finance owns the next step"
          : documentsComplete
            ? "Invoice and required document complete · Ready to submit"
            : "Invoice retained · Required before Finance verification"
        : undefined;
  return (
    <Page
      title={lead.fullName}
      subtitle={`${lead.email} · ${lead.contactNumber}`}
      backTo="/pipeline"
      headingDetails={
        <div className="lead-heading-summary">
          <div className="avatar avatar-small">{initials(lead.fullName)}</div>
          <StatusPill state={lead.state} />
          <span>
            {lead.preferredLocation ?? "Location not set"}{" "}
            <span className="muted-dot">·</span>{" "}
            {lead.productLine ?? "Product line pending"}
          </span>
          <span className="lead-heading-assignee">
            <span className="lead-heading-assignee-label">Assigned agent</span>
            <span className="lead-heading-assignee-value">
              <span className="avatar avatar-tiny">AG</span>
              <strong>{lead.assignedAgentName ?? "Unknown agent"}</strong>
            </span>
          </span>
        </div>
      }
      actions={
        <div className="button-row">
          {utilityTabs.includes("Audit") && (
            <button
              className="button button-secondary"
              onClick={() => setTab("Audit")}
            >
              <Archive size={16} /> Audit log
            </button>
          )}
          {canEditLead && (
            <button
              className="button button-secondary"
              onClick={() => setActivityOpen(true)}
            >
              <Plus size={16} /> Add activity
            </button>
          )}
        </div>
      }
    >
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      <LeadWorkflowProgress lead={lead} payment={payment} onSelect={setTab} />
      <nav
        className="detail-tabs detail-tabs-secondary"
        aria-label="Record details"
      >
        {utilityTabs
          .filter(
            (item) =>
              item !== "Location analysis" || Boolean(lead.preferredLocation),
          )
          .map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={tab === item ? "active" : ""}
            >
              {item}
            </button>
          ))}
      </nav>
      {tab === "Overview" ? (
        <>
          <div className="detail-grid">
            <WorkflowActionArea
              lead={lead}
              description={primaryDescription}
              primaryLabel={primaryLabel}
              meta={primaryMeta}
              canPrimaryOverride={
                !(
                  lead.state === "DownPaymentPending" &&
                  payment?.submittedForFinance &&
                  hasRole(session.user?.role, marketingWriteRoles)
                )
              }
              onPrimary={primaryAction}
              onSchedule={() => setTaskOpen(true)}
            />
            <section className="panel">
              <PanelHeader title="Franchise snapshot" />
              <div className="snapshot-grid">
                <Info
                  label="Pipeline stage"
                  value={labelForState(lead.state)}
                />
                <Info label="Source of income" value={lead.sourceOfIncome} />
                <Info
                  label="Preferred location"
                  value={lead.preferredLocation ?? "Not provided"}
                />
                <Info label="Version" value={`v${lead.version}`} />
              </div>
            </section>
            <section className="panel timeline-panel">
              <PanelHeader
                title="Recent activity"
                action={
                  <button
                    className="text-link"
                    onClick={() => setTab("Activities")}
                  >
                    See all <ArrowUpRight size={14} />
                  </button>
                }
              />
              {activities.slice(0, 4).map((activity) => (
                <TimelineItem key={activity.id} item={activity} />
              ))}
            </section>
            <section className="panel">
              <PanelHeader
                title="Open tasks"
                action={
                  <button
                    className="count-badge"
                    onClick={() => setTaskOpen(true)}
                  >
                    {openTasks.length}
                  </button>
                }
              />
              {openTasks.length ? (
                openTasks
                  .slice(0, 4)
                  .map((task) => <TaskRow key={task.id} task={task} />)
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="No open tasks"
                  text="Schedule a follow-up only when the opportunity needs one."
                />
              )}
            </section>
          </div>
        </>
      ) : (
        <LeadTab
          tab={tab}
          lead={lead}
          payment={payment}
          activities={activities}
          onReload={load}
          onNotice={setNotice}
          onAddActivity={() => setActivityOpen(true)}
          onSelectTab={setTab}
        />
      )}
      {activityOpen && (
        <Modal
          title="Record contact or activity"
          subtitle="Capture what happened so the next decision has context."
          onClose={() => setActivityOpen(false)}
        >
          <ActivityForm onSubmit={saveActivity} submitLabel="Save activity" />
        </Modal>
      )}
      {taskOpen && (
        <Modal
          title="Schedule follow-up"
          subtitle="Create an owned task only when another action is needed."
          onClose={() => setTaskOpen(false)}
        >
          <TaskForm
            leadId={lead.id}
            onSubmit={saveTask}
            submitLabel="Schedule follow-up"
          />
        </Modal>
      )}
    </Page>
  );
}

function canPerformPrimaryWorkflowAction(lead: Lead) {
  const role = session.user?.role;
  if (!role) return false;
  if (lead.state === "Qualified") return hasRole(role, marketingWriteRoles);
  if (lead.state === "DownPaymentPending")
    return role === "Finance" || hasRole(role, marketingWriteRoles);
  if (
    lead.state === "DownPaymentConfirmed" ||
    lead.state === "ContractDrafting"
  )
    return role === "MarketingAdmin";
  if (lead.state === "ContractReview") return role === "GeneralManager";
  if (lead.state === "ContractSigned" || lead.state === "PreLaunch")
    return hasRole(role, marketingWriteRoles);
  if (lead.state === "EndorsedToAdmin") return role === "AdminTeam";
  return hasRole(role, leadWriteRoles);
}

function WorkflowActionArea({
  lead,
  description,
  primaryLabel,
  meta,
  canPrimaryOverride,
  onPrimary,
  onSchedule,
}: {
  lead: Lead;
  description: string;
  primaryLabel: string;
  meta?: string;
  canPrimaryOverride?: boolean;
  onPrimary: () => void;
  onSchedule: () => void;
}) {
  const canManageTasks = hasRole(session.user?.role, marketingWriteRoles);
  const canPrimary =
    canPrimaryOverride ?? canPerformPrimaryWorkflowAction(lead);
  return (
    <section className="panel workflow-action-area">
      <div className="workflow-current">
        <span>Current status</span>
        <StatusPill state={lead.state} />
      </div>
      <span className="eyebrow">NEXT REQUIRED ACTION</span>
      <h3>{primaryLabel}</h3>
      <p className="workflow-action-description">{description}</p>
      {meta && <span className="workflow-action-meta">{meta}</span>}
      {canPrimary ? (
        <div className="workflow-cta-row">
          <button className="button button-primary" onClick={onPrimary}>
            {primaryLabel}
            <ChevronRight size={16} />
          </button>
          {canManageTasks && (
            <button className="button button-secondary" onClick={onSchedule}>
              Schedule follow-up
            </button>
          )}
        </div>
      ) : (
        <div className="read-only-note">
          <ShieldCheck size={16} /> This workflow step is waiting for the
          authorized team.
        </div>
      )}
      {lead.state === "Nurturing" && canPrimary && (
        <small className="workflow-hint">
          {primaryLabel === "Record contact"
            ? "After contact is recorded, qualification will become the primary next step."
            : "Choose Qualified or Follow-up in the Qualification workspace."}
        </small>
      )}
    </section>
  );
}

function LeadWorkflowProgress({
  lead,
  payment,
  onSelect,
}: {
  lead: Lead;
  payment?: Record<string, unknown> | null;
  onSelect: (tab: string) => void;
}) {
  const currentIndex = workflowStateIndex(lead.state, payment);
  const currentStage = lifecycleStageForLead(lead.state, payment);
  return (
    <section className="workflow-progress-panel">
      <div className="workflow-progress-heading">
        <div>
          <span className="eyebrow">FRANCHISE PROGRESS</span>
          <strong>
            Move this opportunity through the franchise lifecycle.
          </strong>
        </div>
        <span>{currentStage.label} now</span>
      </div>
      <div className="workflow-stepper">
        {lifecycleSteps.map((step, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          return (
            <button
              type="button"
              key={step.label}
              className={`workflow-step ${complete ? "complete" : ""} ${current ? "current" : ""}`}
              onClick={() => onSelect("Workflow")}
            >
              <span className="workflow-step-marker">
                {complete ? "✓" : index + 1}
              </span>
              <strong>{step.label}</strong>
              {index < lifecycleSteps.length - 1 && <i />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LegacyLeadDetail() {
  const { leadId = "" } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState("Overview");
  const [error, setError] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const load = async () => {
    try {
      const [nextLead, nextActivities, nextTasks] = await Promise.all([
        api.leads.get(leadId),
        api.leads.activities(leadId),
        api.leads.tasks(leadId),
      ]);
      setLead(nextLead);
      setActivities(nextActivities);
      setTasks(nextTasks);
    } catch (e) {
      setError(errorMessage(e, "Unable to load this franchisee."));
    }
  };
  useEffect(() => {
    void load();
  }, [leadId]);
  if (error)
    return (
      <Page title="Unable to load franchisee" subtitle={error}>
        <NavLink to="/pipeline" className="button button-secondary">
          Return to pipeline
        </NavLink>
      </Page>
    );
  if (!lead) return <Loading />;
  const tabs = [
    "Overview",
    "Inquiry",
    "Qualification",
    "Activities",
    "Documents",
    "Finance",
    "Contract",
    "Pre-launch",
    "Handoff",
    "Audit",
  ];
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && tabs.includes(requestedTab)) setTab(requestedTab);
  }, [leadId]);
  const saveActivity = async (payload: unknown) => {
    await api.leads.addActivity(lead.id, payload);
    setActivityOpen(false);
    setNotice({ message: "Activity added.", tone: "success" });
    await load();
  };
  const saveTask = async (payload: unknown) => {
    await api.leads.createTask(lead.id, payload);
    setTaskOpen(false);
    setNotice({ message: "Task created.", tone: "success" });
    await load();
  };
  return (
    <Page
      title={lead.fullName}
      subtitle={`${lead.email} · ${lead.contactNumber}`}
      backTo="/pipeline"
      actions={
        <div className="button-row">
          <button
            className="button button-secondary"
            onClick={() => setTab("Audit")}
          >
            <Archive size={16} /> More
          </button>
          <button
            className="button button-primary"
            onClick={() => setActivityOpen(true)}
          >
            <Plus size={16} /> Add activity
          </button>
        </div>
      }
    >
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      <section className="lead-hero">
        <div className="lead-identity">
          <div className="avatar avatar-xl">{initials(lead.fullName)}</div>
          <div>
            <div className="identity-line">
              <h2>{lead.fullName}</h2>
              <StatusPill state={lead.state} />
            </div>
            <p>
              {lead.preferredLocation ?? "Location not set"}{" "}
              <span className="muted-dot">·</span>{" "}
              {lead.productLine ?? "Product line pending"}
            </p>
            <span className="record-meta">
              Created {formatDate(lead.createdAt)} · Last updated{" "}
              {formatDate(lead.updatedAt)}
            </span>
          </div>
        </div>
        <div className="lead-owner">
          <span>Assigned agent</span>
          <strong>
            <div className="avatar avatar-tiny">AG</div>{" "}
            {lead.assignedAgentName ?? "Unknown agent"}
          </strong>
        </div>
      </section>
      <nav className="detail-tabs" aria-label="Franchisee details">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={tab === item ? "active" : ""}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "Overview" ? (
        <div className="detail-grid">
          <section className="panel">
            <PanelHeader
              title="Next best actions"
              subtitle="Keep this opportunity moving."
            />
            <div className="action-list">
              <ActionButton
                label="Start or continue inquiry"
                text="Capture the information needed to qualify."
                onClick={async () => {
                  try {
                    await api.leads.startInquiry(lead.id);
                    await load();
                    setNotice({ message: "Inquiry started.", tone: "success" });
                  } catch (e) {
                    setNotice({
                      message: errorMessage(e, "Unable to start inquiry."),
                      tone: "error",
                    });
                  }
                }}
              />
              <ActionButton
                label="Record a call or note"
                text="Keep the relationship history complete."
                onClick={() => setActivityOpen(true)}
              />
              <ActionButton
                label="Create follow-up task"
                text="Give the next step a clear owner."
                onClick={() => setTaskOpen(true)}
              />
            </div>
          </section>
          <section className="panel">
            <PanelHeader title="Franchise snapshot" />
            <div className="snapshot-grid">
              <Info label="Pipeline stage" value={labelForState(lead.state)} />
              <Info label="Source of income" value={lead.sourceOfIncome} />
              <Info
                label="Preferred location"
                value={lead.preferredLocation ?? "Not provided"}
              />
              <Info label="Version" value={`v${lead.version}`} />
            </div>
          </section>
          <section className="panel timeline-panel">
            <PanelHeader
              title="Recent activity"
              action={
                <button
                  className="text-link"
                  onClick={() => setTab("Activities")}
                >
                  See all <ArrowUpRight size={14} />
                </button>
              }
            />
            {activities.slice(0, 4).map((activity) => (
              <TimelineItem key={activity.id} item={activity} />
            ))}
          </section>
          <section className="panel">
            <PanelHeader
              title="Open tasks"
              action={
                <button
                  className="count-badge"
                  onClick={() => setTaskOpen(true)}
                >
                  {tasks.filter((task) => task.status === "Open").length}
                </button>
              }
            />
            {tasks.slice(0, 4).map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </section>
        </div>
      ) : (
        <LeadTab
          tab={tab}
          lead={lead}
          activities={activities}
          onReload={load}
          onNotice={setNotice}
          onAddActivity={() => setActivityOpen(true)}
          onSelectTab={setTab}
        />
      )}
      {activityOpen && (
        <Modal
          title="Add activity"
          subtitle="Write the context your future self will need."
          onClose={() => setActivityOpen(false)}
        >
          <ActivityForm onSubmit={saveActivity} submitLabel="Save activity" />
        </Modal>
      )}
      {taskOpen && (
        <Modal
          title="Create follow-up task"
          subtitle="Make the next action visible and owned."
          onClose={() => setTaskOpen(false)}
        >
          <TaskForm
            leadId={lead.id}
            onSubmit={saveTask}
            submitLabel="Create task"
          />
        </Modal>
      )}
    </Page>
  );
}

function LeadTab({
  tab,
  lead,
  payment,
  activities,
  onReload,
  onNotice,
  onAddActivity,
  onSelectTab,
}: {
  tab: string;
  lead: Lead;
  payment?: Record<string, unknown> | null;
  activities: ActivityItem[];
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
  onAddActivity: () => void;
  onSelectTab: (tab: string) => void;
}) {
  if (tab === "Workflow")
    return (
      <WorkflowPanel
        lead={lead}
        payment={payment}
        onReload={onReload}
        onNotice={onNotice}
      />
    );
  if (tab === "Generate invoice")
    return hasRole(session.user?.role, marketingWriteRoles) ? (
      <InvoiceOnlyPanel lead={lead} onReload={onReload} onNotice={onNotice} />
    ) : (
      <ReadOnlyWorkflowPanel
        title="Generate invoice"
        text="Invoice generation is restricted to the Agent and Marketing Admin roles."
      />
    );
  if (tab === "Payment confirmation")
    return session.user?.role === "Finance" ? (
      <FinanceConfirmationPanel
        lead={lead}
        onReload={onReload}
        onNotice={onNotice}
      />
    ) : (
      <ReadOnlyWorkflowPanel
        title="Payment confirmation"
        text="Only Finance can verify and confirm a down payment."
      />
    );
  if (tab === "Activities")
    return (
      <ActivitiesPanel
        activities={activities}
        onAddActivity={onAddActivity}
        onSelectTab={onSelectTab}
      />
    );
  if (tab === "Location analysis")
    return (
      <LocationAnalysisPanel
        lead={lead}
        onReload={onReload}
        onNotice={onNotice}
      />
    );
  if (tab === "Inquiry")
    return hasRole(session.user?.role, leadWriteRoles) ? (
      <InquiryPanel lead={lead} onReload={onReload} onNotice={onNotice} />
    ) : (
      <ReadOnlyWorkflowPanel
        title="Inquiry details"
        text="Inquiry details are available for viewing. Your role cannot edit this step."
      />
    );
  if (tab === "Qualification")
    return hasRole(session.user?.role, leadWriteRoles) ? (
      <QualificationPanel lead={lead} onReload={onReload} onNotice={onNotice} />
    ) : (
      <ReadOnlyWorkflowPanel
        title="Qualification"
        text="Qualification is available for viewing. A lead owner must complete this step."
      />
    );
  if (tab === "Documents")
    return <DocumentsPanel lead={lead} onNotice={onNotice} />;
  if (tab === "Contract")
    return (
      <ContractPanel lead={lead} onReload={onReload} onNotice={onNotice} />
    );
  if (tab === "Pre-launch")
    return (
      <PreLaunchPanel lead={lead} onReload={onReload} onNotice={onNotice} />
    );
  if (tab === "Handoff")
    return hasRole(session.user?.role, marketingWriteRoles) ? (
      <EndorsementPanel lead={lead} onReload={onReload} onNotice={onNotice} />
    ) : (
      <ReadOnlyWorkflowPanel
        title="Handoff"
        text="Handoff details are available for viewing. Only the authorized receiving team can acknowledge an endorsement."
      />
    );
  return hasRole(session.user?.role, [
    "MarketingAdmin",
    "GeneralManager",
    "Leadership",
    "AdminTeam",
  ]) ? (
    <AuditPanel leadId={lead.id} />
  ) : (
    <ReadOnlyWorkflowPanel
      title="Audit"
      text="Audit history is restricted to authorized operational roles."
    />
  );
}

type ActivityFilter = "all" | "workflow" | "communication" | "documents" | "finance";

function activityPresentation(activity: ActivityItem) {
  const type = activity.type.replaceAll("_", "").toLowerCase();
  if (type.includes("paymentconfirmed"))
    return {
      kind: "Payment",
      title: "Down payment confirmed",
      detail: activity.message,
      action: "View payment details →",
      tab: "Workflow",
    };
  if (type.includes("downpaymentsubmitted"))
    return {
      kind: "Workflow",
      title: "Submitted to Finance verification",
      detail: activity.message,
      action: "View workflow →",
      tab: "Workflow",
    };
  if (type.includes("invoicegenerated"))
    return {
      kind: "Invoice",
      title: "Down payment invoice generated",
      detail: activity.message,
      action: "View invoice →",
      tab: "Workflow",
    };
  if (type.includes("documentuploaded"))
    return {
      kind: "Document",
      title: "Required document uploaded",
      detail: activity.message,
      action: "View documents →",
      tab: "Documents",
    };
  if (type.includes("calloutcomerecorded"))
    return {
      kind: "Call",
      title: "Nurturing call completed",
      detail: activity.message,
      action: "View call notes →",
      tab: "Activities",
    };
  if (type.includes("followupcreated"))
    return {
      kind: "Follow-up",
      title: "Follow-up scheduled",
      detail: activity.message,
      action: "View workflow →",
      tab: "Workflow",
    };
  if (type.includes("statechanged") || type.includes("qualification"))
    return {
      kind: "Workflow",
      title: activity.message,
      detail: "The opportunity moved forward in the franchise workflow.",
    };
  return {
    kind: type.includes("email") ? "Email" : "Workflow",
    title: activity.message,
    detail: "",
  };
}

function activityDateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const formatted = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(date);
  return isToday ? `Today · ${formatted}` : formatted;
}

function activityTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ActivitiesPanel({
  activities,
  onAddActivity,
  onSelectTab,
}: {
  activities: ActivityItem[];
  onAddActivity: () => void;
  onSelectTab: (tab: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "earlier">(
    "all",
  );
  const today = new Date();
  const visible = activities.filter((activity) => {
    const presentation = activityPresentation(activity);
    const haystack =
      `${presentation.title} ${presentation.detail} ${activity.actorName ?? ""}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const kind = presentation.kind.toLowerCase();
    const matchesType =
      filter === "all" ||
      (filter === "workflow" && kind === "workflow") ||
      (filter === "communication" && ["call", "email", "follow-up"].includes(kind)) ||
      (filter === "documents" && ["document", "invoice"].includes(kind)) ||
      (filter === "finance" && kind === "payment");
    const date = new Date(activity.createdAt);
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    return (
      matchesSearch &&
      matchesType &&
      (dateFilter === "all" || (dateFilter === "today" ? isToday : !isToday))
    );
  });
  const groups = visible.reduce<Record<string, ActivityItem[]>>((result, activity) => {
    const key = new Date(activity.createdAt).toDateString();
    (result[key] ??= []).push(activity);
    return result;
  }, {});

  return (
    <section className="panel tab-panel activities-panel">
      <PanelHeader
        title="Activities"
        subtitle="Everything that happened with this opportunity."
        action={
          hasRole(session.user?.role, marketingWriteRoles) ? (
            <button className="button button-secondary" onClick={onAddActivity}>
              <Plus size={15} /> Add activity
            </button>
          ) : undefined
        }
      />
      <div className="activities-toolbar">
        <div className="toolbar-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activities..."
          />
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as ActivityFilter)}
          aria-label="Activity type"
        >
          <option value="all">All activity</option>
          <option value="workflow">Workflow</option>
          <option value="communication">Communication</option>
          <option value="documents">Documents</option>
          <option value="finance">Finance</option>
        </select>
        <select
          value={dateFilter}
          onChange={(event) =>
            setDateFilter(event.target.value as "all" | "today" | "earlier")
          }
          aria-label="Activity date"
        >
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="earlier">Earlier</option>
        </select>
      </div>
      {visible.length ? (
        <div className="business-timeline">
          {Object.entries(groups).map(([key, items]) => (
            <div className="activity-day" key={key}>
              <div className="activity-day-heading">
                <span>{activityDateLabel(items[0].createdAt)}</span>
              </div>
              {items.map((activity) => {
                const presentation = activityPresentation(activity);
                const kindClass = presentation.kind.toLowerCase().replaceAll(" ", "-");
                return (
                  <article
                    className={`business-activity business-activity-${kindClass}`}
                    key={activity.id}
                  >
                    <span className="business-activity-marker" />
                    <div className="business-activity-body">
                      <div className="business-activity-heading">
                        <span className="business-activity-kind">
                          {presentation.kind}
                        </span>
                        <span className="business-activity-actor">
                          {activity.actorName ?? "System"}
                        </span>
                      </div>
                      <strong>{presentation.title}</strong>
                      {presentation.detail && <p>{presentation.detail}</p>}
                      <small>
                        {activityTimeLabel(activity.createdAt)} ·{" "}
                        {activity.actorName ?? "System"}
                      </small>
                      {presentation.action && (
                        <button
                          className="activity-action"
                          onClick={() => onSelectTab(presentation.tab)}
                        >
                          {presentation.action}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title={activities.length ? "No matching activities" : "No activity yet"}
          text={
            activities.length
              ? "Try a different search or activity filter."
              : "The first note, call, or workflow event will appear here."
          }
        />
      )}
    </section>
  );
}

function WorkflowPanel({
  lead,
  payment,
  onReload,
  onNotice,
}: {
  lead: Lead;
  payment?: Record<string, unknown> | null;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const currentStage = lifecycleStageForLead(lead.state, payment);
  const preparationActive = currentStage.label === "Invoice & Documents";
  const financeActive = currentStage.label === "Finance verification";
  const contractActive = currentStage.label === "Contract";
  const [contract, setContract] = useState<Contract | null>(null);
  const [documentsReadyForLead, setDocumentsReadyForLead] = useState<string | null>(null);
  const documentsComplete =
    Boolean(payment?.documentsComplete) || documentsReadyForLead === lead.id;
  const invoiceGenerated = ["Invoiced", "Confirmed"].includes(
    String(payment?.status ?? ""),
  );
  const preparationSubsteps = [
    {
      label: "Upload required documents",
      complete: documentsComplete,
      active: !documentsComplete,
    },
    {
      label: "Generate down payment invoice",
      complete: invoiceGenerated,
      active: documentsComplete && !invoiceGenerated,
    },
    {
      label: "Submit to Finance",
      complete: Boolean(payment?.submittedForFinance),
      active: invoiceGenerated && documentsComplete,
    },
  ];
  const financeSubsteps = [
    {
      label: "Invoice received",
      complete: true,
      active: false,
    },
    {
      label: "Required documents reviewed",
      complete: documentsComplete,
      active: !documentsComplete,
    },
    {
      label: "Confirm payment received",
      complete: lead.state === "DownPaymentConfirmed",
      active: financeActive,
    },
  ];
  const currentTitle = preparationActive
    ? !documentsComplete
      ? "Upload required documents"
      : !invoiceGenerated
        ? "Generate down payment invoice"
        : !payment?.submittedForFinance
          ? "Submit to Finance"
          : "Submitted to Finance"
    : financeActive
      ? "Finance verification"
      : nextStepForLead(lead).label;
  const currentDescription = preparationActive
    ? !documentsComplete
      ? "Upload the combined valid ID and three specimen signatures file before generating the invoice."
      : !invoiceGenerated
        ? "The required document is complete. Confirm the amount and generate the down payment invoice."
        : !payment?.submittedForFinance
          ? "The invoice and required document are complete. Submit the package to Finance for verification."
          : "Finance now owns payment verification."
    : financeActive
      ? "Finance verifies the invoice, payment evidence, and actual payment before contract drafting."
      : nextStepForLead(lead).detail;
  const phaseSteps = preparationActive
    ? preparationSubsteps
    : financeActive
      ? financeSubsteps
      : contractActive
        ? []
        : [{ label: currentTitle, complete: false, active: true }];
  const compactPhase = phaseSteps.length <= 1;
  const phaseOwner = preparationActive
    ? "Agent-owned"
    : financeActive
      ? "Finance-owned"
      : contractActive
        ? "Marketing Admin"
        : `${nextActionOwnerForLead(lead, Boolean(payment?.submittedForFinance))} owned`;
  const amount = payment
    ? `₱${Number(payment.amount).toLocaleString()}`
    : "Not configured";
  const invoiceNumber = String(payment?.invoiceNumber ?? "Not generated");
  const paymentStatus = String(
    payment?.status ?? (lead.state === "Qualified" ? "Not generated" : "Pending"),
  );
  const openInvoice = async () => {
    try {
      const result = await api.leads.invoiceDownload(lead.id);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to open the invoice."),
        tone: "error",
      });
    }
  };

  const renderCurrentStep = () => {
    if (["New", "Inquiry", "InquiryIncomplete"].includes(lead.state))
      return hasRole(session.user?.role, leadWriteRoles) ? (
        <InquiryPanel lead={lead} onReload={onReload} onNotice={onNotice} />
      ) : (
        <ReadOnlyWorkflowPanel
          title="Inquiry"
          text="Inquiry details are available for viewing. Your role cannot edit this step."
        />
      );
    if (["Nurturing", "FollowUp"].includes(lead.state))
      return hasRole(session.user?.role, leadWriteRoles) ? (
        <QualificationPanel
          lead={lead}
          onReload={onReload}
          onNotice={onNotice}
        />
      ) : (
        <ReadOnlyWorkflowPanel
          title="Qualification"
          text="Qualification is available for viewing. A lead owner must complete this step."
        />
      );
    if (["Qualified", "DownPaymentPending"].includes(lead.state)) {
      if (session.user?.role === "Finance")
        return (
          <FinanceConfirmationPanel
            lead={lead}
            onReload={onReload}
            onNotice={onNotice}
          />
        );
      if (
        lead.state === "DownPaymentPending" &&
        documentsComplete &&
        payment?.submittedForFinance
      )
        return (
          <ReadOnlyWorkflowPanel
            title="Finance verification"
            text="The invoice and required document are complete. Finance must verify and confirm the down payment."
          />
        );
      return hasRole(session.user?.role, marketingWriteRoles) ? (
        <InvoiceOnlyPanel
          lead={lead}
          onReload={onReload}
          onNotice={onNotice}
          onDocumentsComplete={(complete) =>
            setDocumentsReadyForLead(complete ? lead.id : null)
          }
        />
      ) : (
        <ReadOnlyWorkflowPanel
          title="Finance"
          text="Invoice preparation is available to the authorized marketing team. Finance verifies payment."
        />
      );
    }
    if (
      lead.state === "DownPaymentConfirmed" ||
      ["ContractDrafting", "ContractReview"].includes(lead.state)
    )
      return (
        <ContractPanel
          lead={lead}
          onReload={onReload}
          onNotice={onNotice}
          onContractChange={setContract}
        />
      );
    if (["ContractSigned", "PreLaunch"].includes(lead.state))
      return (
        <PreLaunchPanel lead={lead} onReload={onReload} onNotice={onNotice} />
      );
    if (lead.state === "EndorsedToAdmin")
      return session.user?.role === "AdminTeam" ? (
        <AdminEndorsementPanel lead={lead} onNotice={onNotice} />
      ) : hasRole(session.user?.role, marketingWriteRoles) ? (
        <EndorsementPanel lead={lead} onReload={onReload} onNotice={onNotice} />
      ) : (
        <ReadOnlyWorkflowPanel
          title="Handoff"
          text="The completed opportunity has been sent to the Admin Team for acknowledgement."
        />
      );
    return null;
  };

  return (
    <>
      <section className="panel tab-panel workflow-workspace">
        <PanelHeader
          title="Workflow"
          subtitle="Move the opportunity forward one owned step at a time."
        />
        <div
          className={`workflow-phase-card ${compactPhase ? "workflow-phase-card-compact" : ""}`}
        >
          <div className="workflow-phase-heading">
            <div>
              <span className="eyebrow">
                {preparationActive
                  ? "INVOICE & DOCUMENTS"
                  : financeActive
                    ? "FINANCE VERIFICATION"
                    : currentStage.label.toUpperCase()}
              </span>
              <span className="workflow-owner-badge">
                <UsersRound size={13} />
                {phaseOwner}
              </span>
            </div>
            <span className="workflow-phase-status">Current phase</span>
          </div>
          {compactPhase ? (
            <div className="workflow-phase-description">
              {contractActive
                ? "Prepare and complete the franchise agreement."
                : currentDescription}
            </div>
          ) : (
            <div className="workflow-phase-rail">
              {phaseSteps.map((step, index) => (
                <div
                  className={`workflow-phase-step ${step.complete ? "complete" : ""} ${step.active ? "current" : ""}`}
                  key={step.label}
                >
                  <span>{step.complete ? "✓" : index + 1}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>
                      {step.complete
                        ? "Completed"
                        : step.active
                          ? "In progress"
                          : "Upcoming"}
                    </small>
                  </div>
                  {index < phaseSteps.length - 1 && <i />}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <div className="workflow-current-layout">
        <div className="workflow-current-main">
          {renderCurrentStep()}
        </div>
        <aside className="workflow-side-column">
          <section className="panel workflow-side-card">
            <h3>{contractActive ? "Contract details" : "Step details"}</h3>
            {contractActive ? (
              <dl className="workflow-detail-list">
                <div>
                  <dt>Contract status</dt>
                  <dd>{contract?.status ?? "Not generated"}</dd>
                </div>
                <div>
                  <dt>Template</dt>
                  <dd>{contractTemplateLabel(contract?.templateCode)}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{contract?.version ?? "—"}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>Marketing Admin</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd className="workflow-detail-success">✓ Verified</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{contract?.updatedAt ? formatDate(contract.updatedAt) : "—"}</dd>
                </div>
              </dl>
            ) : (
              <dl className="workflow-detail-list">
                <div>
                  <dt>Next action by</dt>
                  <dd>{nextActionOwnerForLead(lead, Boolean(payment?.submittedForFinance))}</dd>
                </div>
                <div>
                  <dt>Invoice status</dt>
                  <dd>{paymentStatus}</dd>
                </div>
                <div>
                  <dt>Invoice no.</dt>
                  <dd>{invoiceNumber}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{amount}</dd>
                </div>
                <div>
                  <dt>Required documents</dt>
                  <dd>{documentsComplete ? "1 of 1 uploaded" : "0 of 1 uploaded"}</dd>
                </div>
              </dl>
            )}
            {!contractActive && payment?.status === "Invoiced" && !payment?.submittedForFinance && (
              <div className="workflow-side-success">
                <CheckCircle2 size={17} />
                <span>Invoice generated successfully.</span>
              </div>
            )}
          </section>
          <section className="panel workflow-side-card">
            <h3>What happens next</h3>
            {contractActive ? (
              <>
                <div className="workflow-next-list workflow-contract-next-list">
                  {[
                    {
                      label: "Generate contract",
                      detail: "Create the agreement from the approved template.",
                      complete: Boolean(contract),
                      active: !contract,
                    },
                    {
                      label: "Review / finalize",
                      detail: "Review the generated agreement and route it for approval.",
                      complete: ["Approved", "Signed"].includes(contract?.status ?? ""),
                      active: Boolean(contract) && !["Approved", "Signed"].includes(contract?.status ?? ""),
                    },
                    {
                      label: "Complete contract",
                      detail: "Finish signing, then continue to Pre-launch.",
                      complete: lead.state === "ContractSigned",
                      active: contract?.status === "Approved",
                    },
                  ].map((step, index) => (
                    <div className={`${step.complete ? "complete" : ""} ${step.active ? "active" : ""}`} key={step.label}>
                      <span>{step.complete ? "✓" : index + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <small>{step.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="workflow-next-phase">
                  <span>Next lifecycle phase</span>
                  <strong>Pre-launch <ChevronRight size={14} /></strong>
                </div>
              </>
            ) : (
              <div className="workflow-next-list">
                {lifecycleSteps
                  .slice(workflowStateIndex(lead.state, payment) + 1, workflowStateIndex(lead.state, payment) + 4)
                  .map((step, index) => (
                    <div key={step.label}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <small>
                          {index === 0
                            ? nextStepForLead(lead, Boolean(payment?.submittedForFinance)).detail
                            : "The next owner continues the opportunity through the lifecycle."}
                        </small>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </aside>
      </div>
      {preparationActive && invoiceNumber !== "Not generated" && (
        <div className="workflow-recently-completed">
          <div>
            <span className="eyebrow">RECENTLY COMPLETED</span>
            <strong>
              <CheckCircle2 size={17} /> Generate down payment invoice
            </strong>
            <small>Completed on {formatDate(lead.updatedAt)}</small>
          </div>
          <button className="button button-secondary" onClick={openInvoice}>
            <FileText size={16} /> Open invoice PDF <ChevronRight size={15} />
          </button>
        </div>
      )}
    </>
  );
}

function ReadOnlyWorkflowPanel({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title={title}
        subtitle="This workflow step is view-only for your role."
      />
      <div className="read-only-workflow">
        <ShieldCheck size={22} />
        <strong>{text}</strong>
      </div>
    </section>
  );
}

function DownPaymentOverviewPanel({
  lead,
  onOpenInvoice,
  onOpenConfirmation,
}: {
  lead: Lead;
  onOpenInvoice: () => void;
  onOpenConfirmation: () => void;
}) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const role = session.user?.role;
  const reload = () =>
    api.leads
      .downPayment(lead.id)
      .then((value) => setPayment(value as Record<string, unknown>))
      .catch(() => setPayment(null))
      .finally(() => setLoading(false));
  useEffect(() => {
    void reload();
  }, [lead.id]);
  const status = String(payment?.status ?? "Not configured");
  const invoiced = status === "Invoiced";
  const confirmed = status === "Confirmed";
  const documentsComplete = Boolean(payment?.documentsComplete);
  const canPrepare = hasRole(role, marketingWriteRoles) && !confirmed;
  const canConfirm = role === "Finance" && invoiced;
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title="Down payment"
        subtitle="Review the amount, invoice, and payment requirements before moving to contract drafting."
      />
      <div className="workflow-instructions">
        <strong>How this step works</strong>
        <span>
          1. Upload one scanned file containing the valid ID and three specimen
          signatures in Documents.
        </span>
        <span>
          2. Marketing confirms the down payment amount and generates the
          invoice.
        </span>
        <span>
          3. Finance verifies the payment and confirms it before contract
          drafting.
        </span>
      </div>
      <div className="process-card">
        <div className="snapshot-grid">
          <Info label="Status" value={loading ? "Loading…" : status} />
          <Info
            label="Amount"
            value={
              payment
                ? `₱${Number(payment.amount).toLocaleString()}`
                : "Not configured"
            }
          />
          <Info
            label="Invoice"
            value={String(payment?.invoiceNumber ?? "Not generated")}
          />
          <Info
            label="Required documents"
            value={documentsComplete ? "Complete" : "Pending"}
          />
        </div>
        {confirmed ? (
          <div className="completion-card">
            <CheckCircle2 size={19} />
            <div>
              <strong>Down payment confirmed</strong>
              <span>
                Finance has confirmed the payment. The next step is contract
                drafting.
              </span>
            </div>
          </div>
        ) : (
          <div className="workflow-cta-row">
            {canPrepare && (
              <button className="button button-primary" onClick={onOpenInvoice}>
                {invoiced ? "View invoice" : "Prepare payment package"}
                <ChevronRight size={16} />
              </button>
            )}
            {canConfirm && (
              <button
                className="button button-primary"
                onClick={onOpenConfirmation}
              >
                Confirm payment
                <ChevronRight size={16} />
              </button>
            )}
            {!canPrepare && !canConfirm && (
              <div className="read-only-note">
                <ShieldCheck size={16} />{" "}
                {invoiced
                  ? "This invoice is waiting for Finance to verify the payment."
                  : "This step is waiting for the authorized team."}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function InvoiceOnlyPanel({
  lead,
  onReload,
  onNotice,
  onDocumentsComplete,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
  onDocumentsComplete?: (complete: boolean) => void;
}) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [documentsComplete, setDocumentsComplete] = useState(false);
  const [amount, setAmount] = useState("50000");
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    const [paymentResult, documentResult, invoiceSettings] = await Promise.all([
      api.leads
        .downPayment(lead.id)
        .then((value) => value as Record<string, unknown>)
        .catch(() => null),
      api.leads.documents(lead.id).catch(() => []),
      api.settings
        .invoice()
        .then((value) => value as { defaultDownPayment?: number })
        .catch(() => null),
    ]);
    setPayment(paymentResult);
    setAmount(
      String(
        paymentResult?.amount ??
          invoiceSettings?.defaultDownPayment ??
          50000,
      ),
    );
    const complete = hasRequiredDocuments(documentResult);
    setDocumentsComplete(complete);
    onDocumentsComplete?.(complete);
  };

  useEffect(() => {
    void reload();
  }, [lead.id]);

  const generateInvoice = async () => {
    setBusy(true);
    try {
      await api.leads.generateInvoice(lead.id, {
        amount: Number(amount),
        currency: "PHP",
        expectedVersion: lead.version,
      });
      onNotice({ message: "Invoice generated.", tone: "success" });
      await reload();
      await onReload();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to generate invoice."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const openInvoice = async () => {
    try {
      const result = await api.leads.invoiceDownload(lead.id);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to open the invoice."),
        tone: "error",
      });
    }
  };

  const submitToFinance = async () => {
    setBusy(true);
    try {
      await api.leads.submitDownPaymentForFinance(lead.id, {
        expectedVersion: lead.version,
      });
      onNotice({
        message: "Down payment submitted to Finance.",
        tone: "success",
      });
      await reload();
      await onReload();
    } catch (e) {
      onNotice({
        message: errorMessage(
          e,
          "Unable to submit the down payment to Finance.",
        ),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmed = payment?.status === "Confirmed";
  const invoiced = payment?.status === "Invoiced";
  const submitted = Boolean(payment?.submittedForFinance);

  if (invoiced || confirmed)
    return (
      <>
        <section className="panel tab-panel invoice-workflow-panel">
          <div className="workflow-current-heading invoice-current-heading">
            <span className="eyebrow">CURRENT STEP</span>
            <h3>
              {confirmed
                ? "Payment verified"
                : submitted
                  ? "Submitted to Finance"
                  : documentsComplete
                    ? "Submit to Finance"
                    : "Upload required documents"}
            </h3>
            <p>
              {confirmed
                ? "Finance has verified the payment."
                : submitted
                  ? "The completed package is with Finance for payment verification."
                  : documentsComplete
                    ? "The invoice and required document are complete. Submit the package to Finance for verification."
                    : "Upload the combined valid ID and signature scan before submitting the package to Finance."}
            </p>
          </div>
          <div className="process-card invoice-action-card">
            {confirmed || submitted ? (
              <div className="completion-card">
                <CheckCircle2 size={19} />
                <div>
                  <strong>
                    {confirmed ? "Payment verified" : "Submitted to Finance"}
                  </strong>
                  <span>
                    {confirmed
                      ? "Finance confirmed the payment. The next workflow step is contract drafting."
                      : `Finance will verify the payment${payment?.submittedAt ? ` · ${formatDate(String(payment.submittedAt))}` : ""}.`}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="invoice-document-checklist">
                  <span className="eyebrow">DOCUMENT CHECKLIST</span>
                  <div className={documentsComplete ? "complete" : ""}>
                    <CheckCircle2 size={17} />
                    <strong>Valid ID with 3 specimen signatures</strong>
                  </div>
                </div>
                <div className="invoice-upload-label eyebrow">UPLOAD FILE (PDF ONLY)</div>
                <DocumentsPanel
                  lead={lead}
                  onNotice={onNotice}
                  onDocumentsChanged={reload}
                  embedded
                />
                {!documentsComplete && (
                  <div className="read-only-note">
                    <ShieldCheck size={16} /> Upload the combined valid ID and
                    three specimen signatures file before submitting to Finance.
                  </div>
                )}
                <button
                  className="button button-primary"
                  onClick={submitToFinance}
                  disabled={busy || !documentsComplete}
                >
                  {busy ? "Submitting…" : "Submit to Finance"}
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
        </section>
      </>
    );
  return (
    <>
      <section className="panel tab-panel">
        <PanelHeader
          title={documentsComplete ? "Generate down payment invoice" : "Upload required documents"}
          subtitle={
            documentsComplete
              ? "The required document is complete. Confirm the amount and generate the invoice."
              : "Upload the combined valid ID and three specimen signatures file before generating the invoice."
          }
        />
        <div className="workflow-instructions">
          <strong>What happens next</strong>
          <span>
            1. Upload one scanned file containing the valid ID and three
            specimen signatures.
          </span>
          <span>
            2. Confirm the down payment amount and generate the invoice.
          </span>
          <span>
            3. Submit the completed invoice and document package to Finance for
            verification.
          </span>
        </div>
        <div className="process-card">
          <div className="invoice-document-checklist">
            <span className="eyebrow">DOCUMENT CHECKLIST</span>
            <div className={documentsComplete ? "complete" : ""}>
              <CheckCircle2 size={17} />
              <strong>Valid ID with 3 specimen signatures</strong>
            </div>
          </div>
          {!documentsComplete && (
            <div className="invoice-upload-label eyebrow">UPLOAD REQUIRED FILE</div>
          )}
          <DocumentsPanel
            lead={lead}
            onNotice={onNotice}
            onDocumentsChanged={reload}
            embedded
            fixedDocumentType="VALID_ID_SIGNATURES"
            visibleTypes={[
              "VALID_ID_SIGNATURES",
              "VALID_ID",
              "SPECIMEN_SIGNATURE_1",
              "SPECIMEN_SIGNATURE_2",
              "SPECIMEN_SIGNATURE_3",
            ]}
            hideUpload={documentsComplete}
            collapsible={documentsComplete}
            uploadedOnly={documentsComplete}
          />
          {documentsComplete ? (
            <>
              <div className="completion-card">
                <CheckCircle2 size={19} />
                <div>
                  <strong>Required document complete</strong>
                  <span>You can now confirm the amount and generate the invoice.</span>
                </div>
              </div>
              <div className="inline-form">
                <label>
                  Amount
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <button
                  className="button button-primary"
                  onClick={generateInvoice}
                  disabled={busy || Number(amount) <= 0}
                >
                  {busy ? "Generating…" : "Generate invoice"}
                </button>
              </div>
            </>
          ) : (
            <div className="read-only-note">
              <ShieldCheck size={16} /> Upload the required document to unlock invoice generation.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function FinanceConfirmationPanel({
  lead,
  onReload,
  onNotice,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reference, setReference] = useState("");
  const [referenceTouched, setReferenceTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    setLoading(true);
    try {
      const [paymentResult, documentResult] = await Promise.all([
        api.leads.downPayment(lead.id),
        api.leads.documents(lead.id),
      ]);
      setPayment(paymentResult as Record<string, unknown>);
      setDocuments(documentResult);
    } catch {
      setPayment(null);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [lead.id]);

  const confirmPayment = async () => {
    setReferenceTouched(true);
    if (!payment) {
      onNotice({
        message: "An invoiced payment is required before confirmation.",
        tone: "error",
      });
      return;
    }
    if (!reference.trim()) {
      onNotice({
        message: "Enter the bank or receipt reference first.",
        tone: "error",
      });
      return;
    }
    if (!payment.documentsComplete) {
      onNotice({
        message:
          "Payment cannot be confirmed until the combined valid ID and three specimen signatures file is uploaded.",
        tone: "error",
      });
      return;
    }
    if (!payment.submittedForFinance) {
      onNotice({
        message:
          "The Agent must submit the completed down payment package to Finance first.",
        tone: "error",
      });
      return;
    }
    setBusy(true);
    try {
      await api.leads.confirmPayment(lead.id, {
        referenceNumber: reference.trim(),
        amount: Number(payment.amount),
        currency: String(payment.currency ?? "PHP"),
        paidAt: new Date().toISOString(),
        expectedVersion: lead.version,
      });
      onNotice({ message: "Payment confirmed.", tone: "success" });
      await reload();
      await onReload();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to confirm payment."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const invoiced = payment?.status === "Invoiced";
  const confirmed = payment?.status === "Confirmed";
  const submitted = Boolean(payment?.submittedForFinance);
  const requiredDocuments = [
    ["VALID_ID_SIGNATURES", "Valid ID + 3 specimen signatures"],
  ] as const;
  const uploadedTypes = new Set(
    documents
      .filter((item) => item.status === "Uploaded")
      .map((item) => item.documentType),
  );
  const missingDocuments = requiredDocuments.filter(
    ([type]) => !uploadedTypes.has(type),
  );
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title="Finance verification"
        subtitle="Verify the invoice and actual payment before recording confirmation."
      />
      <div className="workflow-instructions">
        <strong>Finance checklist</strong>
        <span>1. Match the payment to the issued invoice.</span>
        <span>
          2. Confirm the combined valid ID and three specimen signatures file is
          uploaded.
        </span>
        <span>
          3. Record the bank or receipt reference, then confirm payment.
        </span>
      </div>
      {!confirmed && (
        <div className="workflow-cta-row">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void reload()}
            disabled={loading || busy}
          >
            {loading ? "Refreshing…" : "Refresh verification status"}
          </button>
        </div>
      )}
      <div className="process-card">
        <div className="snapshot-grid">
          <Info
            label="Payment status"
            value={
              loading
                ? "Loading…"
                : confirmed
                  ? "Payment verified"
                  : submitted
                    ? "Awaiting verification"
                    : String(payment?.status ?? "Not started")
            }
          />
          <Info
            label="Amount"
            value={
              payment ? `₱${Number(payment.amount).toLocaleString()}` : "—"
            }
          />
          <Info
            label="Invoice"
            value={String(payment?.invoiceNumber ?? "Not generated")}
          />
          <Info
            label="Required documents"
            value={payment?.documentsComplete ? "Complete" : "Pending"}
          />
        </div>
        {confirmed ? (
          <div className="completion-card">
            <CheckCircle2 size={19} />
            <div>
              <strong>Payment confirmed</strong>
              <span>
                This Finance step is complete. Marketing Admin can now prepare
                the contract.
                {Boolean(payment?.confirmedAt) &&
                  ` · ${formatDate(String(payment.confirmedAt))}`}
              </span>
            </div>
          </div>
        ) : invoiced && submitted ? (
          <>
            <div className="finance-evidence">
              <div>
                <span className="eyebrow">PAYMENT EVIDENCE</span>
                <h3>Receipt or bank confirmation</h3>
                <p>
                  Attach a screenshot, photo, or PDF so this verification has
                  supporting evidence.
                </p>
              </div>
              <DocumentsPanel
                lead={lead}
                onNotice={onNotice}
                onDocumentsChanged={reload}
                embedded
                fixedDocumentType="PAYMENT_RECEIPT"
                visibleTypes={["PAYMENT_RECEIPT"]}
              />
            </div>
            <div className="inline-form">
              <label>
                Payment reference <span className="required-mark">*</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  onBlur={() => setReferenceTouched(true)}
                  placeholder="Bank or receipt reference"
                  aria-invalid={referenceTouched && !reference.trim()}
                  className={
                    referenceTouched && !reference.trim()
                      ? "field-missing"
                      : undefined
                  }
                />
                {referenceTouched && !reference.trim() && (
                  <small className="field-error">
                    Enter the bank transaction or receipt reference.
                  </small>
                )}
              </label>
              <button
                className="button button-primary"
                onClick={confirmPayment}
                disabled={busy}
              >
                {busy ? "Confirming…" : "Confirm payment"}
              </button>
            </div>
            {!payment.documentsComplete && (
              <div className="read-only-note">
                <ShieldCheck size={16} /> Payment confirmation is blocked until
                Marketing uploads:{" "}
                {missingDocuments.map(([, label]) => label).join(", ")}.
              </div>
            )}
          </>
        ) : (
          <div className="read-only-note">
            <ShieldCheck size={16} />{" "}
            {payment
              ? submitted
                ? "An invoiced payment is required before confirmation."
                : "Waiting for the Agent to submit the invoice and required documents to Finance."
              : "No invoice is ready for confirmation."}
            {payment && !payment.documentsComplete
              ? " Required documents are still missing."
              : ""}
          </div>
        )}
      </div>
    </section>
  );
}

function InquiryPanel({
  lead,
  onReload,
  onNotice,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [form, setForm] = useState({
    fullName: lead.fullName,
    age: lead.age?.toString() ?? "",
    contactNumber: lead.contactNumber,
    email: lead.email,
    sourceOfIncome: lead.sourceOfIncome,
    preferredLocation: lead.preferredLocation ?? "",
    address: lead.address ?? "",
    industry: lead.industry ?? "",
    meetingDateTime: lead.meetingDateTime?.slice(0, 16) ?? "",
    questionsConcerns: lead.questionsConcerns ?? "",
  });
  const [inquiryLead, setInquiryLead] = useState<Lead>(lead);
  const [loading, setLoading] = useState(false);

  const loadInquiry = async () => {
    const item = await api.leads.getInquiry(lead.id);
    setInquiryLead(item);
    setForm({
      fullName: item.fullName,
      age: item.age?.toString() ?? "",
      contactNumber: item.contactNumber,
      email: item.email,
      sourceOfIncome: item.sourceOfIncome,
      preferredLocation: item.preferredLocation ?? "",
      address: item.address ?? "",
      industry: item.industry ?? "",
      meetingDateTime: item.meetingDateTime?.slice(0, 16) ?? "",
      questionsConcerns: item.questionsConcerns ?? "",
    });
  };

  useEffect(() => {
    void loadInquiry().catch(() => undefined);
  }, [lead.id]);

  const inquiryPayload = () => ({
    ...form,
    age: form.age ? Number(form.age) : null,
    meetingDateTime: form.meetingDateTime
      ? new Date(form.meetingDateTime).toISOString()
      : null,
  });

  const ensureInquiryStarted = async () => {
    if (inquiryLead.state !== "New") return inquiryLead;

    const startedLead = await api.leads.startInquiry(lead.id);
    setInquiryLead(startedLead);
    return startedLead;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const currentLead = await ensureInquiryStarted();
      const updatedLead = await api.leads.updateInquiry(lead.id, {
        ...inquiryPayload(),
        expectedVersion: currentLead.version,
      });
      setInquiryLead(updatedLead);
      await onReload();
      onNotice({ message: "Inquiry details saved.", tone: "success" });
    } catch (e) {
      const message = errorMessage(e, "Unable to save inquiry.");
      if (message.toLowerCase().includes("refresh")) {
        await loadInquiry().catch(() => undefined);
        onNotice({
          message:
            "This lead was updated elsewhere. The inquiry form has been refreshed; review it and save again.",
          tone: "error",
        });
      } else {
        onNotice({ message, tone: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const missing = [
    form.fullName.trim() ? null : "Full name",
    form.age.trim() ? null : "Age",
    form.contactNumber.trim() ? null : "Contact number",
    form.email.trim() ? null : "Email",
    form.sourceOfIncome.trim() ? null : "Source of income",
  ].filter((item): item is string => Boolean(item));

  if (!["New", "Inquiry", "InquiryIncomplete"].includes(lead.state))
    return (
      <section className="panel tab-panel">
        <PanelHeader
          title="Inquiry completed"
          subtitle="The required inquiry information was captured for this opportunity."
        />
        <div className="completion-card">
          <CheckCircle2 size={19} />
          <div>
            <strong>Inquiry accepted</strong>
            <span>
              The opportunity has moved forward. Inquiry details are now
              read-only; review the next workflow step instead.
            </span>
          </div>
        </div>
        <div className="snapshot-grid">
          <Info label="Full name" value={inquiryLead.fullName} />
          <Info label="Contact" value={inquiryLead.contactNumber} />
          <Info label="Email" value={inquiryLead.email} />
          <Info
            label="Preferred location"
            value={inquiryLead.preferredLocation ?? "Not provided"}
          />
        </div>
      </section>
    );
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title="Inquiry details"
        subtitle="Keep the qualification record complete and current."
      />
      {lead.state === "New" ? (
        <div className="callout">
          This is a new lead. Saving the form will start the inquiry and then
          save these details.
        </div>
      ) : null}
      {missing.length ? (
        <div className="callout">
          This lead is incomplete. Required before it can move forward:{" "}
          <strong>{missing.join(", ")}</strong>.
        </div>
      ) : null}
      <form className="form-grid" onSubmit={save} noValidate>
        {(
          [
            ["fullName", "Full name", true],
            ["age", "Age", true],
            ["contactNumber", "Contact number", true],
            ["email", "Email", true],
            ["sourceOfIncome", "Source of income", true],
            ["preferredLocation", "Preferred location", false],
            ["address", "Address", false],
            ["industry", "Industry", false],
            ["meetingDateTime", "Meeting date and time", false],
            ["questionsConcerns", "Questions or concerns", false],
          ] as [keyof typeof form, string, boolean][]
        ).map(([key, label, required]) => (
          <label key={key}>
            <span>
              {label}
              {required ? <span className="required-mark"> *</span> : null}
            </span>
            <input
              value={form[key as keyof typeof form]}
              onChange={(e) =>
                setForm((current) => ({ ...current, [key]: e.target.value }))
              }
              type={
                key === "age"
                  ? "number"
                  : key === "email"
                    ? "email"
                    : key === "meetingDateTime"
                      ? "datetime-local"
                      : "text"
              }
              required={Boolean(required)}
              aria-invalid={required && !form[key].trim()}
              className={required && !form[key].trim() ? "field-missing" : undefined}
            />
            {required && !form[key].trim() ? (
              <small className="field-error">{label} is required.</small>
            ) : null}
          </label>
        ))}
        <div className="form-actions">
          <button className="button button-primary" disabled={loading}>
            {loading ? "Saving…" : "Save inquiry"}
          </button>
          <button
            type="button"
            className="button button-secondary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const currentLead = await ensureInquiryStarted();
                const updatedLead = await api.leads.updateInquiry(lead.id, {
                  ...inquiryPayload(),
                  expectedVersion: currentLead.version,
                });
                setInquiryLead(updatedLead);
                const result = (await api.leads.submitInquiry(lead.id)) as {
                  acceptedForNurturing?: boolean;
                };
                await onReload();
                onNotice({
                  message: result.acceptedForNurturing
                    ? "Inquiry accepted and nurturing started."
                    : `Inquiry saved as incomplete. A follow-up task was created${missing.length ? ` for: ${missing.join(", ")}` : ""}.`,
                  tone: "success",
                });
              } catch (e) {
                onNotice({
                  message: errorMessage(e, "Unable to submit inquiry."),
                  tone: "error",
                });
              } finally {
                setLoading(false);
              }
            }}
          >
            Submit inquiry
          </button>
        </div>
      </form>
    </section>
  );
}

function QualificationPanel({
  lead,
  onReload,
  onNotice,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<"qualified" | "follow_up">(
    "qualified",
  );
  const [followUpAt, setFollowUpAt] = useState("");
  const [version, setVersion] = useState(lead.version);
  const [busy, setBusy] = useState(false);
  const [productLine, setProductLine] = useState(lead.productLine ?? "");
  const [actualPrice, setActualPrice] = useState(
    lead.actualPrice?.toString() ?? "",
  );
  const [callOutcome, setCallOutcome] = useState(lead.lastCallOutcome ?? "");
  const [welcomeReceived, setWelcomeReceived] = useState(
    lead.welcomeEmailReceived ?? "Unknown",
  );
  const [goodTime, setGoodTime] = useState(lead.goodTimeToDiscuss ?? "Unknown");
  const [nurturingSaved, setNurturingSaved] = useState(
    Boolean(lead.productLine && lead.lastCallOutcome),
  );

  useEffect(() => {
    api.leads
      .getNurturing(lead.id)
      .then((value) => {
        const record = value as {
          notes?: string;
          version?: number;
          productLine?: string;
          actualPrice?: number;
          lastCallOutcome?: string;
          welcomeEmailReceived?: string;
          goodTimeToDiscuss?: string;
        };
        setNotes(record.notes ?? "");
        setVersion(record.version ?? lead.version);
        setProductLine(record.productLine ?? lead.productLine ?? "");
        setActualPrice(
          record.actualPrice?.toString() ?? lead.actualPrice?.toString() ?? "",
        );
        setCallOutcome(record.lastCallOutcome ?? lead.lastCallOutcome ?? "");
        setWelcomeReceived(
          record.welcomeEmailReceived ?? lead.welcomeEmailReceived ?? "Unknown",
        );
        setGoodTime(
          record.goodTimeToDiscuss ?? lead.goodTimeToDiscuss ?? "Unknown",
        );
        setNurturingSaved(
          Boolean(
            (record.productLine ?? lead.productLine) &&
            (record.lastCallOutcome ?? lead.lastCallOutcome),
          ),
        );
      })
      .catch(() => setVersion(lead.version));
  }, [lead.id, lead.version]);

  const persistNurturingDetails = async () => {
    await api.leads.updateNurturing(lead.id, {
      notes: notes.trim() || null,
      productLine,
      actualPrice: actualPrice ? Number(actualPrice) : null,
      expectedVersion: version,
    });
    const refreshed = await api.leads.get(lead.id);
    await api.leads.recordCallOutcome(lead.id, {
      outcome: callOutcome.trim(),
      welcomeEmailReceived: welcomeReceived,
      goodTimeToDiscuss: goodTime,
      notes: notes.trim() || null,
      expectedVersion: refreshed.version,
    });
    const latest = (await api.leads.getNurturing(lead.id)) as {
      version: number;
    };
    setVersion(latest.version);
    setNurturingSaved(true);
    return latest.version;
  };

  const saveNurturing = async () => {
    const missing = [
      !productLine ? "Product line" : null,
      !callOutcome.trim() ? "Call outcome" : null,
      welcomeReceived === "Unknown" ? "Welcome email status" : null,
      goodTime === "Unknown" ? "Good time to discuss" : null,
    ].filter((item): item is string => Boolean(item));
    if (missing.length) {
      onNotice({
        message: `Please complete: ${missing.join(", ")}.`,
        tone: "error",
      });
      return;
    }
    setBusy(true);
    try {
      await persistNurturingDetails();
      await onReload();
      onNotice({
        message: "Nurturing contact and franchise offer saved.",
        tone: "success",
      });
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to save nurturing details."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missing = [
      !productLine ? "Product line" : null,
      !callOutcome.trim() ? "Call outcome" : null,
      welcomeReceived === "Unknown" ? "Welcome email status" : null,
      goodTime === "Unknown" ? "Good time to discuss" : null,
      !notes.trim() ? "Contact and assessment notes" : null,
    ].filter((item): item is string => Boolean(item));
    if (missing.length) {
      onNotice({
        message: `Please complete: ${missing.join(", ")}.`,
        tone: "error",
      });
      return;
    }
    if (decision === "follow_up" && !followUpAt) {
      onNotice({
        message: "Choose a follow-up date before saving this decision.",
        tone: "error",
      });
      return;
    }
    setBusy(true);
    try {
      let qualificationVersion = version;
      if (!nurturingSaved) {
        qualificationVersion = await persistNurturingDetails();
      }
      await api.leads.qualify(lead.id, {
        decision,
        notes: notes.trim() || null,
        followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        expectedVersion: qualificationVersion,
      });
      await onReload();
      onNotice({
        message:
          decision === "qualified" ? "Lead qualified." : "Follow-up scheduled.",
        tone: "success",
      });
    } catch (e) {
      const message = errorMessage(
        e,
        "Unable to save the qualification decision.",
      );
      if (message.toLowerCase().includes("refresh")) {
        onNotice({
          message:
            "This lead changed elsewhere. Refresh the record and review the qualification again.",
          tone: "error",
        });
      } else {
        onNotice({ message, tone: "error" });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!["Nurturing", "FollowUp"].includes(lead.state))
    return (
      <section className="panel tab-panel">
        <PanelHeader
          title="Qualification completed"
          subtitle="The qualification decision has already been recorded for this opportunity."
        />
        <div className="completion-card">
          <CheckCircle2 size={19} />
          <div>
            <strong>
              {lead.state === "Qualified"
                ? "Lead qualified"
                : "Qualification completed"}
            </strong>
            <span>
              {lead.state === "Qualified"
                ? "The opportunity is ready for its required document upload."
                : `This opportunity is now in ${labelForState(lead.state)}.`}
            </span>
          </div>
        </div>
        <div className="snapshot-grid">
          <Info
            label="Decision"
            value={
              lead.state === "Qualified"
                ? "Qualified"
                : labelForState(lead.state)
            }
          />
          <Info label="Recorded notes" value={notes || "No notes recorded"} />
          <Info
            label="Next step"
            value={
              lead.state === "Qualified"
                ? "Upload required documents"
                : nextStepForLead(lead).label
            }
          />
        </div>
      </section>
    );
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title="Qualify this lead"
        subtitle="Follow the decision step-by-step so the next owner knows what happened."
      />
      <div className="workflow-instructions">
        <strong>How to complete this step</strong>
        <span>
          1. Record the call outcome and whether the welcome email was received.
        </span>
        <span>2. Select the franchise product and agreed price.</span>
        <span>
          3. Save the nurturing details, then qualify or create a follow-up.
        </span>
      </div>
      {[
        !productLine ? "Product line" : null,
        !callOutcome.trim() ? "Call outcome" : null,
        welcomeReceived === "Unknown" ? "Welcome email status" : null,
        goodTime === "Unknown" ? "Good time to discuss" : null,
      ].some(Boolean) ? (
        <div className="missing-fields-summary" role="status">
          <strong>Still needed</strong>
          <span>
            {[
              !productLine ? "Product line" : null,
              !callOutcome.trim() ? "Call outcome" : null,
              welcomeReceived === "Unknown" ? "Welcome email status" : null,
              goodTime === "Unknown" ? "Good time to discuss" : null,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      ) : null}
      <div className="process-card">
        <div className="form-grid">
          <label>
            Product line
            <select
              value={productLine}
              onChange={(e) => {
                setProductLine(e.target.value as ProductLine | "");
                setNurturingSaved(false);
              }}
              required
              aria-invalid={!productLine}
              className={!productLine ? "field-missing" : undefined}
            >
              <option value="">Select product</option>
              <option value="Abc">ABC</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Combo">Combo</option>
            </select>
          </label>
          <label>
            Agreed actual price
            <input
              type="number"
              min="1"
              value={actualPrice}
              onChange={(e) => {
                setActualPrice(e.target.value);
                setNurturingSaved(false);
              }}
              placeholder="Defaults to the product list price"
            />
          </label>
          <label>
            Call outcome
            <input
              value={callOutcome}
              onChange={(e) => {
                setCallOutcome(e.target.value);
                setNurturingSaved(false);
              }}
              maxLength={40}
              placeholder="Interested, follow-up, not available…"
              required
              aria-invalid={!callOutcome.trim()}
              className={!callOutcome.trim() ? "field-missing" : undefined}
            />
          </label>
          <label>
            Welcome email received?
            <select
              value={welcomeReceived}
              onChange={(e) => {
                setWelcomeReceived(e.target.value);
                setNurturingSaved(false);
              }}
              aria-invalid={welcomeReceived === "Unknown"}
              className={
                welcomeReceived === "Unknown" ? "field-missing" : undefined
              }
            >
              <option>Unknown</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </label>
          <label>
            Good time to discuss?
            <select
              value={goodTime}
              onChange={(e) => {
                setGoodTime(e.target.value);
                setNurturingSaved(false);
              }}
              aria-invalid={goodTime === "Unknown"}
              className={goodTime === "Unknown" ? "field-missing" : undefined}
            >
              <option>Unknown</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={saveNurturing}
        >
          {nurturingSaved
            ? "Nurturing details saved ✓"
            : "Save nurturing details"}
        </button>
      </div>
      <form className="stack-form qualification-form" onSubmit={submit} noValidate>
        <label>
          Contact and assessment notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            required
            aria-invalid={!notes.trim()}
            className={!notes.trim() ? "field-missing" : undefined}
            maxLength={4000}
            placeholder="What did you discuss? What is the lead's readiness, concern, or next commitment?"
          />
        </label>
        <label>
          Decision
          <select
            value={decision}
            onChange={(e) =>
              setDecision(e.target.value as "qualified" | "follow_up")
            }
          >
            <option value="qualified">Qualified — move to down payment</option>
            <option value="follow_up">Follow-up needed — keep nurturing</option>
          </select>
        </label>
        {decision === "follow_up" && (
          <label>
            Follow-up date and time
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              required
            />
          </label>
        )}
        <button
          className="button button-primary"
          disabled={busy}
        >
          {busy ? "Saving…" : "Save qualification decision"}
          <ChevronRight size={16} />
        </button>
      </form>
    </section>
  );
}

function LocationAnalysisPanel({
  lead,
  onReload,
  onNotice,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [analysis, setAnalysis] = useState<{
    preferredLocation: string;
    status: string;
    notes?: string;
    updatedAt?: string;
  } | null>(null);
  const [preferredLocation, setPreferredLocation] = useState(
    lead.preferredLocation ?? "",
  );
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<LocationDecision>("Pending");
  const [busy, setBusy] = useState(false);
  const canEdit = hasRole(session.user?.role, leadWriteRoles);

  useEffect(() => {
    api.leads
      .location(lead.id)
      .then((value) => {
        const item = value as {
          preferredLocation: string;
          status: string;
          notes?: string;
          updatedAt?: string;
        };
        setAnalysis(item);
        setPreferredLocation(item.preferredLocation);
        setNotes(item.notes ?? "");
        setDecision(normaliseLocationDecision(item.status));
      })
      .catch(() => {
        setAnalysis(null);
        setPreferredLocation(lead.preferredLocation ?? "");
        setNotes("");
        setDecision("Pending");
      });
  }, [lead.id, lead.preferredLocation]);

  const saveAssessment = async (event: FormEvent) => {
    event.preventDefault();
    if (!preferredLocation.trim() || !notes.trim()) {
      onNotice({
        message:
          "Add assessment notes before saving the location recommendation.",
        tone: "error",
      });
      return;
    }
    setBusy(true);
    try {
      await api.leads.updateLocation(lead.id, {
        preferredLocation: preferredLocation.trim(),
        notes: notes.trim(),
        expectedVersion: lead.version,
      });
      const refreshedLead = await api.leads.get(lead.id);
      const value = await api.leads.evaluateLocation(lead.id, {
        decision,
        notes: notes.trim(),
        expectedVersion: refreshedLead.version,
      });
      setAnalysis((current) => ({
        ...(current ?? { preferredLocation: preferredLocation.trim() }),
        preferredLocation: preferredLocation.trim(),
        ...(value as object),
        status: decision,
      }));
      await onReload();
      onNotice({
        message:
          decision === "Passed"
            ? "Location recommendation approved and saved."
            : decision === "Failed"
              ? "Location recommendation rejected and saved."
              : "Assessment saved. The conditional analysis remains under review.",
        tone: "success",
      });
    } catch (e) {
      const message = errorMessage(
        e,
        "Unable to save the location assessment.",
      );
      onNotice({
        message: message.toLowerCase().includes("refresh")
          ? "This lead changed elsewhere. Refresh the record and try saving again."
          : message,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const hasAssessment = notes.trim().length >= 10;
  const status = normaliseLocationDecision(analysis?.status);
  const decisionLabel =
    decision === "Passed"
      ? "Approve location"
      : decision === "Failed"
        ? "Save rejection"
        : "Save assessment";
  const decisionMessage =
    decision === "Passed"
      ? "The recommendation will be recorded without changing the pipeline stage."
      : decision === "Failed"
        ? "The rejected recommendation will be retained for the team to address."
        : "This conditional assessment remains open for more information.";

  return (
    <section className="location-workspace">
      <div className="location-main panel">
        <div className="location-heading">
          <div>
            <span className="eyebrow">CURRENT WORKFLOW STEP</span>
            <h2>Location analysis</h2>
            <p>
              Assess the proposed site and make a recommendation for the next
              team.
            </p>
          </div>
          <span className={`location-status-badge ${status.toLowerCase()}`}>
            <i />
            {status === "Passed"
              ? "Approved"
              : status === "Failed"
                ? "Rejected"
                : "In progress"}
          </span>
        </div>
        <div className="location-checklist">
          <div className="location-checklist-item complete">
            <span>✓</span>
            <div>
              <strong>Confirm proposed location</strong>
              <small>{preferredLocation || "Location not provided"}</small>
            </div>
          </div>
          <div
            className={`location-checklist-item ${hasAssessment ? "complete" : "current"}`}
          >
            <span>{hasAssessment ? "✓" : "2"}</span>
            <div>
              <strong>Record assessment</strong>
              <small>
                {hasAssessment
                  ? "Findings and recommendation added."
                  : "Add findings, risks, and recommendation below."}
              </small>
            </div>
          </div>
          <div
            className={`location-checklist-item ${analysis?.status && status !== "Pending" ? "complete" : "current"}`}
          >
            <span>{analysis?.status && status !== "Pending" ? "✓" : "3"}</span>
            <div>
              <strong>Make decision</strong>
              <small>
                {analysis?.status && status !== "Pending"
                  ? "Decision recorded."
                  : hasAssessment
                    ? "Choose a recommendation below."
                    : "Available after assessment details are saved."}
              </small>
            </div>
          </div>
        </div>
        <form className="location-assessment-form" onSubmit={saveAssessment}>
          <div className="location-field-block">
            <label htmlFor="proposed-location">Proposed location</label>
            <div className="location-value-field">
              <input
                id="proposed-location"
                required
                minLength={2}
                maxLength={240}
                value={preferredLocation}
                onChange={(e) => setPreferredLocation(e.target.value)}
                placeholder="City, branch, or proposed site"
                disabled={!canEdit}
              />
              <button
                type="button"
                onClick={() =>
                  document.getElementById("proposed-location")?.focus()
                }
                disabled={!canEdit}
              >
                Change
              </button>
            </div>
          </div>
          <label className="location-field-block" htmlFor="assessment-notes">
            <span>Assessment notes</span>
            <textarea
              id="assessment-notes"
              required
              minLength={10}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record site findings, risks, demographics, accessibility, competition, and your recommendation."
              disabled={!canEdit}
            />
            <small>{notes.length}/2000 characters</small>
          </label>
          <div className="recommendation-block">
            <div className="recommendation-heading">
              <div>
                <span className="eyebrow">LOCATION RECOMMENDATION</span>
                <h3>What is your recommendation for this location?</h3>
              </div>
              <span className="decision-status">
                {status === "Passed"
                  ? "Approved"
                  : status === "Failed"
                    ? "Rejected"
                    : "Pending review"}
              </span>
            </div>
            <div
              className="decision-options"
              role="radiogroup"
              aria-label="Location recommendation"
            >
              <button
                type="button"
                className={`decision-option ${decision === "Passed" ? "selected passed" : ""}`}
                onClick={() => setDecision("Passed")}
                aria-pressed={decision === "Passed"}
                disabled={!canEdit || !hasAssessment}
              >
                <span className="decision-option-icon">
                  <CheckCircle2 size={17} />
                </span>
                <span>
                  <strong>Approve location</strong>
                  <small>
                    Suitable recommendation recorded for the opportunity.
                  </small>
                </span>
              </button>
              <button
                type="button"
                className={`decision-option ${decision === "Pending" ? "selected pending" : ""}`}
                onClick={() => setDecision("Pending")}
                aria-pressed={decision === "Pending"}
                disabled={!canEdit || !hasAssessment}
              >
                <span className="decision-option-icon">
                  <Clock3 size={17} />
                </span>
                <span>
                  <strong>Needs additional review</strong>
                  <small>
                    Keep this opportunity here while more information is
                    gathered.
                  </small>
                </span>
              </button>
              <button
                type="button"
                className={`decision-option ${decision === "Failed" ? "selected failed" : ""}`}
                onClick={() => setDecision("Failed")}
                aria-pressed={decision === "Failed"}
                disabled={!canEdit || !hasAssessment}
              >
                <span className="decision-option-icon">
                  <X size={17} />
                </span>
                <span>
                  <strong>Reject location</strong>
                  <small>
                    A new location is needed before the opportunity can
                    progress.
                  </small>
                </span>
              </button>
            </div>
            <p className="decision-explanation">{decisionMessage}</p>
          </div>
          {canEdit ? <div className="location-form-footer">
            <span className={hasAssessment ? "save-state ready" : "save-state"}>
              {hasAssessment
                ? "✓ Ready to save assessment"
                : "Add assessment notes to continue"}
            </span>
            <div className="button-row">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setPreferredLocation(
                    analysis?.preferredLocation ?? lead.preferredLocation ?? "",
                  );
                  setNotes(analysis?.notes ?? "");
                  setDecision(normaliseLocationDecision(analysis?.status));
                }}
              >
                Discard changes
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={busy || !preferredLocation.trim() || !hasAssessment}
              >
                {busy ? "Saving…" : decisionLabel}
                <ChevronRight size={16} />
              </button>
            </div>
          </div> : (
            <div className="read-only-note">
              <ShieldCheck size={16} /> Location analysis is view-only for your role.
            </div>
          )}
        </form>
      </div>
      <aside className="location-context panel">
        <div className="location-context-heading">
          <div>
            <span className="eyebrow">LOCATION ANALYSIS</span>
            <h3>Progress</h3>
          </div>
          <span className={`location-status-badge ${status.toLowerCase()}`}>
            <i />
            {status === "Passed" ? "Complete" : "Required to complete"}
          </span>
        </div>
        <div className="context-list">
          <div>
            <span className="context-check complete">✓</span>
            <span>Candidate qualified</span>
          </div>
          <div>
            <span className="context-check complete">✓</span>
            <span>Proposed location provided</span>
          </div>
          <div>
            <span
              className={`context-check ${hasAssessment ? "complete" : ""}`}
            >
              {hasAssessment ? "✓" : "○"}
            </span>
            <span>Assessment recorded</span>
          </div>
          <div>
            <span
              className={`context-check ${status !== "Pending" ? "complete" : ""}`}
            >
              {status !== "Pending" ? "✓" : "○"}
            </span>
            <span>Decision recorded</span>
          </div>
        </div>
        <div className="context-divider" />
        <div className="context-fact">
          <span>Current owner</span>
          <strong>Assigned agent · {lead.assignedAgentName ?? "Unknown agent"}</strong>
        </div>
        <div className="context-fact">
          <span>Pipeline impact</span>
          <strong>No automatic stage change</strong>
        </div>
        <div className="context-next">
          <span className="eyebrow">WHEN YOU FINISH</span>
          <p>{decisionMessage}</p>
        </div>
      </aside>
    </section>
  );
}

function DocumentsPanel({
  lead,
  onNotice,
  onDocumentsChanged,
  embedded = false,
  fixedDocumentType,
  visibleTypes,
  hideUpload = false,
  collapsible = false,
  uploadedOnly = false,
}: {
  lead: Lead;
  onNotice: (notice: Notice) => void;
  onDocumentsChanged?: () => Promise<void>;
  embedded?: boolean;
  fixedDocumentType?: string;
  visibleTypes?: string[];
  hideUpload?: boolean;
  collapsible?: boolean;
  uploadedOnly?: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState(
    fixedDocumentType ?? "VALID_ID_SIGNATURES",
  );
  const [busy, setBusy] = useState(false);
  const canUpload =
    fixedDocumentType === "PAYMENT_RECEIPT"
      ? session.user?.role === "Finance"
      : hasRole(session.user?.role, marketingWriteRoles) ||
        session.user?.role === "Finance";
  const uploadOptions =
    session.user?.role === "Finance"
      ? [["PAYMENT_RECEIPT", "Payment receipt or bank confirmation"]]
      : session.user?.role === "MarketingAgent"
      ? [["VALID_ID_SIGNATURES", "Valid ID + 3 specimen signatures"]]
      : [
          ["VALID_ID_SIGNATURES", "Valid ID + 3 specimen signatures"],
          ["FLOOR_PLAN", "Floor plan"],
          ["PERSPECTIVE", "Perspective"],
          ["SIGNED_CONTRACT", "Signed contract"],
        ];
  const typeFilteredDocuments = visibleTypes?.length
    ? documents.filter((item) => visibleTypes.includes(item.documentType))
    : documents;
  const displayedDocuments = uploadedOnly
    ? typeFilteredDocuments.filter((item) => item.status === "Uploaded")
    : typeFilteredDocuments;
  const reload = () =>
    api.leads
      .documents(lead.id)
      .then(setDocuments)
      .catch((e) =>
        onNotice({
          message: errorMessage(e, "Unable to load documents."),
          tone: "error",
        }),
      )
      .finally(() => setLoading(false));
  useEffect(() => {
    if (fixedDocumentType) setDocumentType(fixedDocumentType);
    void reload();
  }, [lead.id, fixedDocumentType]);
  const selectFile = (selectedFile?: File) => {
    if (selectedFile) setFile(selectedFile);
  };
  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const intent = await api.leads.uploadIntent(lead.id, {
        documentType,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      const response = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": intent.requiredContentType },
        body: file,
      });
      if (!response.ok) throw new Error("Private storage rejected the upload.");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      );
      const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      await api.leads.completeUpload(lead.id, intent.documentId, {
        documentId: intent.documentId,
        objectKey: intent.objectKey,
        sha256: hash,
      });
      setFile(null);
      onNotice({ message: "Document uploaded securely.", tone: "success" });
      await reload();
      await onDocumentsChanged?.();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to upload document."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const download = async (item: DocumentItem) => {
    try {
      const result = (await api.leads.downloadUrl(lead.id, item.id)) as {
        downloadUrl: string;
      };
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to create a download link."),
        tone: "error",
      });
    }
  };
  const content = (
    <>
      {canUpload && !hideUpload ? (
        <form className="document-upload" onSubmit={upload}>
          {!embedded && !fixedDocumentType && (
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              aria-label="Document type"
            >
              {uploadOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
          {embedded ? (
            <label
              className={`document-dropzone ${file ? "has-file" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files?.[0]);
              }}
            >
              <FileText size={22} />
              <span>
                {file ? (
                  <strong>{file.name}</strong>
                ) : (
                  <>Drag and drop or <strong>browse file</strong></>
                )}
              </span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => selectFile(e.target.files?.[0])}
                required
              />
            </label>
          ) : (
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => selectFile(e.target.files?.[0])}
              required
            />
          )}
          <button className="button button-primary" disabled={busy || !file}>
            {busy ? "Uploading…" : embedded ? "Upload file" : "Upload private file"}
          </button>
        </form>
      ) : !hideUpload ? (
        <div className="read-only-note">
          <ShieldCheck size={16} /> Documents are view-only for your role.
        </div>
      ) : null}
      {loading ? (
        <Loading />
      ) : displayedDocuments.length ? (
        collapsible ? (
          <details className="document-disclosure">
            <summary>
              <span><FileText size={16} /> Uploaded documents</span>
              <strong>{displayedDocuments.length}</strong>
            </summary>
            <div className="document-list">
              {displayedDocuments.map((item) => (
                <div className="document-row" key={item.id}>
                  <div className="document-icon"><FileText size={17} /></div>
                  <div>
                    <strong>{item.fileName}</strong>
                    <span>{documentTypeLabel(item.documentType)} · {Math.ceil(item.sizeBytes / 1024)} KB</span>
                  </div>
                  <button className="text-link" onClick={() => download(item)}>
                    Open <ArrowUpRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <div className="document-list">
            {displayedDocuments.map((item) => (
              <div className="document-row" key={item.id}>
                <div className="document-icon"><FileText size={17} /></div>
                <div>
                  <strong>{item.fileName}</strong>
                  <span>{documentTypeLabel(item.documentType)} · {Math.ceil(item.sizeBytes / 1024)} KB · {item.status}</span>
                </div>
                <button className="text-link" onClick={() => download(item)}>
                  Open <ArrowUpRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={FileText}
          title={
            fixedDocumentType === "PAYMENT_RECEIPT"
              ? "No payment evidence attached"
              : fixedDocumentType === "FLOOR_PLAN"
                ? "No floor plan uploaded"
                : fixedDocumentType === "PERSPECTIVE"
                  ? "No perspective uploaded"
                  : "No documents yet"
          }
          text={
            fixedDocumentType === "PAYMENT_RECEIPT"
              ? "Finance can attach a receipt screenshot, bank confirmation, or PDF for this verification."
              : fixedDocumentType === "FLOOR_PLAN"
                ? "Upload the floor plan required before the contract is submitted for GM review."
                : fixedDocumentType === "PERSPECTIVE"
                  ? "Upload the site perspective required before the contract is submitted for GM review."
                  : "Upload one scanned file containing the valid ID and three specimen signatures before Finance confirms payment."
          }
        />
      )}
    </>
  );
  return embedded ? (
    <div className="embedded-documents">{content}</div>
  ) : (
    <section className="panel tab-panel">
      <PanelHeader
        title="Documents"
        subtitle="Private files use short-lived links and server-side ownership checks."
      />
      {content}
    </section>
  );
}

function FinancePanel({
  lead,
  onReload,
  onNotice,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [amount, setAmount] = useState(
    "50000",
  );
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = () =>
    api.leads
      .downPayment(lead.id)
      .then((value) => setPayment(value as Record<string, unknown>))
      .catch(() => setPayment(null));
  useEffect(() => {
    void reload();
  }, [lead.id]);
  const invoice = async () => {
    setBusy(true);
    try {
      await api.leads.generateInvoice(lead.id, {
        amount: Number(amount),
        currency: "PHP",
      });
      onNotice({ message: "Invoice generated.", tone: "success" });
      await reload();
      await onReload();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to generate invoice."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      await api.leads.confirmPayment(lead.id, {
        referenceNumber: reference,
        amount: Number(amount),
        currency: "PHP",
        paidAt: new Date().toISOString(),
        expectedVersion: lead.version,
      });
      onNotice({ message: "Payment confirmation submitted.", tone: "success" });
      await reload();
      await onReload();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to confirm payment."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title="Down payment"
        subtitle="Invoice and confirmation actions follow finance permissions."
      />
      <div className="process-card">
        <div className="snapshot-grid">
          <Info
            label="Status"
            value={String(payment?.status ?? "Not started")}
          />
          <Info
            label="Amount"
            value={`₱${Number(payment?.amount ?? amount).toLocaleString()}`}
          />
          <Info
            label="Invoice"
            value={String(payment?.invoiceNumber ?? "Not generated")}
          />
          <Info
            label="Documents"
            value={payment?.documentsComplete ? "Complete" : "Pending"}
          />
        </div>
        <div className="inline-form">
          <label>
            Amount
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button
            className="button button-primary"
            onClick={invoice}
            disabled={busy}
          >
            Generate invoice
          </button>
        </div>
        {payment?.status === "Invoiced" && (
          <div className="inline-form">
            <label>
              Payment reference
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bank or receipt reference"
              />
            </label>
            <button
              className="button button-secondary"
              onClick={confirm}
              disabled={busy || !reference}
            >
              Confirm payment
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ContractPanel({
  lead,
  onReload,
  onNotice,
  onContractChange,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
  onContractChange?: (contract: Contract | null) => void;
}) {
  type ReviewItem = {
    id: string;
    code: string;
    name: string;
    required: boolean;
    complete: boolean;
    notes?: string | null;
  };
  type ReviewChecklist = {
    leadId: string;
    items: ReviewItem[];
    complete: boolean;
  };
  const [contract, setContract] = useState<Contract | null>(null);
  const [checklist, setChecklist] = useState<ReviewChecklist | null>(null);
  const [template, setTemplate] = useState("STANDARD_FRANCHISE");
  const [notes, setNotes] = useState("");
  const [franchiseeName, setFranchiseeName] = useState("");
  const [drCareName, setDrCareName] = useState("");
  const [franchiseeEmail, setFranchiseeEmail] = useState(lead.email);
  const [drCareEmail, setDrCareEmail] = useState(session.user?.email ?? "");
  const [signingRequests, setSigningRequests] = useState<SigningRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const canDraft = session.user?.role === "MarketingAdmin";
  const canReview = session.user?.role === "GeneralManager";
  const canSign = hasRole(session.user?.role, marketingWriteRoles);
  const canEditDraft =
    canDraft &&
    (!contract ||
      contract.status === "Draft" ||
      contract.status === "RevisionRequested");
  const canChecklist = canReview && contract?.status === "InReview";
  const reload = async () => {
    try {
      const next = await api.leads.contract(lead.id);
      setContract(next);
      setTemplate(next.templateCode || "STANDARD_FRANCHISE");
      onContractChange?.(next);
      const nextChecklist = await api.leads.contractChecklist(lead.id);
      setChecklist(nextChecklist as ReviewChecklist);
      setSigningRequests(await api.leads.signingRequests(lead.id));
    } catch {
      setContract(null);
      onContractChange?.(null);
      setChecklist(null);
    }
  };
  useEffect(() => {
    void reload();
  }, [lead.id]);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      onNotice({ message, tone: "success" });
      await reload();
      await onReload();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Contract action could not be completed."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const saveChecklist = () => {
    if (!checklist) return;
    return run(
      () =>
        api.leads.updateContractChecklist(lead.id, {
          leadId: lead.id,
          items: checklist.items,
          complete: checklist.complete,
          expectedVersion: lead.version,
        }),
      "Review checklist saved.",
    );
  };
  const toggleChecklist = (itemId: string) =>
    setChecklist((current) => {
      if (!current) return current;
      const items = current.items.map((item) =>
        item.id === itemId ? { ...item, complete: !item.complete } : item,
      );
      return {
        ...current,
        items,
        complete: items
          .filter((item) => item.required)
          .every((item) => item.complete),
      };
    });
  const requestSignature = (
    role: "franchisee" | "dr-care",
    signerName: string,
    signerEmail: string,
  ) => {
    if (!signerName.trim() || !signerEmail.trim()) {
      onNotice({
        message: "Enter the signer name and email before creating the link.",
        tone: "error",
      });
      return;
    }
    return run(async () => {
      const created = await api.leads.createSigningRequest(lead.id, {
        signerRole: role,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim(),
        expiresInDays: 7,
      });
      if (created.signingUrl)
        await navigator.clipboard
          .writeText(`${window.location.origin}${created.signingUrl}`)
          .catch(() => undefined);
    }, "Secure signing link created and copied. Email delivery remains queued for the later email phase.");
  };
  const openContract = async () => {
    try {
      const result = await api.leads.contractDownload(lead.id);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to open contract."),
        tone: "error",
      });
    }
  };
  const submitContractForReview = () => {
    if (!contract) return;
    return run(
      () =>
        api.leads.submitContractReview(lead.id, {
          notes,
          expectedVersion: lead.version,
        }),
      "Contract sent for review.",
    );
  };
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title={contract ? "Contract workspace" : "Current action"}
        subtitle={
          contract
            ? "Generate, review, and route the agreement with an auditable trail."
            : "Prepare the franchise agreement from the approved terms."
        }
      />
      <div className="process-card">
        {!contract && (
          <div className="contract-action-copy">
            <span className="eyebrow">PREPARE CONTRACT</span>
            <h3>Prepare contract</h3>
            <p>Generate the agreement using the approved franchise terms.</p>
          </div>
        )}
        {contract && (
          <div className="contract-generated-summary">
            <div className="contract-generated-heading">
              <span className="contract-generated-icon">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <strong>Contract generated</strong>
                <small>
                  {contractTemplateLabel(contract.templateCode)} · Version {contract.version}
                </small>
              </div>
            </div>
            <span className="contract-generated-date">
              Generated {formatDate(contract.updatedAt)}
            </span>
            <div className="button-row">
              <button className="button button-secondary" onClick={openContract}>
                <FileText size={16} /> Open contract
              </button>
              {canEditDraft && (
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api.leads.generateContract(lead.id, {
                          templateCode: template,
                          version: "1",
                          expectedVersion: lead.version,
                        }),
                      "Contract regenerated.",
                    )
                  }
                >
                  Regenerate
                </button>
              )}
              {canEditDraft && (
                <button
                  className="button button-primary"
                  disabled={
                    busy ||
                    !["Draft", "RevisionRequested"].includes(contract.status)
                  }
                  onClick={submitContractForReview}
                >
                  Continue <ChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        )}
        {!contract && canEditDraft && (
          <div className="inline-form">
            <label>
              Contract template
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                {contractTemplateOptions.map((option) => (
                  <option value={option.code} key={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api.leads.generateContract(lead.id, {
                      templateCode: template,
                      version: "1",
                      expectedVersion: lead.version,
                    }),
                  contract ? "Contract regenerated." : "Contract generated.",
                )
              }
            >
              Generate contract <ChevronRight size={15} />
            </button>
          </div>
        )}
        {!canEditDraft && !contract && (
          <div className="read-only-note">
            <ShieldCheck size={16} /> Contract drafting is available to
            Marketing Admin after payment is confirmed.
          </div>
        )}
        {contract && (
          <>
            <div className="workflow-instructions">
              <strong>Contract workflow</strong>
              <span>
                1. Marketing Admin drafts the agreement and submits it for
                review.
              </span>
              <span>
                2. The General Manager completes the review checklist and
                approves or requests revisions.
              </span>
              <span>
                3. Marketing creates secure e-signing links for both parties.
              </span>
            </div>
            {canEditDraft && ["Draft", "RevisionRequested"].includes(contract.status) && (
              <div className="contract-supporting-documents">
                <div>
                  <strong>Required drafting documents</strong>
                  <span>Upload both files before submitting the agreement for GM review.</span>
                </div>
                <div className="contract-document-grid">
                  <div>
                    <span className="eyebrow">FLOOR PLAN</span>
                    <DocumentsPanel
                      lead={lead}
                      onNotice={onNotice}
                      embedded
                      fixedDocumentType="FLOOR_PLAN"
                      visibleTypes={["FLOOR_PLAN"]}
                    />
                  </div>
                  <div>
                    <span className="eyebrow">PERSPECTIVE</span>
                    <DocumentsPanel
                      lead={lead}
                      onNotice={onNotice}
                      embedded
                      fixedDocumentType="PERSPECTIVE"
                      visibleTypes={["PERSPECTIVE"]}
                    />
                  </div>
                </div>
              </div>
            )}
            {(canEditDraft || canReview) && (
              <label className="wide-label">
                Review notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={4000}
                  placeholder="Add context for the next reviewer"
                />
              </label>
            )}
            {canEditDraft && (
              <div className="button-row">
                <button
                  className="button button-secondary"
                  disabled={
                    busy ||
                    !["Draft", "RevisionRequested"].includes(contract.status)
                  }
                  onClick={submitContractForReview}
                >
                  Submit for review
                </button>
              </div>
            )}
            {checklist && (
              <div className="contract-checklist">
                <div className="checklist-summary">
                  <strong>Review checklist</strong>
                  <span>
                    {checklist.items.filter((item) => item.complete).length} of{" "}
                    {checklist.items.length} complete
                  </span>
                </div>
                {checklist.items.map((item) => (
                  <button
                    type="button"
                    className={`checklist-item ${item.complete ? "complete" : ""}`}
                    key={item.id}
                    onClick={() => canChecklist && toggleChecklist(item.id)}
                    disabled={!canChecklist || busy}
                  >
                    <span
                      className={`checkbox ${item.complete ? "checked" : ""}`}
                    >
                      {item.complete && <CheckCircle2 size={14} />}
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.required ? "Required" : "Optional"} · {item.code}
                      </small>
                    </span>
                  </button>
                ))}
                {canChecklist && (
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={saveChecklist}
                  >
                    Save review checklist
                  </button>
                )}
              </div>
            )}
            {canReview && (
              <div className="button-row">
                <button
                  className="button button-primary"
                  disabled={
                    busy ||
                    contract.status !== "InReview" ||
                    !checklist?.complete
                  }
                  onClick={() =>
                    run(
                      () =>
                        api.leads.approveContract(lead.id, {
                          notes: notes || "Approved",
                          expectedVersion: lead.version,
                        }),
                      "Contract approved.",
                    )
                  }
                >
                  Approve contract
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy || contract.status !== "InReview"}
                  onClick={() =>
                    run(
                      () =>
                        api.leads.requestRevision(lead.id, {
                          reason: notes || "Revision requested",
                          expectedVersion: lead.version,
                        }),
                      "Revision requested.",
                    )
                  }
                >
                  Request revision
                </button>
              </div>
            )}
            {canReview &&
              !checklist?.complete &&
              contract.status === "InReview" && (
                <div className="read-only-note">
                  <ShieldCheck size={16} /> Complete and save every required
                  review item before approving.
                </div>
              )}
            {canSign && contract.status === "Approved" && (
              <div className="signature-panel">
                <strong>Electronic signatures</strong>
                <p>
                  Create a single-use, expiring link for each signer. The raw
                  signature image is never retained.
                </p>
                <div className="signature-grid">
                  <label>
                    Franchisee signer
                    <input
                      value={franchiseeName}
                      onChange={(e) => setFranchiseeName(e.target.value)}
                      maxLength={160}
                      placeholder="Full name"
                    />
                    <input
                      type="email"
                      value={franchiseeEmail}
                      onChange={(e) => setFranchiseeEmail(e.target.value)}
                      placeholder="Email"
                    />
                    <button
                      className="button button-secondary"
                      disabled={busy || Boolean(contract.franchiseeSignerName)}
                      onClick={() =>
                        requestSignature(
                          "franchisee",
                          franchiseeName,
                          franchiseeEmail,
                        )
                      }
                    >
                      Create franchisee signing link
                    </button>
                  </label>
                  <label>
                    Dr. Care signer
                    <input
                      value={drCareName}
                      onChange={(e) => setDrCareName(e.target.value)}
                      maxLength={160}
                      placeholder="Full name"
                    />
                    <input
                      type="email"
                      value={drCareEmail}
                      onChange={(e) => setDrCareEmail(e.target.value)}
                      placeholder="Email"
                    />
                    <button
                      className="button button-secondary"
                      disabled={busy || Boolean(contract.drCareSignerName)}
                      onClick={() =>
                        requestSignature("dr-care", drCareName, drCareEmail)
                      }
                    >
                      Create Dr. Care signing link
                    </button>
                  </label>
                </div>
                {signingRequests.length > 0 && (
                  <div className="action-list">
                    {signingRequests.map((item) => (
                      <div className="read-only-note" key={item.id}>
                        <ShieldCheck size={16} /> {item.signerRole}:{" "}
                        {item.signerName} — {item.status}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {contract.status === "Signed" && (
              <div className="read-only-note">
                <CheckCircle2 size={16} /> Both parties have signed. The
                pre-launch checklist can now be started.
              </div>
            )}
            {!canDraft && !canReview && !canSign && (
              <div className="read-only-note">
                <ShieldCheck size={16} /> This contract is view-only for your
                role.
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PreLaunchPanel({
  lead,
  onReload,
  onNotice,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [checklist, setChecklist] = useState<{
    status: string;
    items: {
      id: string;
      code: string;
      name: string;
      required: boolean;
      complete: boolean;
      paused: boolean;
      notes?: string;
    }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [nurseOrDoctorAvailable, setNurseOrDoctorAvailable] = useState(false);
  const canComplete = hasRole(session.user?.role, marketingWriteRoles);
  const reload = () =>
    api.leads
      .preLaunch(lead.id)
      .then((value) => setChecklist(value as typeof checklist))
      .catch(() => setChecklist(null));
  useEffect(() => {
    void reload();
  }, [lead.id]);
  const initialize = async () => {
    setBusy(true);
    try {
      await api.leads.initializePreLaunch(lead.id, nurseOrDoctorAvailable);
      onNotice({
        message: "Product-specific checklist initialized.",
        tone: "success",
      });
      await reload();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to initialize checklist."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (item: { id: string; complete: boolean }) => {
    try {
      await api.leads.updatePreLaunchItem(lead.id, item.id, {
        complete: !item.complete,
      });
      await reload();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to update checklist item."),
        tone: "error",
      });
    }
  };
  const complete = async () => {
    setBusy(true);
    try {
      await api.leads.completePreLaunch(lead.id, {
        expectedVersion: lead.version,
      });
      onNotice({ message: "Pre-launch marked complete.", tone: "success" });
      await reload();
      await onReload();
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Pre-launch is not ready to complete."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
    <section className="panel tab-panel">
      <PanelHeader
        title="Pre-launch readiness"
        subtitle="ABC checklists include the required animal-bite training item."
      />
      {!checklist ? (
        canComplete ? (
          <div className="empty-feature">
            <div className="empty-feature-icon">
              <ClipboardCheck size={25} />
            </div>
            <h2>Start the readiness checklist</h2>
            <p>
              Initialize the checklist to load the product-specific launch
              requirements.
            </p>
            {(lead.productLine === "Abc" || lead.productLine === "Combo") && (
              <label className="signature-consent">
                <input
                  type="checkbox"
                  checked={nurseOrDoctorAvailable}
                  onChange={(e) => setNurseOrDoctorAvailable(e.target.checked)}
                />{" "}
                A nurse or doctor is available for animal-bite training.
              </label>
            )}
            <button
              className="button button-primary"
              onClick={initialize}
              disabled={busy}
            >
              Initialize checklist
            </button>
          </div>
        ) : (
          <div className="read-only-note">
            <ShieldCheck size={16} /> The readiness checklist has not been
            initialized.
          </div>
        )
      ) : (
        <div className="checklist">
          <div className="checklist-summary">
            <StatusPill
              state={
                checklist.status.toUpperCase() === "COMPLETED"
                  ? "Qualified"
                  : "PreLaunch"
              }
              label={checklist.status}
            />
            <span>
              {checklist.items.filter((item) => item.complete).length} of{" "}
              {checklist.items.length} complete
            </span>
          </div>
          {checklist.items.map((item) =>
            canComplete && checklist.status.toUpperCase() !== "COMPLETED" ? (
              <button
                className={`checklist-item ${item.complete ? "complete" : ""} ${item.paused ? "paused" : ""}`}
                key={item.id}
                onClick={() => toggle(item)}
                disabled={item.paused}
              >
                <span className={`checkbox ${item.complete ? "checked" : ""}`}>
                  {item.complete && <CheckCircle2 size={14} />}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.paused
                      ? "Paused — nurse or doctor unavailable"
                      : item.required
                        ? "Required"
                        : "Optional"}{" "}
                    · {item.code}
                  </small>
                </span>
              </button>
            ) : (
              <div
                className={`checklist-item ${item.complete ? "complete" : ""}`}
                key={item.id}
              >
                <span className={`checkbox ${item.complete ? "checked" : ""}`}>
                  {item.complete && <CheckCircle2 size={14} />}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.required ? "Required" : "Optional"} · {item.code}
                  </small>
                </span>
              </div>
            ),
          )}
          {canComplete && checklist.status.toUpperCase() !== "COMPLETED" ? (
            <button
              className="button button-primary"
              onClick={complete}
              disabled={
                busy ||
                checklist.items.some((item) => item.required && !item.complete)
              }
            >
              Complete pre-launch
            </button>
          ) : checklist.status.toUpperCase() === "COMPLETED" ? (
            <div className="completion-card">
              <CheckCircle2 size={19} />
              <div>
                <strong>Pre-launch completed</strong>
                <span>
                  This finished checklist is read-only and ready for
                  endorsement.
                </span>
              </div>
            </div>
          ) : (
            <div className="read-only-note">
              <ShieldCheck size={16} /> Checklist is view-only for your role.
            </div>
          )}
        </div>
      )}
    </section>
    {checklist?.status.toUpperCase() === "COMPLETED" && canComplete && (
      <EndorsementPanel lead={lead} onReload={onReload} onNotice={onNotice} />
    )}
    </>
  );
}

function EndorsementPanel({
  lead,
  onReload,
  onNotice,
}: {
  lead: Lead;
  onReload: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [endorsement, setEndorsement] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    api.leads
      .endorsement(lead.id)
      .then((value) => setEndorsement(value as Record<string, unknown>))
      .catch(() => setEndorsement(null));
  }, [lead.id]);
  const create = async () => {
    try {
      const value = await api.leads.createEndorsement(lead.id, {
        receivingTeam: "Admin Team",
        handoffNotes: notes,
        expectedVersion: lead.version,
      });
      setEndorsement(value as Record<string, unknown>);
      await onReload();
      onNotice({ message: "Handoff created.", tone: "success" });
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to create handoff."),
        tone: "error",
      });
    }
  };
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title="Handoff"
        subtitle="Route a completed opportunity to the receiving team with context."
      />
      {endorsement ? (
        <div className="process-card">
          <div className="snapshot-grid">
            <Info
              label="Receiving team"
              value={String(endorsement.receivingTeam)}
            />
            <Info label="Status" value={String(endorsement.status)} />
            <Info
              label="Created"
              value={formatDate(String(endorsement.createdAt))}
            />
          </div>
          <p className="callout">{String(endorsement.handoffNotes)}</p>
        </div>
      ) : (
        <div className="form-grid">
          <Info label="Receiving team" value="Admin Team" />
          <label className="wide-label">
            Handoff notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
              required
            />
          </label>
          <button
            className="button button-primary"
            onClick={create}
            disabled={!notes.trim()}
          >
            Create handoff
          </button>
        </div>
      )}
    </section>
  );
}

function AdminEndorsementPanel({
  lead,
  onNotice,
}: {
  lead: Lead;
  onNotice: (notice: Notice) => void;
}) {
  const [item, setItem] = useState<{
    id: string;
    receivingTeam: string;
    status: string;
    handoffNotes: string;
    createdAt: string;
    items?: {
      code: string;
      name: string;
      completedByMarketing: boolean;
      adminActionRequired: boolean;
      notes?: string;
    }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api.leads
      .endorsement(lead.id)
      .then((value) => setItem(value as typeof item))
      .catch(() => setItem(null));
  useEffect(() => {
    void load();
  }, [lead.id]);
  const acknowledge = async () => {
    if (!item) return;
    setBusy(true);
    try {
      const value = await api.endorsements.acknowledge(item.id);
      setItem(value as typeof item);
      onNotice({ message: "Endorsement acknowledged.", tone: "success" });
    } catch (e) {
      onNotice({
        message: errorMessage(e, "Unable to acknowledge endorsement."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  if (!item)
    return (
      <section className="panel tab-panel">
        <EmptyState
          icon={ClipboardCheck}
          title="No endorsement available"
          text="Marketing must complete pre-launch and create the handoff record first."
        />
      </section>
    );
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title="Receive endorsement"
        subtitle="Review the exact boundary between completed Marketing work and remaining Admin work."
      />
      <div className="snapshot-grid">
        <Info label="Receiving team" value={item.receivingTeam} />
        <Info label="Status" value={item.status} />
        <Info label="Created" value={formatDate(item.createdAt)} />
      </div>
      <p className="callout">{item.handoffNotes}</p>
      <div className="checklist">
        {item.items?.map((boundary) => (
          <div
            className={`checklist-item ${boundary.completedByMarketing ? "complete" : ""}`}
            key={boundary.code}
          >
            <span
              className={`checkbox ${boundary.completedByMarketing ? "checked" : ""}`}
            >
              {boundary.completedByMarketing && <CheckCircle2 size={14} />}
            </span>
            <span>
              <strong>{boundary.name}</strong>
              <small>
                {boundary.adminActionRequired
                  ? "Admin action required"
                  : "Completed by Marketing"}
              </small>
            </span>
          </div>
        ))}
      </div>
      {item.status === "Pending" ? (
        <button
          className="button button-primary"
          disabled={busy}
          onClick={acknowledge}
        >
          Acknowledge handoff
        </button>
      ) : (
        <div className="completion-card">
          <CheckCircle2 size={19} />
          <div>
            <strong>Handoff acknowledged</strong>
            <span>The Admin team now owns the downstream process.</span>
          </div>
        </div>
      )}
    </section>
  );
}

function AuditPanel({ leadId }: { leadId: string }) {
  const [logs, setLogs] = useState<
    { id: string; leadId?: string; action: string; createdAt: string }[]
  >([]);
  useEffect(() => {
    api.audit
      .list()
      .then((value) =>
        setLogs(
          (value as typeof logs).filter((item) => item.leadId === leadId),
        ),
      )
      .catch(() => undefined);
  }, [leadId]);
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title="Audit trail"
        subtitle="Workflow changes are retained for traceability."
      />
      {logs.length ? (
        <div className="timeline">
          {logs.map((log) => (
            <div className="timeline-item" key={log.id}>
              <div className="timeline-icon">
                <ShieldCheck size={15} />
              </div>
              <div>
                <strong>{log.action}</strong>
                <span>{formatDate(log.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="No audit events for this lead"
          text="New workflow changes will appear here."
        />
      )}
    </section>
  );
}

function Tasks({ user }: { user: NonNullable<typeof session.user> }) {
  if (!hasRole(user.role, taskReadRoles))
    return <Navigate to="/" replace />;
  return <TasksContent user={user} />;
}

function TasksContent({
  user,
}: {
  user: NonNullable<typeof session.user>;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<"todo" | "completed">("todo");
  const [notice, setNotice] = useState<Notice | null>(null);
  const canManageTasks = hasRole(user.role, marketingWriteRoles);
  const load = async () => {
    try {
      const [nextTasks, nextLeads] = await Promise.all([
        api.tasks.list(),
        api.leads.list("?limit=100&sort=updatedAt"),
      ]);
      setTasks(nextTasks);
      setLeads(nextLeads.items);
    } catch (e) {
      setNotice({
        message: errorMessage(e, "Unable to load tasks."),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const complete = async (task: Task) => {
    try {
      await api.tasks.complete(task.id, {});
      await load();
      setNotice({ message: "Task completed.", tone: "success" });
    } catch (e) {
      setNotice({
        message: errorMessage(e, "Unable to complete task."),
        tone: "error",
      });
    }
  };
  const create = async (payload: unknown) => {
    try {
      await api.tasks.create(payload);
      setCreateOpen(false);
      await load();
      setNotice({ message: "Task created.", tone: "success" });
    } catch (e) {
      setNotice({
        message: errorMessage(e, "Unable to create task."),
        tone: "error",
      });
    }
  };
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const openTasks = tasks.filter((task) => task.status === "Open");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const overdueTasks = openTasks.filter(
    (task) => taskDueState(task) === "overdue",
  );
  const dueTodayTasks = openTasks.filter(
    (task) => taskDueState(task) === "today",
  );
  const upcomingTasks = openTasks.filter(
    (task) => taskDueState(task) === "upcoming",
  );
  const unscheduledTasks = openTasks.filter(
    (task) => taskDueState(task) === "unscheduled",
  );
  const ordered = (items: Task[]) =>
    [...items].sort(
      (a, b) =>
        (a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER) -
        (b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER),
    );
  return (
    <Page
      title="My work queue"
      subtitle="Everything assigned to you that needs attention."
      actions={
        canManageTasks ? (
          <button
            className="button button-secondary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} /> Add task
          </button>
        ) : undefined
      }
    >
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      <div className="queue-summary">
        <div className="queue-summary-primary">
          <span>Due today</span>
          <strong>{dueTodayTasks.length}</strong>
        </div>
        <div
          className={
            overdueTasks.length
              ? "queue-summary-primary is-overdue"
              : "queue-summary-primary"
          }
        >
          <span>Overdue</span>
          <strong>{overdueTasks.length}</strong>
        </div>
        <div className="queue-summary-primary">
          <span>Upcoming</span>
          <strong>{upcomingTasks.length}</strong>
        </div>
        <div className="queue-summary-secondary">
          <span>Open {openTasks.length}</span>
          <span>Completed {completedTasks.length}</span>
        </div>
      </div>
      <div className="queue-view-tabs" role="tablist" aria-label="Task status">
        <button
          role="tab"
          aria-selected={view === "todo"}
          className={view === "todo" ? "active" : ""}
          onClick={() => setView("todo")}
        >
          To do <span>{openTasks.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={view === "completed"}
          className={view === "completed" ? "active" : ""}
          onClick={() => setView("completed")}
        >
          Completed <span>{completedTasks.length}</span>
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : view === "completed" ? (
        <section className="panel task-queue-panel">
          <PanelHeader
            title="Completed recently"
            subtitle="A record of work already finished."
          />
          {completedTasks.length ? (
            <div className="task-queue-list">
              {ordered(completedTasks).map((task) => (
                <TaskQueueCard
                  key={task.id}
                  task={task}
                  lead={leadById.get(task.leadId)}
                  canManage={false}
                  currentUserId={user.id}
                  onComplete={complete}
                  completed
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="No completed tasks"
              text="Completed work will appear here after an action is finished."
            />
          )}
        </section>
      ) : (
        <div className="task-queue-groups">
          {overdueTasks.length > 0 && (
            <TaskQueueGroup
              title="Overdue"
              hint="These actions need attention first."
              tasks={ordered(overdueTasks)}
              leadById={leadById}
              canManage={canManageTasks}
              currentUserId={user.id}
              onComplete={complete}
              tone="overdue"
            />
          )}
          {
            <TaskQueueGroup
              title="Today"
              hint="The work that should move forward today."
              tasks={ordered(dueTodayTasks)}
              leadById={leadById}
              canManage={canManageTasks}
              currentUserId={user.id}
              onComplete={complete}
            />
          }
          {
            <TaskQueueGroup
              title="Upcoming"
              hint="Scheduled work coming next."
              tasks={ordered(upcomingTasks)}
              leadById={leadById}
              canManage={canManageTasks}
              currentUserId={user.id}
              onComplete={complete}
            />
          }
          {
            <TaskQueueGroup
              title="Needs scheduling"
              hint="Open tasks without a due date."
              tasks={ordered(unscheduledTasks)}
              leadById={leadById}
              canManage={canManageTasks}
              currentUserId={user.id}
              onComplete={complete}
            />
          }
        </div>
      )}
      {createOpen && (
        <Modal
          title="Add task"
          subtitle="Give the work a clear outcome and due date."
          onClose={() => setCreateOpen(false)}
        >
          <TaskForm onSubmit={create} submitLabel="Add task" />
        </Modal>
      )}
    </Page>
  );
}

function TaskQueueGroup({
  title,
  hint,
  tasks,
  leadById,
  canManage,
  currentUserId,
  onComplete,
  tone,
}: {
  title: string;
  hint: string;
  tasks: Task[];
  leadById: Map<string, Lead>;
  canManage: boolean;
  currentUserId: string;
  onComplete: (task: Task) => void;
  tone?: string;
}) {
  if (!tasks.length && title !== "Today") return null;
  return (
    <section className={`panel task-queue-panel ${tone ?? ""}`}>
      <PanelHeader title={title} subtitle={hint} />
      {tasks.length ? (
        <div className="task-queue-list">
          {tasks.map((task) => (
            <TaskQueueCard
              key={task.id}
              task={task}
              lead={leadById.get(task.leadId)}
              canManage={canManage}
              currentUserId={currentUserId}
              onComplete={onComplete}
            />
          ))}
        </div>
      ) : (
        <div className="task-queue-empty">You're all caught up.</div>
      )}
    </section>
  );
}

function TaskQueueCard({
  task,
  lead,
  canManage,
  currentUserId,
  onComplete,
  completed = false,
}: {
  task: Task;
  lead?: Lead;
  canManage: boolean;
  currentUserId: string;
  onComplete: (task: Task) => void;
  completed?: boolean;
}) {
  const tab = taskWorkflowTab(task, lead);
  const dueState = taskDueState(task);
  const workflow = lead ? nextStepForLead(lead) : null;
  const reason = taskReason(task, lead);
  return (
    <article
      className={`task-queue-card ${completed ? "completed" : ""} ${dueState}`}
    >
      <div className="task-queue-status">
        {completed ? (
          <span className="checkbox checked" aria-label="Completed">
            <CheckCircle2 size={14} />
          </span>
        ) : canManage ? (
          <button
            className="checkbox"
            onClick={() => onComplete(task)}
            aria-label={`Complete ${task.title}`}
          />
        ) : (
          <span className="checkbox" aria-hidden="true" />
        )}
      </div>
      <div className="task-queue-body">
        <strong>{task.title}</strong>
        {lead ? (
          <NavLink to={`/leads/${lead.id}`} className="task-queue-lead">
            {lead.fullName} · {pipelineStageLabel(lead.state)}
          </NavLink>
        ) : (
          <span className="task-queue-lead">Franchise opportunity</span>
        )}
        <p>{reason}</p>
        <div className="task-queue-meta">
          <span
            className={!completed && dueState === "overdue" ? "overdue" : ""}
          >
            {completed ? "Completed" : taskDueLabel(task)}
          </span>
          <span>
            Assigned to{" "}
            {task.assignedTo === currentUserId
              ? "you"
              : task.assignedTo.slice(0, 8)}
          </span>
        </div>
      </div>
      {!completed && lead && (
        <NavLink
          to={`/leads/${lead.id}?tab=${encodeURIComponent(tab)}`}
          className="button button-secondary task-queue-action"
        >
          {workflow?.label ?? "Open workflow"} <ChevronRight size={15} />
        </NavLink>
      )}
    </article>
  );
}

function taskDueState(
  task: Task,
): "overdue" | "today" | "upcoming" | "unscheduled" {
  if (!task.dueAt) return "unscheduled";
  const due = new Date(task.dueAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (due < now) return "overdue";
  if (dueDay.getTime() === today.getTime()) return "today";
  return "upcoming";
}
function taskDueLabel(task: Task) {
  if (!task.dueAt) return "No due date";
  const state = taskDueState(task);
  const date = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(task.dueAt));
  return state === "overdue"
    ? `Overdue · ${date}`
    : state === "today"
      ? `Due today · ${date.split(", ").pop()}`
      : `Due ${date}`;
}
function taskWorkflowTab(task: Task, lead?: Lead) {
  const title = task.title.toLowerCase();
  if (title.includes("inquiry") || title.includes("information"))
    return "Workflow";
  if (title.includes("qualification") || title.includes("follow-up"))
    return "Workflow";
  if (title.includes("payment") || title.includes("finance")) return "Workflow";
  if (title.includes("contract") || title.includes("signature"))
    return "Workflow";
  if (title.includes("launch")) return "Workflow";
  return lead ? nextStepForLead(lead).tab : "Overview";
}
function taskReason(task: Task, lead?: Lead) {
  const title = task.title.toLowerCase();
  if (title.includes("missing inquiry"))
    return "Required inquiry information is still missing before the opportunity can progress.";
  if (title.includes("qualification") || title.includes("follow-up"))
    return "Follow up with the candidate before moving to the next workflow step.";
  if (title.includes("payment") || title.includes("finance"))
    return "Complete the finance step so the agreement can be prepared.";
  return lead
    ? `Continue the ${pipelineStageLabel(lead.state).toLowerCase()} workflow.`
    : "Complete the assigned action.";
}

function QueuePage(props: {
  title: string;
  subtitle: string;
  load: () => Promise<unknown[]>;
  empty: string;
}) {
  const allowed =
    props.title === "Finance queue"
      ? (["Finance", "Leadership"] as Role[])
      : ([
          "MarketingAgent",
          "MarketingAdmin",
          "GeneralManager",
          "Leadership",
        ] as Role[]);
  if (!hasRole(session.user?.role, allowed)) return <Navigate to="/" replace />;
  return <QueuePageContent {...props} workflowTab="Workflow" />;
}
function QueuePageContent({
  title,
  subtitle,
  load,
  empty,
  workflowTab,
}: {
  title: string;
  subtitle: string;
  load: () => Promise<unknown[]>;
  empty: string;
  workflowTab?: string;
}) {
  const [items, setItems] = useState<
    {
      leadId: string;
      fullName: string;
      state: LeadState;
      updatedAt: string;
      version: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    load()
      .then((result) => setItems(result as typeof items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [load]);
  return (
    <Page title={title} subtitle={subtitle}>
      <section className="panel queue-panel">
        <PanelHeader
          title="Waiting for action"
          subtitle="Every item has an owner and a next step."
        />
        {loading ? (
          <Loading />
        ) : (
          <div className="queue-list">
            {items.length ? (
              items.map((item) => (
                <NavLink
                  to={`/leads/${item.leadId}${workflowTab ? `?tab=${encodeURIComponent(workflowTab)}` : ""}`}
                  className="queue-item"
                  key={item.leadId}
                >
                  <div className="avatar">{initials(item.fullName)}</div>
                  <div>
                    <strong>{item.fullName}</strong>
                    <span>
                      {labelForState(item.state)} · Updated{" "}
                      {formatDate(item.updatedAt)}
                    </span>
                  </div>
                  <ChevronRight size={17} />
                </NavLink>
              ))
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title={empty}
                text="New items will appear here automatically."
              />
            )}
          </div>
        )}
      </section>
    </Page>
  );
}

function PreLaunchQueue() {
  if (session.user?.role === "AdminTeam") return <EndorsementsQueue />;
  if (
    !hasRole(session.user?.role, [
      "MarketingAgent",
      "MarketingAdmin",
      "Leadership",
    ])
  )
    return <Navigate to="/" replace />;
  return <PreLaunchQueueContent />;
}
function PreLaunchQueueContent() {
  const [items, setItems] = useState<Lead[]>([]);
  useEffect(() => {
    api.leads
      .list("?limit=100&sort=updatedAt")
      .then((result) =>
        setItems(
          result.items.filter((item) =>
            ["ContractSigned", "PreLaunch"].includes(item.state),
          ),
        ),
      )
      .catch(() => undefined);
  }, []);
  return (
    <Page
      title="Pre-launch readiness"
      subtitle="Turn an approved opportunity into a branch ready to open."
    >
      <section className="panel queue-panel">
        <PanelHeader
          title="Ready to prepare"
          subtitle="Product-specific checklists keep launch work visible."
        />
        {items.length ? (
          <div className="queue-list">
            {items.map((item) => (
              <NavLink
                to={`/leads/${item.id}`}
                className="queue-item"
                key={item.id}
              >
                <div className="avatar">{initials(item.fullName)}</div>
                <div>
                  <strong>{item.fullName}</strong>
                  <span>
                    {item.state === "ContractSigned" ? "Start checklist" : "Open checklist"} · Updated {formatDate(item.updatedAt)}
                  </span>
                </div>
                <ChevronRight size={17} />
              </NavLink>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="No pre-launch opportunities yet"
            text="Qualified opportunities will appear here when they reach readiness."
          />
        )}
      </section>
    </Page>
  );
}

function EndorsementsQueue() {
  const [items, setItems] = useState<
    {
      id: string;
      leadId: string;
      fullName: string;
      status: string;
      createdAt: string;
    }[]
  >([]);
  const [busy, setBusy] = useState<string | null>(null);
  const canAcknowledge = session.user?.role === "AdminTeam";
  const load = () =>
    Promise.all([api.endorsements.list(), api.queues.admin()])
      .then(([endorsements, queue]) => {
        const names = new Map(
          (queue as { leadId: string; fullName: string }[]).map((item) => [
            item.leadId,
            item.fullName,
          ]),
        );
        setItems(
          (
            endorsements as {
              id: string;
              leadId: string;
              status: string;
              createdAt: string;
            }[]
          )
            .filter((item) => item.status === "Pending")
            .map((item) => ({
              ...item,
              fullName: names.get(item.leadId) ?? "Endorsed franchisee",
            })),
        );
      })
      .catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);
  const acknowledge = async (id: string) => {
    setBusy(id);
    try {
      await api.endorsements.acknowledge(id);
      await load();
    } finally {
      setBusy(null);
    }
  };
  return (
    <Page
      title="Handoff queue"
      subtitle="Receive completed franchise opportunities and confirm ownership."
    >
      <section className="panel queue-panel">
        <PanelHeader
          title="Pending endorsements"
          subtitle={
            canAcknowledge
              ? "Review the handoff context, then acknowledge receipt."
              : "View-only endorsement activity for leadership."
          }
        />
        {items.length ? (
          <div className="queue-list">
            {items.map((item) => (
              <div className="queue-item" key={item.id}>
                <div className="avatar">
                  <ClipboardCheck size={15} />
                </div>
                <div>
                  <strong>{item.fullName}</strong>
                  <span>Endorsed · {formatDate(item.createdAt)}</span>
                </div>
                {canAcknowledge ? (
                  <button
                    className="button button-secondary"
                    onClick={() => acknowledge(item.id)}
                    disabled={busy === item.id}
                  >
                    {busy === item.id ? "Acknowledging…" : "Acknowledge"}
                  </button>
                ) : (
                  <span className="muted">View only</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="No pending endorsements"
            text="Completed opportunities will appear here when they are handed off."
          />
        )}
      </section>
    </Page>
  );
}

function Reports() {
  if (
    !hasRole(session.user?.role, [
      "MarketingAdmin",
      "GeneralManager",
      "Finance",
      "Leadership",
    ])
  )
    return <Navigate to="/" replace />;
  return <ReportsContent />;
}
function ReportsContent() {
  const [report, setReport] = useState<{
    totalLeads: number;
    byState: Record<string, number>;
    confirmedDownPayments: number;
  } | null>(null);
  const [conversion, setConversion] = useState<Record<string, number>>({});
  const [goal, setGoal] = useState<{
    year: number;
    target: number;
    achieved: number;
    completionPercentage: number;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    {
      agentId: string;
      agentName: string;
      leads: number;
      qualified: number;
      endorsed: number;
    }[]
  >([]);
  const [payments, setPayments] = useState<{
    totalInvoiced: number;
    totalConfirmed: number;
    pendingCount: number;
  } | null>(null);
  useEffect(() => {
    if (session.user?.role === "Finance") {
      api.reports
        .downPayments()
        .then((value) => setPayments(value as typeof payments))
        .catch(() => undefined);
      return;
    }
    Promise.all([
      api.reports.overview(),
      api.reports.conversion(),
      api.reports.goals(),
      api.reports.leaderboard(),
      api.reports.downPayments(),
    ])
      .then(
        ([
          overview,
          conversionResult,
          goalResult,
          leaderboardResult,
          paymentResult,
        ]) => {
          setReport(overview as typeof report);
          setConversion(
            (conversionResult as { rates: Record<string, number> }).rates,
          );
          setGoal(goalResult as typeof goal);
          setLeaderboard(leaderboardResult as typeof leaderboard);
          setPayments(paymentResult as typeof payments);
        },
      )
      .catch(() => undefined);
  }, []);
  if (session.user?.role === "Finance")
    return (
      <Page
        title="Finance reports"
        subtitle="Down-payment invoicing and confirmation status."
      >
        <section className="metric-grid report-metrics">
          <Metric
            label="Total invoiced"
            value={
              payments ? `₱${payments.totalInvoiced.toLocaleString()}` : "—"
            }
            hint="Issued invoices"
            icon={FileText}
            tone="blue"
          />
          <Metric
            label="Total confirmed"
            value={
              payments ? `₱${payments.totalConfirmed.toLocaleString()}` : "—"
            }
            hint="Verified receipts"
            icon={WalletCards}
            tone="green"
          />
          <Metric
            label="Waiting for confirmation"
            value={payments ? String(payments.pendingCount) : "—"}
            hint="Finance queue"
            icon={Clock3}
            tone="amber"
          />
        </section>
      </Page>
    );
  return (
    <Page
      title="Reports"
      subtitle="A grounded view of growth, conversion, and readiness."
    >
      <section className="metric-grid report-metrics">
        <Metric
          label="Total leads"
          value={report ? String(report.totalLeads) : "—"}
          hint="Current workspace"
          icon={UsersRound}
          tone="red"
        />
        <Metric
          label="Confirmed payments"
          value={
            report ? `₱${report.confirmedDownPayments.toLocaleString()}` : "—"
          }
          hint="Finance confirmed"
          icon={WalletCards}
          tone="green"
        />
        <Metric
          label="Pipeline stages"
          value={report ? String(Object.keys(report.byState).length) : "—"}
          hint="Active states"
          icon={Activity}
          tone="blue"
        />
      </section>
      <section className="panel report-panel">
        <PanelHeader
          title="Pipeline distribution"
          subtitle="Use reports to spot friction before it becomes a bottleneck."
        />
        {report ? (
          Object.entries(report.byState).map(([state, count]) => (
            <div className="report-row" key={state}>
              <span>{labelForState(state as LeadState)}</span>
              <div className="report-track">
                <i
                  style={{
                    width: `${Math.max(6, (count / Math.max(1, report.totalLeads)) * 100)}%`,
                  }}
                />
              </div>
              <strong>{count}</strong>
            </div>
          ))
        ) : (
          <Loading />
        )}
      </section>
      <div className="detail-grid">
        <section className="panel report-panel">
          <PanelHeader
            title="Stage conversion"
            subtitle="Percentage of created leads that reached each milestone."
          />
          {Object.entries(conversion).map(([state, rate]) => (
            <div className="report-row" key={state}>
              <span>{labelForState(state as LeadState)}</span>
              <div className="report-track">
                <i style={{ width: `${Math.max(2, rate)}%` }} />
              </div>
              <strong>{rate}%</strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <PanelHeader
            title={`${goal?.year ?? new Date().getFullYear()} annual goal`}
            subtitle="Endorsed franchisees against the configured annual target."
          />
          <div className="metric-grid report-metrics">
            <Metric
              label="Target"
              value={goal ? String(goal.target) : "—"}
              hint="Annual target"
              icon={Activity}
              tone="blue"
            />
            <Metric
              label="Endorsed"
              value={goal ? String(goal.achieved) : "—"}
              hint="Completed handoffs"
              icon={CheckCircle2}
              tone="green"
            />
            <Metric
              label="Progress"
              value={goal ? `${goal.completionPercentage}%` : "—"}
              hint="Goal completion"
              icon={Sparkles}
              tone="red"
            />
          </div>
        </section>
        <section className="panel">
          <PanelHeader
            title="Agent leaderboard"
            subtitle="Assigned pipeline, qualified opportunities, and completed endorsements."
          />
          <div className="lead-table">
            {leaderboard.map((item) => (
              <div className="lead-table-row" key={item.agentId}>
                <strong>{item.agentName}</strong>
                <span>{item.leads} leads</span>
                <span>{item.qualified} qualified</span>
                <span>{item.endorsed} endorsed</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelHeader
            title="Down-payment status"
            subtitle="Invoice and Finance confirmation totals."
          />
          <div className="snapshot-grid">
            <Info
              label="Invoiced"
              value={
                payments ? `₱${payments.totalInvoiced.toLocaleString()}` : "—"
              }
            />
            <Info
              label="Confirmed"
              value={
                payments ? `₱${payments.totalConfirmed.toLocaleString()}` : "—"
              }
            />
            <Info
              label="Pending confirmation"
              value={payments ? String(payments.pendingCount) : "—"}
            />
          </div>
        </section>
      </div>
    </Page>
  );
}

function SettingsPage() {
  if (!hasRole(session.user?.role, ["MarketingAdmin", "Leadership"]))
    return <Navigate to="/" replace />;
  return <SettingsContent />;
}
function SettingsContent() {
  const [pricing, setPricing] = useState<{
    abcPrice: number;
    pharmacyPrice: number;
    comboPrice: number;
    currency: string;
  } | null>(null);
  const [annualGoal, setAnnualGoal] = useState<{
    year: number;
    target: number;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    Promise.all([api.settings.pricing(), api.settings.annualGoal()])
      .then(([value, goalValue]) => {
        setPricing(value as typeof pricing);
        setAnnualGoal(goalValue as typeof annualGoal);
      })
      .catch((e) =>
        setNotice({
          message: errorMessage(e, "Unable to load pricing."),
          tone: "error",
        }),
      );
  }, []);
  const canEditSettings = session.user?.role === "MarketingAdmin";
  const save = async (payload: unknown) => {
    try {
      const value = await api.settings.updatePricing(payload);
      setPricing(value as typeof pricing);
      setEditing(false);
      setNotice({ message: "Pricing configuration saved.", tone: "success" });
    } catch (e) {
      setNotice({
        message: errorMessage(e, "Unable to save pricing."),
        tone: "error",
      });
    }
  };
  return (
    <Page
      title="Administration"
      subtitle="Shape the operating rules without changing the product experience."
    >
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      <div className="settings-layout">
        <section className="panel">
          <PanelHeader
            title="Pricing configuration"
            subtitle="Current franchise package pricing."
          />
          {pricing && (
            <div className="settings-list">
              <Info
                label="ABC package"
                value={`₱${pricing.abcPrice.toLocaleString()}`}
              />
              <Info
                label="Pharmacy package"
                value={`₱${pricing.pharmacyPrice.toLocaleString()}`}
              />
              <Info
                label="Combo package"
                value={`₱${pricing.comboPrice.toLocaleString()}`}
              />
              <Info label="Currency" value={pricing.currency} />
            </div>
          )}
          {canEditSettings && (
            <button
              className="button button-secondary"
              onClick={() => setEditing(true)}
            >
              Edit pricing <ArrowUpRight size={15} />
            </button>
          )}
        </section>
        <section className="panel">
          <PanelHeader
            title="Annual endorsement target"
            subtitle="Used by leadership goal reporting."
          />
          {annualGoal && (
            <div className="inline-form">
              <label>
                {annualGoal.year} target
                <input
                  type="number"
                  min="1"
                  value={annualGoal.target}
                  disabled={!canEditSettings}
                  onChange={(e) =>
                    setAnnualGoal({
                      ...annualGoal,
                      target: Number(e.target.value),
                    })
                  }
                />
              </label>
              {canEditSettings && (
                <button
                  className="button button-secondary"
                  onClick={async () => {
                    try {
                      const value = await api.settings.updateAnnualGoal({
                        target: annualGoal.target,
                      });
                      setAnnualGoal(value as typeof annualGoal);
                      setNotice({
                        message: "Annual goal saved.",
                        tone: "success",
                      });
                    } catch (e) {
                      setNotice({
                        message: errorMessage(e, "Unable to save annual goal."),
                        tone: "error",
                      });
                    }
                  }}
                >
                  Save target
                </button>
              )}
            </div>
          )}
        </section>
        <section className="panel">
          <PanelHeader title="Access and safety" />
          <div className="safety-list">
            <div>
              <ShieldCheck size={18} />
              <span>
                <strong>Role-aware workspaces</strong>
                <small>
                  Each action is controlled by the API permission model.
                </small>
              </span>
            </div>
            <div>
              <Archive size={18} />
              <span>
                <strong>Private documents</strong>
                <small>Files use short-lived private storage links.</small>
              </span>
            </div>
            <div>
              <ListChecks size={18} />
              <span>
                <strong>Auditable changes</strong>
                <small>
                  Workflow actions remain visible to authorized teams.
                </small>
              </span>
            </div>
          </div>
        </section>
      </div>
      {editing && pricing && canEditSettings && (
        <Modal
          title="Edit pricing"
          subtitle="Changes are validated and audited by the API."
          onClose={() => setEditing(false)}
        >
          <PricingForm pricing={pricing} onSubmit={save} />
        </Modal>
      )}
    </Page>
  );
}

function LeadForm({
  onSubmit,
  submitLabel,
}: {
  onSubmit: (payload: unknown) => Promise<void>;
  submitLabel: string;
}) {
  const [form, setForm] = useState({
    fullName: "",
    contactNumber: "",
    email: "",
    sourceOfIncome: "",
    leadSource: "Manual",
    productLine: "",
    assignedAgentId: "",
  });
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [agents, setAgents] = useState<
    { id: string; displayName: string; role: string; isActive: boolean }[]
  >([]);
  useEffect(() => {
    if (hasRole(session.user?.role, ["MarketingAdmin", "GeneralManager"]))
      api.users
        .list()
        .then((items) =>
          setAgents(
            (items as typeof agents).filter(
              (item) => item.role === "MarketingAgent" && item.isActive,
            ),
          ),
        )
        .catch(() => undefined);
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    const assignmentRequired = hasRole(session.user?.role, [
      "MarketingAdmin",
      "GeneralManager",
    ]);
    if (!form.fullName.trim() || (assignmentRequired && !form.assignedAgentId))
      return;
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        productLine: form.productLine || null,
        assignedAgentId: form.assignedAgentId || null,
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form-grid" onSubmit={submit} noValidate>
      {attempted &&
      (!form.fullName.trim() ||
        (hasRole(session.user?.role, ["MarketingAdmin", "GeneralManager"]) &&
          !form.assignedAgentId)) ? (
        <div className="missing-fields-summary form-wide" role="alert">
          <strong>Please complete</strong>
          <span>
            {[
              !form.fullName.trim() ? "Full name" : null,
              hasRole(session.user?.role, [
                "MarketingAdmin",
                "GeneralManager",
              ]) && !form.assignedAgentId
                ? "Assigned agent"
                : null,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      ) : null}
      <label>
        <span>
          Full name <span className="required-mark">*</span>
        </span>
        <input
          required
          minLength={2}
          maxLength={160}
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          aria-invalid={attempted && !form.fullName.trim()}
          className={
            attempted && !form.fullName.trim() ? "field-missing" : undefined
          }
        />
        {attempted && !form.fullName.trim() ? (
          <small className="field-error">Full name is required.</small>
        ) : null}
      </label>
      <label>
        Contact number
        <input
          value={form.contactNumber}
          onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label>
        Source of income
        <input
          value={form.sourceOfIncome}
          onChange={(e) => setForm({ ...form, sourceOfIncome: e.target.value })}
        />
      </label>
      <label>
        Lead source
        <select
          required
          value={form.leadSource}
          onChange={(e) => setForm({ ...form, leadSource: e.target.value })}
        >
          <option>Manual</option>
          <option>Campaign</option>
          <option>Social media</option>
          <option>Lead form</option>
          <option>Referral</option>
        </select>
      </label>
      <label>
        Product line
        <select
          value={form.productLine}
          onChange={(e) => setForm({ ...form, productLine: e.target.value })}
        >
          <option value="">Choose later</option>
          <option value="Abc">Animal Bite Center</option>
          <option value="Pharmacy">Pharmacy</option>
          <option value="Combo">ABC + Pharmacy</option>
        </select>
      </label>
      {hasRole(session.user?.role, ["MarketingAdmin", "GeneralManager"]) && (
        <label>
          <span>
            Assigned agent <span className="required-mark">*</span>
          </span>
          <select
            required
            value={form.assignedAgentId}
            onChange={(e) =>
              setForm({ ...form, assignedAgentId: e.target.value })
            }
            aria-invalid={attempted && !form.assignedAgentId}
            className={
              attempted && !form.assignedAgentId ? "field-missing" : undefined
            }
          >
            <option value="">Select agent</option>
            {agents.map((agent) => (
              <option value={agent.id} key={agent.id}>
                {agent.displayName}
              </option>
            ))}
          </select>
          {attempted && !form.assignedAgentId ? (
            <small className="field-error">Choose the responsible agent.</small>
          ) : null}
        </label>
      )}
      <div className="form-actions">
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
function ActivityForm({
  onSubmit,
  submitLabel,
  initialType = "CALL",
}: {
  onSubmit: (payload: unknown) => Promise<void>;
  submitLabel: string;
  initialType?: string;
}) {
  const [type, setType] = useState(initialType);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!notes.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        activityType: type,
        notes,
        occurredAt: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="stack-form" onSubmit={submit} noValidate>
      <label>
        Activity type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>CALL</option>
          <option>NOTE</option>
          <option>EMAIL</option>
          <option>MEETING</option>
        </select>
      </label>
      <label>
        <span>
          Notes <span className="required-mark">*</span>
        </span>
        <textarea
          required
          maxLength={4000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened? What should happen next?"
          aria-invalid={attempted && !notes.trim()}
          className={attempted && !notes.trim() ? "field-missing" : undefined}
        />
        {attempted && !notes.trim() ? (
          <small className="field-error">
            Add a short, useful description of the activity.
          </small>
        ) : null}
      </label>
      <button className="button button-primary" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
function TaskForm({
  leadId,
  onSubmit,
  submitLabel,
}: {
  leadId?: string;
  onSubmit: (payload: unknown) => Promise<void>;
  submitLabel: string;
}) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        title,
        leadId: leadId || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="stack-form" onSubmit={submit} noValidate>
      <label>
        <span>
          Task title <span className="required-mark">*</span>
        </span>
        <input
          required
          minLength={2}
          maxLength={240}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Follow up with franchisee"
          aria-invalid={attempted && !title.trim()}
          className={attempted && !title.trim() ? "field-missing" : undefined}
        />
        {attempted && !title.trim() ? (
          <small className="field-error">Task title is required.</small>
        ) : null}
      </label>
      <label>
        Due date and time
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </label>
      <button className="button button-primary" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
function PricingForm({
  pricing,
  onSubmit,
}: {
  pricing: {
    abcPrice: number;
    pharmacyPrice: number;
    comboPrice: number;
    currency: string;
  };
  onSubmit: (payload: unknown) => Promise<void>;
}) {
  const [form, setForm] = useState(pricing);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        abcPrice: Number(form.abcPrice),
        pharmacyPrice: Number(form.pharmacyPrice),
        comboPrice: Number(form.comboPrice),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        ABC package
        <input
          required
          type="number"
          min="0.01"
          value={form.abcPrice}
          onChange={(e) =>
            setForm({ ...form, abcPrice: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Pharmacy package
        <input
          required
          type="number"
          min="0.01"
          value={form.pharmacyPrice}
          onChange={(e) =>
            setForm({ ...form, pharmacyPrice: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Combo package
        <input
          required
          type="number"
          min="0.01"
          value={form.comboPrice}
          onChange={(e) =>
            setForm({ ...form, comboPrice: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Currency
        <input
          required
          maxLength={3}
          value={form.currency}
          onChange={(e) =>
            setForm({ ...form, currency: e.target.value.toUpperCase() })
          }
        />
      </label>
      <button className="button button-primary" disabled={busy}>
        {busy ? "Saving…" : "Save pricing"}
      </button>
    </form>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function NoticeBar({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  return (
    <div className={`notice-bar ${notice.tone ?? "success"}`} role="status">
      <span>{notice.message}</span>
      <button
        className="icon-button"
        onClick={onClose}
        aria-label="Dismiss message"
      >
        <X size={15} />
      </button>
    </div>
  );
}
function Page({
  title,
  subtitle,
  actions,
  children,
  backTo,
  headingDetails,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
  backTo?: string;
  headingDetails?: ReactNode;
}) {
  return (
    <div className="page">
      <div className="page-heading">
        {backTo && (
          <NavLink to={backTo} className="back-link">
            <ChevronRight size={16} /> Back
          </NavLink>
        )}
        <div className="page-heading-row">
          <div>
            <span className="eyebrow">DR. CARE OPERATIONS</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            {headingDetails && (
              <div className="page-heading-details">{headingDetails}</div>
            )}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}
function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  hint,
  icon: IconComponent,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: Icon;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <IconComponent size={19} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}
function LeadRow({ lead }: { lead: Lead }) {
  return (
    <NavLink to={`/leads/${lead.id}`} className="lead-row">
      <div className="avatar">{initials(lead.fullName)}</div>
      <div className="lead-row-main">
        <strong>{lead.fullName}</strong>
        <span>
          {lead.preferredLocation ?? "Location not provided"} · Updated{" "}
          {formatDate(lead.updatedAt)}
        </span>
      </div>
      <StatusPill state={lead.state} />
      <ChevronRight size={17} />
    </NavLink>
  );
}
function LeadCard({
  lead,
  submittedForFinance = false,
}: {
  lead: Lead;
  submittedForFinance?: boolean;
}) {
  const nextStep = nextStepForLead(lead, submittedForFinance);
  const nextActionOwner = nextActionOwnerForLead(lead, submittedForFinance);
  const flag = leadFlag(lead);
  const stale = isOverdueLead(lead);
  return (
    <article className={`lead-card ${stale ? "is-stale" : ""}`}>
      <NavLink
        to={`/leads/${lead.id}`}
        className="lead-card-main"
        aria-label={`Open ${lead.fullName} profile`}
      >
        <div className="lead-card-top">
          <span className={`priority-mark ${flag ? "attention" : ""}`} />
          <span>{lead.productLine ?? "Product line pending"}</span>
          {lead.actualPrice || lead.listPrice ? (
            <span className="lead-card-price">
              ₱{Number(lead.actualPrice ?? lead.listPrice).toLocaleString()}
            </span>
          ) : null}
          <ChevronRight size={15} />
        </div>
        <div className="lead-card-name-row">
          <strong>{lead.fullName}</strong>
          {flag && <span className="lead-card-flag">{flag}</span>}
        </div>
        <span className="lead-card-location">
          {lead.preferredLocation ?? "Location not provided"}
        </span>
      </NavLink>
      <NavLink
        to={`/leads/${lead.id}?tab=${encodeURIComponent(nextStep.tab)}`}
        className="lead-card-next-action"
      >
        <span>Next step</span>
        <strong>
          {nextStep.label}
          <ArrowUpRight size={13} />
        </strong>
        <small>{nextStep.detail}</small>
      </NavLink>
      <div className="lead-card-footer">
        <span className="lead-card-next-owner">
          <small>Next action by</small>
          <strong>{nextActionOwner}</strong>
        </span>
      </div>
    </article>
  );
}
function StatusPill({ state, label }: { state: string; label?: string }) {
  const match = states.find((item) => item.value === state);
  return (
    <span className={`status-pill ${match?.tone ?? "slate"}`}>
      <i />
      {label ?? match?.label ?? state}
    </span>
  );
}
function ActionButton({
  label,
  text,
  onClick,
}: {
  label: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button className="action-button" onClick={onClick}>
      <div>
        <strong>{label}</strong>
        <span>{text}</span>
      </div>
      <ArrowUpRight size={17} />
    </button>
  );
}
function TimelineItem({ item }: { item: ActivityItem }) {
  return (
    <div className="timeline-item">
      <div className="timeline-icon">
        <Activity size={15} />
      </div>
      <div>
        <strong>{item.message}</strong>
        <span>
          {item.type.replaceAll("_", " ")} · {formatDate(item.createdAt)}
        </span>
      </div>
    </div>
  );
}
function TaskRow({ task }: { task: Task }) {
  return (
    <div className="compact-task">
      <div
        className={`checkbox ${task.status === "Completed" ? "checked" : ""}`}
      >
        {task.status === "Completed" && <CheckCircle2 size={13} />}
      </div>
      <span>{task.title}</span>
      <ChevronRight size={14} />
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function EmptyState({
  icon: IconComponent,
  title,
  text,
}: {
  icon: Icon;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <IconComponent size={20} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
function Loading() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      Loading your workspace…
    </div>
  );
}
function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
    const fields = Object.keys(error.fieldErrors).map(friendlyFieldLabel);
    return `Please review: ${fields.join(", ")}. ${error.message}`;
  }
  return error instanceof Error ? makeErrorFriendly(error.message) : fallback;
}
function friendlyFieldLabel(field: string) {
  const name = field.split(".").at(-1) ?? field;
  const labels: Record<string, string> = {
    fullName: "Full name",
    age: "Age",
    contactNumber: "Contact number",
    email: "Email",
    sourceOfIncome: "Source of income",
    preferredLocation: "Preferred location",
    productLine: "Product line",
    actualPrice: "Agreed actual price",
    outcome: "Call outcome",
    notes: "Notes",
    followUpAt: "Follow-up date and time",
    referenceNumber: "Bank or receipt reference",
    fileName: "File",
    contentType: "File type",
    sizeBytes: "File size",
    handoffNotes: "Handoff notes",
  };
  return (
    labels[name] ??
    name
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}
function makeErrorFriendly(message: string) {
  const replacements: [RegExp, string][] = [
    [/Sha256 must be a 64-character hexadecimal digest\.?/i, "The uploaded file could not be verified. Please choose the file again."],
    [/Unsupported document content type\.?/i, "Choose a PDF, JPG, or PNG file."],
    [/Unsupported content type\.?/i, "Choose a PDF, JPG, or PNG file."],
    [/Unsupported file extension\.?/i, "Choose a PDF, JPG, or PNG file."],
    [/File extension does not match content type\.?/i, "The selected file format does not match its filename. Choose a different file."],
    [/Payment amount or currency does not match the invoice\.?/i, "The payment amount does not match the generated invoice. Refresh the page and try again."],
  ];
  return replacements.reduce(
    (current, [pattern, value]) => current.replace(pattern, value),
    message,
  );
}
function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
function firstName(name: string) {
  return name.split(" ")[0];
}
function roleLabel(role: Role) {
  return (
    {
      MarketingAgent: "Marketing agent",
      MarketingAdmin: "Marketing admin",
      GeneralManager: "General manager",
      Finance: "Finance",
      AdminTeam: "Admin team",
      Leadership: "Leadership",
    } satisfies Record<Role, string>
  )[role];
}
function labelForState(state: LeadState) {
  return states.find((item) => item.value === state)?.label ?? state;
}
function documentTypeLabel(type: string) {
  return (
    {
      VALID_ID_SIGNATURES: "Valid ID + 3 specimen signatures",
      FLOOR_PLAN: "Floor plan",
      PERSPECTIVE: "Perspective",
      SIGNED_CONTRACT: "Signed contract",
      PAYMENT_RECEIPT: "Payment receipt or bank confirmation",
    }[type] ?? friendlyFieldLabel(type)
  );
}

export default App;
