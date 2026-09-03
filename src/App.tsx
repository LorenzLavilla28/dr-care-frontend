import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Copy,
  Crown,
  Clock3,
  Eraser,
  FileText,
  Filter,
  ImagePlus,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  UsersRound,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import headerLogo from "../assets/header-logo-CAyF_Iur.png";
import {
  api,
  ApiError,
  formatDate,
  session,
  type Activity as ActivityItem,
  type CompletedWorkItem,
  type Contract,
  type DocumentItem,
  type FinancePaymentDetail,
  type FinancePaymentItem,
  type FinanceWorkbenchResponse,
  type Lead,
  type LeadState,
  type LocationAnalysisAnswer,
  type LocationAnalysisQuestion,
  type LocationAnalysisResponse,
  type ProductLine,
  type LeadCaptureEventRecord,
  type PublicEventLanding,
  type Role,
  type SigningRequest,
  type Task,
  type UserRecord,
} from "./api";
import {
  joinRealtimeLead,
  leaveRealtimeLead,
  startRealtime,
  stopRealtime,
  subscribeRealtime,
} from "./realtime";

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;
type Notice = { message: string; tone?: "success" | "error" };

function useRealtimeRefresh() {
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeRealtime(() => setRevision((value) => value + 1)), []);
  return revision;
}

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
  { label: "Acknowledged", value: "Acknowledged", tone: "green" },
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
  {
    key: "acknowledged",
    label: "Acknowledged",
    description: "Admin Team received the handoff",
    tone: "green",
    values: ["Acknowledged"],
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
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function isOverdueLead(lead: Lead) {
  if (lead.state === "Acknowledged") return false;
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
  {
    code: "STANDARD_FRANCHISE",
    label: "Dr. Care Animal Bite Clinic Franchise Agreement",
  },
] as const;

const sourceOfIncomeOptions = [
  "Employment / salary",
  "Business income",
  "Professional practice",
  "Investments / dividends",
  "Rental income",
  "Pension / retirement",
  "Remittances / OFW income",
  "Savings / personal funds",
  "Loan / financing",
  "Inheritance / family support",
  "Others",
] as const;

const industryOptions = [
  "Healthcare / medical",
  "Pharmacy / drugstore",
  "Dental",
  "Veterinary / animal care",
  "Food and beverage",
  "Retail / trading",
  "Education / training",
  "Real estate / property",
  "Construction / engineering",
  "Manufacturing",
  "Professional services",
  "Financial services / insurance",
  "Information technology",
  "Agriculture / farming",
  "Government / public service",
  "Others",
] as const;

const discussionTimeOptions = [
  "Morning (8 AM–12 PM)",
  "Afternoon (12 PM–5 PM)",
  "Evening (5 PM–8 PM)",
  "Weekdays",
  "Weekends",
  "To be scheduled",
] as const;

function normalizedDiscussionTime(value?: string | null) {
  if (discussionTimeOptions.includes(value as (typeof discussionTimeOptions)[number]))
    return value ?? "";
  return value === "Yes" ? "To be scheduled" : "";
}

function SourceOfIncomeField({
  value,
  onChange,
  required = false,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
}) {
  const isStandard = sourceOfIncomeOptions.some(
    (option) => option !== "Others" && option === value,
  );
  const [choice, setChoice] = useState(
    value ? (isStandard ? value : "Others") : "",
  );
  useEffect(() => {
    if (value) {
      const standard = sourceOfIncomeOptions.some(
        (option) => option !== "Others" && option === value,
      );
      setChoice(standard ? value : "Others");
    } else if (choice !== "Others") {
      setChoice("");
    }
  }, [value, choice]);
  return (
    <label>
      <span>
        Source of income{required ? <span className="required-mark"> *</span> : <span className="field-optional"> (optional)</span>}
      </span>
      <select
        value={choice}
        required={required}
        aria-invalid={invalid}
        className={invalid ? "field-missing" : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setChoice(next);
          onChange(next === "Others" ? "" : next);
        }}
      >
        <option value="">Select source of income</option>
        {sourceOfIncomeOptions.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      {choice === "Others" ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Specify source of income"
          required={required}
          maxLength={160}
          aria-label="Other source of income"
          aria-invalid={invalid}
          className={invalid ? "field-missing" : undefined}
        />
      ) : null}
    </label>
  );
}

function IndustryField({
  value,
  onChange,
  required = false,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
}) {
  const isStandard = industryOptions.some(
    (option) => option !== "Others" && option === value,
  );
  const [choice, setChoice] = useState(
    value ? (isStandard ? value : "Others") : "",
  );
  useEffect(() => {
    if (value) {
      const standard = industryOptions.some(
        (option) => option !== "Others" && option === value,
      );
      setChoice(standard ? value : "Others");
    } else if (choice !== "Others") {
      setChoice("");
    }
  }, [value, choice]);
  return (
    <label>
      <span>
        Industry{required ? <span className="required-mark"> *</span> : null}
      </span>
      <select
        value={choice}
        required={required}
        aria-invalid={invalid}
        className={invalid ? "field-missing" : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setChoice(next);
          onChange(next === "Others" ? "" : next);
        }}
      >
        <option value="">Select industry</option>
        {industryOptions.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      {choice === "Others" ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Specify industry"
          required={required}
          maxLength={160}
          aria-label="Other industry"
          aria-invalid={invalid}
          className={invalid ? "field-missing" : undefined}
        />
      ) : null}
    </label>
  );
}

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

const locationAnalysisQuestions: LocationAnalysisQuestion[] = [
  ["SITE_01", "Site & Lease", "Does the location meet the location/site/guidelines/suggestions?"],
  ["SITE_02", "Site & Lease", "Does the location match the fitness of purpose and the franchise concept?"],
  ["SITE_03", "Site & Lease", "Is the monthly rental fees reasonable for the intended location?"],
  ["SITE_04", "Site & Lease", "Is the terms of the lease generally favorable to the franchisee?"],
  ["SITE_05", "Site & Lease", "Is the area classified as city, 1st or 2nd class municipality?"],
  ["PHYSICAL_01", "Physical Requirements", "Is the lease property located in the ground floor of the building with other business leasing the property?"],
  ["PHYSICAL_02", "Physical Requirements", "Is your location in an area without zonal restriction in operating a pharmacy?"],
  ["PHYSICAL_03", "Physical Requirements", "Does the size fit the franchisor’s standard requirements?", "3-meter front area; 30 sqm floor area."],
  ["PHYSICAL_04", "Physical Requirements", "Do they have the electrical, plumbing and telecommunication capability needed to run the business equipment from your Franchise?"],
  ["PHYSICAL_05", "Physical Requirements", "Is the location visibly and readily exposed? Is the location house in a well-constructed relatively new building?"],
  ["PHYSICAL_06", "Physical Requirements", "Is your area with readily available park port of at least 2 cars?"],
  ["TRAFFIC_01", "Traffic & Accessibility", "Is the foot traffic likely to register at least 100 individuals per hour within the path leading to your location during the peak business hour?"],
  ["TRAFFIC_02", "Traffic & Accessibility", "Is the foot traffic coming from residential locals and from other barangay/barrio areas?"],
  ["TRAFFIC_03", "Traffic & Accessibility", "Are there establishment bring in foot traffic to the area? (E g. Churches, School, Hospital and Government Offices)"],
  ["TRAFFIC_04", "Traffic & Accessibility", "Is the immediate street fronting your location be bi-directional 6-Lane main street?"],
  ["TRAFFIC_05", "Traffic & Accessibility", "Is the street prompting your location causing traffic during peak business hours?"],
  ["TRAFFIC_06", "Traffic & Accessibility", "Is the volume of vehicular traffic being at least a minimum of 100 vehicles of all sort within an hour period?"],
  ["TRAFFIC_07", "Traffic & Accessibility", "Is the location accessible to at least 100 residential houses within 1 km radius?"],
  ["TRAFFIC_08", "Traffic & Accessibility", "Is the location accessible in all directions to most commercial establishment?"],
  ["MARKET_01", "Market & Competition", "Does the location and its vicinity have at least 10 reputable or established brand within a 1 km radius in reference to the location of interest?"],
  ["MARKET_02", "Market & Competition", "Is there an animal bite center of another brand operating within 1 km radius in reference to your location of operation?"],
  ["MARKET_03", "Market & Competition", "Is there the same franchisee within 1 km in that area? Did the franchisor follow the rules regarding awarding franchisee an area exclusively?"],
  ["MARKET_04", "Market & Competition", "Are there at least 5 competitor animal bite centers within 1 km in the area?"],
  ["MARKET_05", "Market & Competition", "Can you identify your biggest competitor in the area?"],
  ["COMMUNITY_01", "Community & Environment", "Is your area considered within the vicinity of a tourist spot/tourism?"],
  ["COMMUNITY_02", "Community & Environment", "Is there an annual event of citywide proportion that utilize the immediate street fronting your location?"],
  ["COMMUNITY_03", "Community & Environment", "Are there current or future infrastructure developments in the area that may positively impact your franchise business? (Road Widening; Mid-Rise Condominium Bldg.)"],
  ["GROWTH_01", "Growth & Sales Potential", "Do you likely to perceive a monthly sales projection between ₱150,000 - ₱300,000 for the potential location?"],
  ["GROWTH_02", "Growth & Sales Potential", "Does your location create an atmosphere of “conveniently located “?"],
  ["GROWTH_03", "Growth & Sales Potential", "Do you likely to perceive present and future growth potential within the area of operation?"],
  ["GROWTH_04", "Growth & Sales Potential", "Is the area in which you are located is supported by a strong economic bas? (E g nearby industries working full time)"],
].map(([code, group, prompt, hint]) => ({ code, group, prompt, hint }));

const locationAnalysisResponseLabels: Record<string, string> = {
  YES_COMPLETELY: "Yes, completely",
  YES_PARTIALLY: "Yes, partially",
  NO: "No",
  DONT_KNOW: "Don't know",
};
const locationAnalysisGroups = [
  "Site & Lease",
  "Physical Requirements",
  "Traffic & Accessibility",
  "Market & Competition",
  "Community & Environment",
  "Growth & Sales Potential",
];
const leaseOwnershipOptions = [
  ["LEASED", "Leased"],
  ["OWNED", "Owned"],
  ["SHARED", "Shared / co-located"],
  ["PENDING", "Pending confirmation"],
  ["DONT_KNOW", "Don't know"],
] as const;

const lifecycleSteps = [
  { label: "Inquiry", tab: "Inquiry" },
  { label: "Qualification", tab: "Qualification" },
  { label: "Invoice & Documents", tab: "Workflow" },
  { label: "Finance verification", tab: "Workflow" },
  { label: "Contract", tab: "Contract" },
  { label: "Signed agreement review", tab: "Workflow" },
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
  if (state === "ContractSigned") return 5;
  if (state === "PreLaunch") return 6;
  return 7;
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
        label: "Review signed contract",
        detail:
          "Review the final signed agreement, then explicitly start the product-specific readiness checklist.",
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
    case "Acknowledged":
      return {
        label: "Handoff acknowledged",
        detail:
          "The Admin Team has acknowledged ownership. Downstream onboarding can continue.",
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
      return assignedAgent;
    case "ContractReview":
      return "General manager";
    case "EndorsedToAdmin":
      return "Admin team";
    case "Acknowledged":
      return "No further action";
    default:
      return assignedAgent;
  }
}

function isMyCurrentAction(
  lead: Lead,
  user: NonNullable<typeof session.user>,
) {
  const activeRole = canonicalRole(user.role);
  const owner = nextActionOwnerForLead(
    lead,
    Boolean(lead.downPaymentSubmittedForFinance),
  );
  // Work queues follow the role currently being acted as. A user may have
  // several roles, but an admin-only action must not appear while they are
  // working as a Sales Agent (and vice versa).
  if (activeRole === "SalesAgent" && lead.assignedAgentId === user.id && owner === (lead.assignedAgentName ?? "Assigned agent")) return true;
  const roleOwner: Partial<Record<Role, string>> = {
    GeneralManager: "General manager",
    Finance: "Finance team",
    AdminTeam: "Admin team",
  };
  return activeRole ? roleOwner[activeRole] === owner : false;
}

function isMyOpportunity(lead: Lead, user: NonNullable<typeof session.user>) {
  return lead.assignedAgentId === user.id || isMyCurrentAction(lead, user);
}

const nav: { label: string; to: string; icon: Icon; roles?: Role[] }[] = [
  {
    label: "Command center",
    to: "/",
    icon: LayoutDashboard,
    roles: ["SalesAgent", "GeneralManager", "Leadership"],
  },
  {
    label: "Franchise pipeline",
    to: "/pipeline",
    icon: BriefcaseBusiness,
    roles: ["SalesAgent", "GeneralManager", "Leadership"],
  },
  {
    label: "My work queue",
    to: "/tasks",
    icon: ListChecks,
    roles: ["SalesAgent", "GeneralManager", "Leadership"],
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
    roles: ["SalesAgent", "GeneralManager", "Leadership"],
  },
  {
    label: "Pre-launch",
    to: "/pre-launch",
    icon: ClipboardCheck,
    roles: ["SalesAgent", "GeneralManager", "Leadership"],
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
    roles: ["GeneralManager", "Finance", "Leadership"],
  },
  {
    label: "Events",
    to: "/events",
    icon: CalendarDays,
    roles: ["GeneralManager"],
  },
  {
    label: "Administration",
    to: "/settings",
    icon: Settings,
    roles: ["GeneralManager", "Leadership"],
  },
  {
    label: "User management",
    to: "/users",
    icon: UsersRound,
    roles: ["GeneralManager", "Leadership"],
  },
];

const leadReadRoles: Role[] = [
  "SalesAgent",
  "GeneralManager",
  "Leadership",
];
const pipelineReadRoles: Role[] = [
  "SalesAgent",
  "GeneralManager",
  "Leadership",
];
const taskReadRoles: Role[] = [
  "SalesAgent",
  "GeneralManager",
  "Leadership",
];
const leadWriteRoles: Role[] = [
  "SalesAgent",
  "GeneralManager",
];
const marketingWriteRoles: Role[] = ["SalesAgent", "GeneralManager"];

function canonicalRole(role: Role | undefined): Role | undefined {
  return role === "MarketingAgent" ? "SalesAgent" : role === "MarketingAdmin" ? "GeneralManager" : role;
}
function hasRole(role: Role | undefined, roles: Role[]) {
  if (!role) return false;
  const allowed = new Set(roles.map(canonicalRole));
  return allowed.has(canonicalRole(role));
}
function canOpenPath(role: Role, path: string) {
  if (path.startsWith("/leads/")) return hasRole(role, leadReadRoles);
  if (path === "/pipeline") return hasRole(role, pipelineReadRoles);
  if (path === "/tasks") return hasRole(role, taskReadRoles);
  const item = nav.find((entry) => entry.to === path);
  return !item?.roles || hasRole(role, item.roles);
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
  const publicEventToken = window.location.pathname.match(/^\/event\/([^/]+)$/)?.[1];
  if (publicEventToken)
    return <PublicEventPage token={decodeURIComponent(publicEventToken)} />;
  if (window.location.pathname === "/forgot-password") return <ForgotPasswordPage />;
  if (window.location.pathname === "/reset-password") return <ResetPasswordPage />;
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
  if (user.mustChangePassword)
    return <ChangePasswordPage onComplete={(next) => setUser(next)} onLogout={onLogout} />;
  return <Shell user={user} onLogout={onLogout} onUserChanged={setUser} />;
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
            src={headerLogo}
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
            <a className="auth-link" href="/forgot-password">Forgot your password?</a>
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

function ChangePasswordPage({
  onComplete,
  onLogout,
}: {
  onComplete: (user: NonNullable<typeof session.user>) => void;
  onLogout: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 12) {
      setError("Use at least 12 characters for your new password.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await api.auth.changePassword({ currentPassword, newPassword });
      session.set(response);
      onComplete(response.user);
    } catch (e) {
      setError(errorMessage(e, "Unable to change your password."));
    } finally {
      setLoading(false);
    }
  };
  return (
    <PublicAccountPage>
      <span className="eyebrow">SECURE ACCOUNT SETUP</span>
      <h2>Choose your new password</h2>
      <p className="muted">Your administrator created this account with a temporary password. Change it now to continue to the Dr. Care workspace.</p>
      <form className="stack-form" onSubmit={submit}>
        <label>Temporary password<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
        <label>New password<input type="password" required minLength={12} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <label>Confirm new password<input type="password" required minLength={12} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-primary button-wide" disabled={loading}>{loading ? "Updating password…" : "Save new password"}<ArrowUpRight size={17} /></button>
        <a className="auth-link" href="/forgot-password">Forgot your temporary password?</a>
        <button type="button" className="auth-link auth-link-button" onClick={() => void onLogout()}>Sign out</button>
      </form>
    </PublicAccountPage>
  );
}

function PublicAccountPage({ children }: { children: ReactNode }) {
  return <main className="login-page"><section className="login-brand"><div className="brand-lockup"><img src={headerLogo} alt="Dr. Care Medical Group" /></div><div className="brand-message"><span className="eyebrow">SECURE ACCOUNT ACCESS</span><h1>Always here for the work behind the care.</h1><p>Recover access to your Dr. Care workspace securely.</p></div></section><section className="login-panel"><div className="login-card">{children}</div></section></main>;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await api.auth.forgotPassword(email); setDone(true); } catch (e) { setError(errorMessage(e, "Unable to request a reset link.")); } finally { setBusy(false); } };
  return <PublicAccountPage><span className="eyebrow">ACCOUNT RECOVERY</span><h2>Reset your password</h2>{done ? <><p className="muted">If an active account matches that address, a secure reset link has been queued. Check your inbox and junk folder.</p><a className="button button-primary button-wide" href="/">Back to sign in</a></> : <form className="stack-form" onSubmit={submit}><p className="muted">Enter your organization email address. The reset link will expire after 30 minutes.</p><label>Email address<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary button-wide" disabled={busy}>{busy ? "Requesting…" : "Send reset link"}</button><a className="auth-link" href="/">Back to sign in</a></form>}</PublicAccountPage>;
}

function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search); const token = params.get("token") ?? ""; const email = params.get("email") ?? "";
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (password.length < 12) { setError("Use at least 12 characters."); return; } if (password !== confirm) { setError("The passwords do not match."); return; } setBusy(true); try { await api.auth.resetPassword({ token, email, newPassword: password }); setDone(true); } catch (e) { setError(errorMessage(e, "Unable to reset the password.")); } finally { setBusy(false); } };
  if (!token || !email) return <PublicAccountPage><h2>Invalid reset link</h2><p className="muted">This link is incomplete. Request a new password reset email.</p><a className="button button-primary button-wide" href="/forgot-password">Request new link</a></PublicAccountPage>;
  return <PublicAccountPage><span className="eyebrow">SECURE PASSWORD RESET</span><h2>{done ? "Password updated" : "Choose a new password"}</h2>{done ? <><p className="muted">Your password has been changed and existing sessions were signed out.</p><a className="button button-primary button-wide" href="/">Sign in</a></> : <form className="stack-form" onSubmit={submit}><p className="muted">Create a password with at least 12 characters.</p><label>New password<input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label>Confirm password<input type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary button-wide" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form>}</PublicAccountPage>;
}

function PublicEventPage({ token }: { token: string }) {
  const [event, setEvent] = useState<PublicEventLanding | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "submitted" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: "", contactNumber: "", email: "", address: "", preferredLocation: "", sourceOfIncome: "", productLine: "", consentAccepted: false });
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    api.publicEvents.get(token).then((value) => { setEvent(value); setStatus("ready"); }).catch((e) => { setError(errorMessage(e, "This event link is not available.")); setStatus("error"); });
  }, [token]);

  const emailValue = form.email.trim();
  const contactNumberValue = form.contactNumber.trim();
  const emailMissing = emailValue.length === 0;
  const contactNumberMissing = contactNumberValue.length === 0;
  const invalidEmail = !emailMissing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const invalidContactNumber = !contactNumberMissing && contactNumberValue.length < 7;
  const missing = [
    form.fullName.trim().length < 2 ? "Full name" : null,
    form.address.trim().length < 5 ? "Address" : null,
    contactNumberMissing ? "Contact number" : invalidContactNumber ? "Valid contact number" : null,
    emailMissing ? "Email" : invalidEmail ? "Valid email" : null,
    !form.consentAccepted ? "Privacy notice" : null,
  ].filter((value): value is string => Boolean(value));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (missing.length || !event?.isOpen) return;
    setBusy(true); setError("");
    try {
      await api.publicEvents.register(token, { fullName: form.fullName.trim(), contactNumber: contactNumberValue, email: emailValue.toLowerCase(), address: form.address.trim(), preferredLocation: form.preferredLocation.trim() || null, sourceOfIncome: form.sourceOfIncome.trim() || null, productLine: form.productLine || null, consentAccepted: form.consentAccepted });
      setStatus("submitted");
    } catch (err) { setError(errorMessage(err, "We could not submit your details.")); }
    finally { setBusy(false); }
  };

  return <main className="public-event-page"><section className="public-event-card">
    <div className="public-event-brand"><div className="app-mark">DC</div><span className="eyebrow">DR. CARE FRANCHISE OPPORTUNITY</span></div>
    {status === "loading" && <Loading />}
    {status === "error" && <><h1>Event link unavailable</h1><p className="form-error">{error}</p><p className="muted">Please scan the event QR code again or ask the event team for a current link.</p></>}
    {status === "submitted" && <div className="public-event-success"><CheckCircle2 size={32} /><div><h1>Thank you for your interest</h1><p>Your details are with the Dr. Care team. A representative will contact you using the information you provided.</p></div></div>}
    {status === "ready" && event && <>
      <div className="public-event-heading"><div><h1>{event.name}</h1><p>{event.description || "Tell us a little about yourself and the location you have in mind."}</p></div><span className={`public-event-status ${event.isOpen ? "open" : "closed"}`}>{event.isOpen ? "Prospect intake open" : "Prospect intake closed"}</span></div>
      {!event.isOpen ? <div className="public-event-closed"><Clock3 size={20} /><div><strong>{new Date(event.startsAt).getTime() > Date.now() ? "Prospect intake opens soon" : "This event has ended"}</strong><span>{new Date(event.startsAt).getTime() > Date.now() ? `Prospect intake opens ${formatDateTime(event.startsAt)}.` : "Prospect intake is no longer available through this QR code."}</span></div></div> : <form className="public-event-form" onSubmit={submit} noValidate>
        <div className="public-event-section"><span className="eyebrow">YOUR DETAILS</span><div className="form-grid"><label><span>Full name <b>*</b></span><input required minLength={2} maxLength={160} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label><span>Contact number <b>*</b></span><input required type="tel" maxLength={40} value={form.contactNumber} aria-invalid={attempted && (contactNumberMissing || invalidContactNumber)} className={attempted && (contactNumberMissing || invalidContactNumber) ? "field-missing" : undefined} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} /></label><label><span>Email <b>*</b></span><input required type="email" maxLength={254} value={form.email} aria-invalid={attempted && (emailMissing || invalidEmail)} className={attempted && (emailMissing || invalidEmail) ? "field-missing" : undefined} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label><span>Franchisee address <b>*</b></span><input required minLength={5} maxLength={500} placeholder="Home or registered business address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /><small className="field-hint">Used on the franchise agreement and official records.</small></label></div></div>
        <div className="public-event-section"><span className="eyebrow">YOUR OPPORTUNITY</span><div className="form-grid"><label className="form-wide"><span>Proposed franchise location <span className="field-optional">(optional)</span></span><input maxLength={240} placeholder="Street, barangay, city, province" value={form.preferredLocation} onChange={(e) => setForm({ ...form, preferredLocation: e.target.value })} /></label><SourceOfIncomeField value={form.sourceOfIncome} onChange={(value) => setForm({ ...form, sourceOfIncome: value })} /><label><span>Lead source</span><input value="Event prospect capture" disabled /></label><label><span>Product line <span className="field-optional">(optional)</span></span><select value={form.productLine} onChange={(e) => setForm({ ...form, productLine: e.target.value })}><option value="">Choose later</option><option value="Abc">ABC Animal Bite Clinic</option><option value="Pharmacy">Pharmacy</option><option value="Combo">ABC + Pharmacy Combo</option></select></label></div></div>
        <label className="public-event-consent"><input type="checkbox" required checked={form.consentAccepted} onChange={(e) => setForm({ ...form, consentAccepted: e.target.checked })} /><span>I agree that Dr. Care may use these details to contact me about this franchise opportunity. <b>*</b></span></label>
        {attempted && missing.length > 0 && <div className="form-error" role="alert">Please complete: {missing.join(", ")}.</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-primary button-wide" disabled={busy}>{busy ? "Submitting…" : "Submit my details"}<ArrowUpRight size={17} /></button>
        <p className="public-event-footnote"><ShieldCheck size={14} /> Your information is sent securely to the Dr. Care team.</p>
      </form>}
    </>}
  </section></main>;
}

function trimmedSignatureDataUrl(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  const padding = Math.max(24, Math.round(Math.min(canvas.width, canvas.height) * 0.12));
  const sourceLeft = Math.max(0, left - padding);
  const sourceTop = Math.max(0, top - padding);
  const sourceRight = Math.min(canvas.width - 1, right + padding);
  const sourceBottom = Math.min(canvas.height - 1, bottom + padding);
  const width = sourceRight - sourceLeft + 1;
  const height = sourceBottom - sourceTop + 1;
  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = width;
  trimmedCanvas.height = height;
  trimmedCanvas.getContext("2d")?.drawImage(canvas, sourceLeft, sourceTop, width, height, 0, 0, width, height);
  return trimmedCanvas.toDataURL("image/png");
}

async function uploadedSignatureDataUrl(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Please upload a PNG, JPG, or WEBP image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("The signature image must be 5 MB or smaller.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The signature image could not be read."));
      element.src = objectUrl;
    });
    const scale = Math.min(1, 1600 / image.naturalWidth, 900 / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The signature image could not be processed.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const isNearWhite = pixels.data[index] > 242 && pixels.data[index + 1] > 242 && pixels.data[index + 2] > 242;
      if (isNearWhite) pixels.data[index + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    return trimmedSignatureDataUrl(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function ContractSignPage({ token }: { token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [request, setRequest] = useState<{
    signerName: string;
    signerRole: string;
    expiresAt: string;
    documentUrl?: string;
  } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
    hasInk.current = true;
  };
  const stop = (event?: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (hasInk.current) {
      setUploadedPreview(null);
      const canvas = event?.currentTarget ?? canvasRef.current;
      setSignatureData(canvas ? trimmedSignatureDataUrl(canvas) : null);
    }
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setSignatureData(null);
    setUploadedPreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const dataUrl = await uploadedSignatureDataUrl(file);
      if (!dataUrl) throw new Error("No signature was detected in that image.");
      const context = canvasRef.current?.getContext("2d");
      if (canvasRef.current && context) context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      hasInk.current = true;
      setUploadedPreview(dataUrl);
      setSignatureData(dataUrl);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "The signature image could not be processed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  };
  const sign = async () => {
    if (!request || !accepted) return;
    if (!signatureData) {
      setMessage("Draw your signature or upload an image before signing.");
      return;
    }
    setMessage("");
    try {
      await api.publicSigning.sign(token, {
        signerName: request.signerName,
        acceptedTerms: accepted,
        signatureData,
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
              <div className="signature-input-actions">
                <span>Draw your signature above</span>
                <div className="signature-input-buttons">
                  <label className="signature-upload-button">
                    <ImagePlus size={15} />
                    {uploading ? "Processing…" : "Upload image"}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={upload}
                      disabled={uploading}
                    />
                  </label>
                  <button type="button" className="text-link signature-clear-button" onClick={clear} disabled={!hasInk.current || uploading}>
                    <Eraser size={14} /> Clear
                  </button>
                </div>
              </div>
            </div>
            {uploadedPreview && (
              <div className="signature-upload-preview">
                <span>Uploaded signature preview</span>
                <div><img src={uploadedPreview} alt="Uploaded signature preview" /></div>
              </div>
            )}
            <p className="signature-upload-hint"><Upload size={13} /> PNG, JPG, or WEBP. The image is processed in your browser and is not saved.</p>
            {uploadError && <div className="form-error">{uploadError}</div>}
            {message && <div className="form-error">{message}</div>}
            <div className="button-row">
              <button
                className="button button-primary"
                disabled={!accepted || !signatureData || uploading}
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
  onUserChanged,
}: {
  user: NonNullable<typeof session.user>;
  onLogout: () => void;
  onUserChanged: (user: NonNullable<typeof session.user>) => void;
}) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  useEffect(() => {
    void startRealtime().catch(() => undefined);
    return () => {
      void stopRealtime();
    };
  }, []);
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
  const switchRole = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextRole = event.target.value as Role;
    if (!nextRole || nextRole === user.role) return;
    setSwitchingRole(true);
    try {
      const response = await api.auth.switchRole(nextRole);
      session.set(response);
      onUserChanged(response.user);
      navigate("/", { replace: true });
    } catch {
      event.target.value = user.role;
    } finally {
      setSwitchingRole(false);
    }
  };
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
            <strong>Marketing Operations</strong>
            <span>Department workspace</span>
          </div>
          <ChevronRight size={15} />
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav
            .filter((item) => !item.roles || hasRole(user.role, item.roles))
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
          <div className="user-menu">
            <div className="avatar avatar-small">
              {initials(user.displayName)}
            </div>
            <span>
              <strong>{user.displayName}</strong>
              <small>{roleLabel(user.role)}</small>
            </span>
            <button className="icon-button sidebar-logout" onClick={onLogout} aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
          {(user.roles?.length ?? 0) > 1 && (
            <label className="sidebar-role-switch">
              <span>Acting as</span>
              <select value={user.role} onChange={switchRole} disabled={switchingRole} aria-label="Switch active role">
                {(user.roles ?? [user.role]).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
            </label>
          )}
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
                <FinanceWorkbench />
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
            <Route path="/events" element={<EventsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Dashboard({ user }: { user: NonNullable<typeof session.user> }) {
  if (!hasRole(user.role, pipelineReadRoles))
    return hasRole(user.role, ["Finance"]) ? (
      <Navigate to="/finance" replace />
    ) : hasRole(user.role, ["AdminTeam"]) ? (
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
  const realtimeRevision = useRealtimeRefresh();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api.leads.listAll("?sort=updatedAt"), api.tasks.list()])
      .then(([leadResult, taskResult]) => {
        setLeads(leadResult.items);
        setTasks(taskResult);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [realtimeRevision]);
  const attentionLeads = leads.filter(isAttentionLead);
  const attention = attentionLeads.slice(0, 5);
  const openTasks = tasks.filter((task) => task.status === "Open").length;
  const qualifiedCount = leads.filter((lead) => lead.state === "Qualified").length;
  const movingCount = leads.filter((lead) => !isAttentionLead(lead)).length;
  const overdueCount = leads.filter(isOverdueLead).length;
  const focusLead = attention[0];
  const focusStep = focusLead
    ? nextStepForLead(focusLead, Boolean(focusLead.downPaymentSubmittedForFinance))
    : null;
  const focusMessage = loading
    ? "Reading your operating pulse…"
    : attention.length
      ? `${attentionLeads.length} ${attentionLeads.length === 1 ? "opportunity needs" : "opportunities need"} a move today`
      : "Your pipeline is clear for today";
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
      <section className="hero-strip dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="eyebrow">YOUR OPERATING RHYTHM</span>
          <h2>Make the next right move.</h2>
          <p>
            Keep every franchise opportunity moving with clarity, care, and a
            visible owner.
          </p>
        </div>
        <div className="dashboard-hero-insight">
          <div className="dashboard-hero-insight-top">
            <span>Today&apos;s focus</span>
            <span className="dashboard-live-badge"><i /> Live</span>
          </div>
          <strong>{focusMessage}</strong>
          <p>
            {focusLead
              ? `${focusLead.fullName} · ${focusStep?.label ?? "Open opportunity"}`
              : loading
                ? "Syncing the latest workspace activity."
                : "No priority work is waiting on your team."}
          </p>
          <NavLink to={focusLead ? `/leads/${focusLead.id}` : "/pipeline"}>
            {focusLead ? "Open priority work" : "Open pipeline"} <ArrowUpRight size={14} />
          </NavLink>
        </div>
        <div className="hero-orbit">
          <div className="orbit-core">DC</div>
          <span className="orbit-dot one" />
          <span className="orbit-dot two" />
          <span className="orbit-dot three" />
        </div>
      </section>
      <section className="metric-grid dashboard-metric-grid">
        <Metric
          label="Active opportunities"
          value={loading ? "—" : String(leads.length)}
          hint="Across the full pipeline"
          icon={BriefcaseBusiness}
          tone="red"
        />
        <Metric
          label="Need attention"
          value={loading ? "—" : String(attentionLeads.length)}
          hint={overdueCount ? `${overdueCount} overdue` : "Priority work items"}
          icon={Clock3}
          tone="amber"
        />
        <Metric
          label="Open tasks"
          value={loading ? "—" : String(openTasks)}
          hint="Assigned work to clear"
          icon={ListChecks}
          tone="blue"
        />
        <Metric
          label="Qualified"
          value={
            loading
              ? "—"
              : String(
                  qualifiedCount,
                )
          }
          hint={loading ? "Ready for the next step" : `${movingCount} moving forward`}
          icon={CheckCircle2}
          tone="green"
        />
      </section>
      <div className="dashboard-grid">
        <section className="panel attention-panel dashboard-focus-panel">
          <PanelHeader
            title="Next best moves"
            subtitle="The work most likely to move the pipeline today."
            action={
              <NavLink to="/pipeline" className="text-link">
                View all <ArrowUpRight size={14} />
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
        <section className="panel pulse-panel dashboard-pulse-panel">
          <PanelHeader
            title="Pipeline health"
            subtitle="Where opportunities are sitting right now."
            action={
              <span className="dashboard-total-badge">
                {loading ? "—" : `${leads.length} total`}
              </span>
            }
          />
          <div className="dashboard-pulse-summary">
            <div>
              <span>Moving forward</span>
              <strong>{loading ? "—" : movingCount}</strong>
            </div>
            <div>
              <span>Needs a move</span>
              <strong className={attentionLeads.length ? "has-attention" : ""}>
                {loading ? "—" : attentionLeads.length}
              </strong>
            </div>
          </div>
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
  const realtimeRevision = useRealtimeRefresh();
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
      .listAll("?sort=updatedAt")
      .then((result) => setLeads(result.items))
      .catch((e) =>
        setNotice({
          message: errorMessage(e, "Unable to load the pipeline."),
          tone: "error",
        }),
      )
      .finally(() => setLoading(false));
  }, [realtimeRevision]);
  const filtered = leads.filter((lead) => {
    const matchesSearch =
      `${lead.fullName} ${lead.email} ${lead.preferredLocation ?? ""} ${lead.productLine ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "mine" && isMyOpportunity(lead, user)) ||
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
      label: canonicalRole(user.role) === "SalesAgent" ? "My opportunities" : "All opportunities",
      count: leads.length,
    },
    ...(canonicalRole(user.role) === "SalesAgent"
      ? []
      : [
          {
            value: "mine" as PipelineFilter,
            label: "My opportunities",
            count: leads.filter((lead) => isMyOpportunity(lead, user)).length,
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
                <div className="kanban-column-header">
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
                </div>
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
  const realtimeRevision = useRealtimeRefresh();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const utilityTabs = [
    "Overview",
    "Workflow",
    "Location analysis",
    "Activities",
    "Documents",
    ...(hasRole(session.user?.role, [
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
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const [assignees, setAssignees] = useState<
    { id: string; displayName: string; role: Role; roles?: Role[]; isActive: boolean }[]
  >([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const loadActivities = async (page = 1) => {
    try {
      const response = await api.leads.activities(leadId, page);
      setActivities(response.items);
      setActivityPage(response.page);
      setActivityTotal(response.total);
    } catch (e) {
      setNotice({
        message: errorMessage(e, "Unable to load activities."),
        tone: "error",
      });
    }
  };
  const load = async () => {
    try {
      const nextLead = await api.leads.get(leadId);
      if (
          hasRole(session.user?.role, ["Finance", "AdminTeam"])
      ) {
        const nextPayment =
          hasRole(session.user?.role, ["Finance"]) &&
          ["Qualified", "DownPaymentPending"].includes(nextLead.state)
            ? await api.leads.downPayment(leadId).catch(() => null)
            : null;
        setLead(nextLead);
        setActivities([]);
        setActivityPage(1);
        setActivityTotal(0);
        setTasks([]);
        setPayment(nextPayment as Record<string, unknown> | null);
        return;
      }
      const [nextActivities, nextTasks] = await Promise.all([
        api.leads.activities(leadId, 1),
        api.leads.tasks(leadId),
      ]);
      const nextPayment = ["Qualified", "DownPaymentPending"].includes(
        nextLead.state,
      )
        ? await api.leads.downPayment(leadId).catch(() => null)
        : null;
      setLead(nextLead);
      setActivities(nextActivities.items);
      setActivityPage(nextActivities.page);
      setActivityTotal(nextActivities.total);
      setTasks(nextTasks);
      setPayment(nextPayment as Record<string, unknown> | null);
    } catch (e) {
      setError(errorMessage(e, "Unable to load this franchisee."));
    }
  };
  useEffect(() => {
    void load();
  }, [leadId, realtimeRevision]);
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    void startRealtime()
      .then(() => (cancelled ? undefined : joinRealtimeLead(leadId)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void leaveRealtimeLead(leadId).catch(() => undefined);
    };
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
  const saveLeadDetails = async (payload: unknown) => {
    try {
      await api.leads.updateDetails(lead.id, {
        ...(payload as Record<string, unknown>),
        expectedVersion: lead.version,
      });
      setEditOpen(false);
      setNotice({ message: "Lead details updated.", tone: "success" });
      await load();
    } catch (e) {
      setNotice({ message: errorMessage(e, "Unable to update lead details."), tone: "error" });
    }
  };
  const saveTask = async (payload: unknown) => {
    await api.leads.createTask(lead.id, payload);
    setTaskOpen(false);
    setNotice({ message: "Task created.", tone: "success" });
    await load();
  };
  const openAssignment = async () => {
    setAssignmentOpen(true);
    setAssignmentId(lead.assignedAgentId);
    try {
      const users = (await api.users.list("?page=1&pageSize=100")).items as typeof assignees;
      setAssignees(
        users.filter(
          (user) =>
            user.isActive &&
            (user.roles ?? [user.role]).some((role) =>
              canonicalRole(role) === "SalesAgent",
            ),
        ),
      );
    } catch (e) {
      setNotice({ message: errorMessage(e, "Unable to load owners."), tone: "error" });
    }
  };
  const saveAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignmentId) return;
    setAssignmentBusy(true);
    try {
      await api.leads.assign(lead.id, {
        assignedAgentId: assignmentId,
        expectedVersion: lead.version,
      });
      setAssignmentOpen(false);
      setNotice({ message: "Opportunity owner updated.", tone: "success" });
      await load();
    } catch (e) {
      setNotice({ message: errorMessage(e, "Unable to update the owner."), tone: "error" });
    } finally {
      setAssignmentBusy(false);
    }
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
              onClick={() => setEditOpen(true)}
            >
              <Pencil size={16} /> Edit lead
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
          {hasRole(session.user?.role, ["GeneralManager"]) && !["EndorsedToAdmin", "Acknowledged"].includes(lead.state) && (
            <button className="button button-secondary" onClick={openAssignment}>
              <UsersRound size={16} /> Change owner
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
          activityPage={activityPage}
          activityTotal={activityTotal}
          onActivityPageChange={loadActivities}
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
      {editOpen && (
        <Modal
          title="Edit lead details"
          subtitle="Keep the record complete. Changes are saved to the activity history."
          onClose={() => setEditOpen(false)}
        >
          <LeadDetailsEditForm
            lead={lead}
            onSubmit={saveLeadDetails}
            onCancel={() => setEditOpen(false)}
          />
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
      {assignmentOpen && (
        <Modal
          title="Change opportunity owner"
          subtitle="The General Manager can assign an opportunity to an active Sales Agent."
          onClose={() => setAssignmentOpen(false)}
        >
          <form className="stack-form" onSubmit={saveAssignment}>
            <label>
              Responsible owner
              <select
                value={assignmentId}
                onChange={(event) => setAssignmentId(event.target.value)}
                required
              >
                <option value="">Select owner</option>
                {assignees.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.displayName} — {roleLabel(user.role as Role)}
                    {user.id === session.user?.id ? " (You)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button className="button button-primary" disabled={assignmentBusy || !assignmentId}>
                {assignmentBusy ? "Saving…" : "Save owner"}
              </button>
            </div>
          </form>
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
    return hasRole(role, ["Finance"]) || hasRole(role, marketingWriteRoles);
  if (
    lead.state === "DownPaymentConfirmed" ||
    lead.state === "ContractDrafting"
  )
    return hasRole(role, marketingWriteRoles);
  if (lead.state === "ContractReview") return hasRole(role, ["GeneralManager"]);
  if (lead.state === "ContractSigned" || lead.state === "PreLaunch")
    return hasRole(role, marketingWriteRoles);
  if (lead.state === "EndorsedToAdmin") return hasRole(role, ["AdminTeam"]);
  if (lead.state === "Acknowledged") return false;
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
  const [handoffAcknowledged, setHandoffAcknowledged] = useState(lead.state === "Acknowledged");
  useEffect(() => {
    if (lead.state === "Acknowledged") {
      setHandoffAcknowledged(true);
      return;
    }
    if (lead.state !== "EndorsedToAdmin") {
      setHandoffAcknowledged(false);
      return;
    }
    api.leads
      .endorsement(lead.id)
      .then((value) => {
        setHandoffAcknowledged(
          String((value as Record<string, unknown>).status ?? "").toLowerCase() ===
            "acknowledged",
        );
      })
      .catch(() => setHandoffAcknowledged(false));
  }, [lead.id, lead.state]);
  const canPrimary =
    canPrimaryOverride ?? canPerformPrimaryWorkflowAction(lead);
  if (handoffAcknowledged) {
    return (
      <section className="panel workflow-action-area workflow-action-area-complete">
        <div className="workflow-current">
          <span>Current status</span>
          <StatusPill state={lead.state} label="Completed" />
        </div>
        <span className="eyebrow">WORKFLOW COMPLETE</span>
        <h3>Handoff acknowledged</h3>
        <p className="workflow-action-description">
          The Admin Team acknowledged this opportunity. No further action is
          required in the franchise workflow.
        </p>
        <div className="completion-card">
          <CheckCircle2 size={19} />
          <div>
            <strong>Opportunity complete</strong>
            <span>The downstream onboarding process now belongs to the Admin Team.</span>
          </div>
        </div>
      </section>
    );
  }
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
  const [handoffAcknowledged, setHandoffAcknowledged] = useState(lead.state === "Acknowledged");
  useEffect(() => {
    if (lead.state === "Acknowledged") {
      setHandoffAcknowledged(true);
      return;
    }
    if (lead.state !== "EndorsedToAdmin") {
      setHandoffAcknowledged(false);
      return;
    }
    api.leads
      .endorsement(lead.id)
      .then((value) => {
        setHandoffAcknowledged(
          String((value as Record<string, unknown>).status ?? "").toLowerCase() ===
            "acknowledged",
        );
      })
      .catch(() => setHandoffAcknowledged(false));
  }, [lead.id, lead.state]);
  const currentIndex = handoffAcknowledged
    ? lifecycleSteps.length
    : workflowStateIndex(lead.state, payment);
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
        <span>{handoffAcknowledged ? "Complete" : `${currentStage.label} now`}</span>
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
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState("Overview");
  const [error, setError] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const loadActivities = async (page = 1) => {
    const response = await api.leads.activities(leadId, page);
    setActivities(response.items);
    setActivityPage(response.page);
    setActivityTotal(response.total);
  };
  const load = async () => {
    try {
      const [nextLead, nextActivities, nextTasks] = await Promise.all([
        api.leads.get(leadId),
        api.leads.activities(leadId, 1),
        api.leads.tasks(leadId),
      ]);
      setLead(nextLead);
      setActivities(nextActivities.items);
      setActivityPage(nextActivities.page);
      setActivityTotal(nextActivities.total);
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
          activityPage={activityPage}
          activityTotal={activityTotal}
          onActivityPageChange={loadActivities}
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
  activityPage,
  activityTotal,
  onActivityPageChange,
  onReload,
  onNotice,
  onAddActivity,
  onSelectTab,
}: {
  tab: string;
  lead: Lead;
  payment?: Record<string, unknown> | null;
  activities: ActivityItem[];
  activityPage: number;
  activityTotal: number;
  onActivityPageChange: (page: number) => Promise<void>;
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
        text="Invoice generation is restricted to the Sales Agent and General Manager roles."
      />
    );
  if (tab === "Payment confirmation")
    return hasRole(session.user?.role, ["Finance"]) ? (
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
        page={activityPage}
        total={activityTotal}
        onPageChange={onActivityPageChange}
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
  page,
  total,
  onPageChange,
  onAddActivity,
  onSelectTab,
}: {
  activities: ActivityItem[];
  page: number;
  total: number;
  onPageChange: (page: number) => Promise<void>;
  onAddActivity: () => void;
  onSelectTab: (tab: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "earlier">(
    "all",
  );
  const [pageBusy, setPageBusy] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const changePage = async (nextPage: number) => {
    if (pageBusy || nextPage < 1 || nextPage > totalPages || nextPage === page)
      return;
    setPageBusy(true);
    try {
      await onPageChange(nextPage);
    } finally {
      setPageBusy(false);
    }
  };
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
      {totalPages > 1 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          total={total}
          busy={pageBusy}
          onPageChange={changePage}
        />
      )}
    </section>
  );
}

function PaginationControls({
  page,
  totalPages,
  total,
  busy,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  busy?: boolean;
  onPageChange: (page: number) => void | Promise<void>;
}) {
  return (
    <div className="pagination-controls" aria-label="Pagination">
      <span>
        Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}
      </span>
      <div className="pagination-buttons">
        <button
          className="button button-secondary"
          disabled={busy || page <= 1}
          onClick={() => void onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="pagination-page">Page {page} of {totalPages}</span>
        <button
          className="button button-secondary"
          disabled={busy || page >= totalPages}
          onClick={() => void onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
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
  const handoffActive = lead.state === "EndorsedToAdmin" || lead.state === "Acknowledged";
  const [contract, setContract] = useState<Contract | null>(null);
  const [endorsement, setEndorsement] = useState<Record<string, unknown> | null>(null);
  const [documentsReadyForLead, setDocumentsReadyForLead] = useState<string | null>(null);
  const handoffAcknowledged =
    lead.state === "Acknowledged" ||
    (lead.state === "EndorsedToAdmin" &&
      String(endorsement?.status ?? "").toLowerCase() === "acknowledged");
  useEffect(() => {
    if (!handoffActive) {
      setEndorsement(null);
      return;
    }
    api.leads
      .endorsement(lead.id)
      .then((value) => setEndorsement(value as Record<string, unknown>))
      .catch(() => setEndorsement(null));
  }, [handoffActive, lead.state, lead.id]);
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
  const currentTitle = handoffAcknowledged
    ? "Handoff complete"
    : preparationActive
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
  const currentDescription = handoffAcknowledged
    ? "The Admin Team acknowledged this handoff. The opportunity is complete and downstream onboarding can continue."
    : preparationActive
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
  const phaseSteps = handoffActive
    ? [
        {
          label: handoffAcknowledged ? "Handoff complete" : "Acknowledge handoff",
          complete: handoffAcknowledged,
          active: !handoffAcknowledged,
        },
      ]
    : preparationActive
    ? preparationSubsteps
    : financeActive
      ? financeSubsteps
      : contractActive
        ? []
        : [{ label: currentTitle, complete: false, active: true }];
  const compactPhase = phaseSteps.length <= 1;
  const phaseOwner = handoffActive
    ? handoffAcknowledged
      ? "Completed"
      : "Admin team owned"
    : preparationActive
    ? "Agent-owned"
    : financeActive
      ? "Finance-owned"
      : contractActive
        ? "General Manager"
        : `${nextActionOwnerForLead(lead, Boolean(payment?.submittedForFinance))} owned`;
  const amount = payment
    ? `₱${Number(payment.amount).toLocaleString()}`
    : "Not configured";
  const invoiceNumber = String(payment?.invoiceNumber ?? "Not generated");
  const paymentStatus = String(
    statusLabel(String(payment?.status ?? (lead.state === "Qualified" ? "NotGenerated" : "Pending"))),
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
      if (hasRole(session.user?.role, ["Finance"]))
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
          <FinanceAwaitingPanel
            payment={payment}
            documentsComplete={documentsComplete}
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
          text="Invoice preparation is available to the Sales Agent or General Manager. Finance verifies payment."
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
    if (lead.state === "Acknowledged")
      return (
        <ReadOnlyWorkflowPanel
          title="Handoff acknowledged"
          text="The Admin Team has acknowledged ownership. Downstream onboarding can continue."
        />
      );
    if (lead.state === "EndorsedToAdmin")
      return hasRole(session.user?.role, ["AdminTeam"]) ? (
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
                {handoffAcknowledged
                  ? "WORKFLOW COMPLETE"
                  : preparationActive
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
            <span className="workflow-phase-status">
              {handoffAcknowledged ? "Completed" : "Current phase"}
            </span>
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
            <h3>
              {contractActive
                ? "Contract details"
                : handoffActive
                  ? "Handoff details"
                  : "Step details"}
            </h3>
            {contractActive ? (
              <dl className="workflow-detail-list">
                <div>
                  <dt>Contract status</dt>
                  <dd>{contract ? statusLabel(contract.status) : "Not generated"}</dd>
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
                  <dd>General Manager</dd>
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
            ) : handoffActive ? (
              <dl className="workflow-detail-list">
                <div>
                  <dt>Receiving team</dt>
                  <dd>{roleLabel(String(endorsement?.receivingTeam ?? "Admin Team"))}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{statusLabel(String(endorsement?.status ?? (lead.state === "Acknowledged" ? "Acknowledged" : "Pending")))}</dd>
                </div>
                <div>
                  <dt>Handoff created</dt>
                  <dd>{endorsement?.createdAt ? formatDate(String(endorsement.createdAt)) : "—"}</dd>
                </div>
                <div>
                  <dt>Acknowledged</dt>
                  <dd>{endorsement?.acknowledgedAt ? formatDate(String(endorsement.acknowledgedAt)) : lead.state === "Acknowledged" ? "Acknowledged" : "Awaiting Admin Team"}</dd>
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
            {!contractActive && !handoffActive && payment?.status === "Invoiced" && !payment?.submittedForFinance && (
              <div className="workflow-side-success">
                <CheckCircle2 size={17} />
                <span>Invoice generated successfully.</span>
              </div>
            )}
          </section>
          <section className="panel workflow-side-card">
            <h3>What happens next</h3>
            {handoffActive ? (
              handoffAcknowledged ? (
                <>
                  <div className="completion-card workflow-completion-card">
                    <CheckCircle2 size={19} />
                    <div>
                      <strong>Opportunity complete</strong>
                      <span>
                        The Admin Team acknowledged the handoff. No further
                        action is required in the franchise workflow.
                      </span>
                    </div>
                  </div>
                  <div className="workflow-next-phase">
                    <span>Lifecycle status</span>
                    <strong className="workflow-next-phase-complete">Complete</strong>
                  </div>
                </>
              ) : (
                <div className="workflow-next-list">
                  <div className="active">
                    <span>1</span>
                    <div>
                      <strong>Admin Team acknowledgement</strong>
                      <small>The receiving team must acknowledge this completed handoff.</small>
                    </div>
                  </div>
                </div>
              )
            ) : contractActive ? (
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

function FinanceAwaitingPanel({
  payment,
  documentsComplete,
}: {
  payment?: Record<string, unknown> | null;
  documentsComplete: boolean;
}) {
  const invoiceNumber = String(payment?.invoiceNumber ?? "Issued invoice");
  const submittedAt = payment?.submittedAt
    ? formatDate(String(payment.submittedAt))
    : null;
  return (
    <section className="panel tab-panel finance-awaiting-panel">
      <div className="finance-awaiting-heading">
        <div>
          <h3>Finance verification</h3>
          <p>This step is handled by the Finance team.</p>
        </div>
        <span className="finance-awaiting-status">
          <Clock3 size={18} /> Awaiting Finance
        </span>
      </div>

      <div className="finance-awaiting-callout">
        <ShieldCheck size={32} />
        <strong>Finance will verify and confirm the down payment before this workflow can continue.</strong>
      </div>

      <div className="finance-awaiting-checklist">
        <div className="finance-awaiting-check complete">
          <CheckCircle2 size={22} />
          <div>
            <strong>Invoice generated</strong>
            <span>{invoiceNumber}</span>
          </div>
          <em>Completed</em>
        </div>
        <div className={`finance-awaiting-check ${documentsComplete ? "complete" : "pending"}`}>
          {documentsComplete ? <CheckCircle2 size={22} /> : <Clock3 size={22} />}
          <div>
            <strong>Required document complete</strong>
            <span>Valid ID and specimen signatures</span>
          </div>
          <em>{documentsComplete ? "Completed" : "Pending"}</em>
        </div>
        <div className="finance-awaiting-check pending">
          <Clock3 size={22} />
          <div>
            <strong>Down payment verification pending</strong>
            <span>{submittedAt ? `Submitted to Finance · ${submittedAt}` : "Submitted payment awaiting review"}</span>
          </div>
          <em>Pending</em>
        </div>
      </div>

      <div className="finance-awaiting-next">
        <span className="finance-awaiting-next-icon"><UsersRound size={22} /></span>
        <div>
          <strong>Next action</strong>
          <p>Finance will review the submitted payment and confirm the down payment before the workflow can continue.</p>
        </div>
      </div>

      <div className="finance-awaiting-owner">
        <UsersRound size={20} />
        <span>Assigned to: <strong>Finance team</strong></span>
      </div>

      <div className="finance-awaiting-footer">
        <Bell size={19} />
        <span>You’ll be notified once Finance completes this step.</span>
      </div>
    </section>
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
  const status = String(payment?.status ?? "NotConfigured");
  const invoiced = status === "Invoiced";
  const confirmed = status === "Confirmed";
  const documentsComplete = Boolean(payment?.documentsComplete);
  const canPrepare = hasRole(role, marketingWriteRoles) && !confirmed;
  const canConfirm = hasRole(role, ["Finance"]) && invoiced;
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
          2. The Sales Agent confirms the down payment amount and generates the
          invoice.
        </span>
        <span>
          3. Finance verifies the payment and confirms it before contract
          drafting.
        </span>
      </div>
      <div className="process-card">
        <div className="snapshot-grid">
          <Info label="Status" value={loading ? "Loading…" : statusLabel(status)} />
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
  const [paymentProofComplete, setPaymentProofComplete] = useState(false);
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
    setPaymentProofComplete(documentResult.some((item) => item.documentType === "PAYMENT_RECEIPT" && item.status === "Uploaded"));
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
                : documentsComplete && paymentProofComplete
                  ? "Submit to Finance"
                  : "Complete payment package"}
            </h3>
            <p>
              {confirmed
                ? "Finance has verified the payment."
                : submitted
                  ? "The completed package is with Finance for payment verification."
                : documentsComplete && paymentProofComplete
                  ? "The invoice, identity documents, and payment proof are complete. Submit the package to Finance for verification."
                  : "Upload the identity documents and payment proof before submitting the package to Finance."}
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
                <div className="finance-package-summary">
                  <span className="eyebrow">PACKAGE READY</span>
                  <div className="finance-package-item complete">
                    <CheckCircle2 size={18} />
                    <div><strong>Required document uploaded</strong><small>Valid ID with 3 specimen signatures</small></div>
                  </div>
                  <div className="finance-package-item complete">
                    <CheckCircle2 size={18} />
                    <div><strong>Invoice generated</strong><small>{String(payment?.invoiceNumber ?? "Down payment invoice")} · {String(payment?.currency ?? "PHP")} {Number(payment?.amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</small></div>
                  </div>
                  <DocumentsPanel
                    lead={lead}
                    onNotice={onNotice}
                    onDocumentsChanged={reload}
                    embedded
                    fixedDocumentType="PAYMENT_RECEIPT"
                    visibleTypes={["PAYMENT_RECEIPT"]}
                    compactAfterUpload
                    documentCard
                  />
                </div>
                <DocumentsPanel
                  lead={lead}
                  onNotice={onNotice}
                  onDocumentsChanged={reload}
                  embedded
                  fixedDocumentType="VALID_ID_SIGNATURES"
                  visibleTypes={["VALID_ID_SIGNATURES", "VALID_ID", "SPECIMEN_SIGNATURE_1", "SPECIMEN_SIGNATURE_2", "SPECIMEN_SIGNATURE_3"]}
                  hideUpload
                  collapsible
                  uploadedOnly
                  documentCard
                />
                <div className="button-row finance-submit-actions">
                  <button className="button button-secondary" onClick={openInvoice}><FileText size={16} /> Open invoice</button>
                  <button className="button button-primary" onClick={submitToFinance} disabled={busy || !documentsComplete || !paymentProofComplete}>
                    {busy ? "Submitting…" : "Submit complete package to Finance"}<ChevronRight size={16} />
                  </button>
                </div>
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
          title="Generate down payment invoice"
          subtitle={
            "Confirm the amount and generate the invoice first. Upload identity documents and payment proof before submitting to Finance."
          }
        />
        <div className="workflow-instructions">
          <strong>What happens next</strong>
          <span>
            1. Confirm the down payment amount and generate the invoice.
          </span>
          <span>
            2. Upload one scanned file containing the valid ID and three specimen signatures.
          </span>
          <span>
            3. Upload payment proof, then submit the completed package to Finance for
            verification.
          </span>
        </div>
        <div className="process-card invoice-prerequisites-card">
          <div className="invoice-prerequisites-heading">
            <div>
              <span className="eyebrow">DOCUMENT CHECKLIST</span>
              <h3>Invoice prerequisites</h3>
              <p>Confirm the required identity document before generating an invoice.</p>
            </div>
            <div className={`invoice-prerequisites-status ${documentsComplete ? "complete" : ""}`}>
              <CheckCircle2 size={17} />
              {documentsComplete ? "1 of 1 requirement met" : "0 of 1 requirement met"}
            </div>
          </div>

          <div className={`invoice-prerequisite-row ${documentsComplete ? "complete" : ""}`}>
            <span className="invoice-prerequisite-icon"><CheckCircle2 size={18} /></span>
            <div>
              <strong>Valid ID with 3 specimen signatures</strong>
              <small>Required identity verification document</small>
            </div>
            <span className="invoice-prerequisite-state">{documentsComplete ? "Complete" : "Required"}</span>
          </div>

          <div className="invoice-prerequisites-section">
            <span className="eyebrow">IDENTITY DOCUMENT</span>
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
              documentCard
              compactAfterUpload
            />
          </div>

          <div className="invoice-prerequisites-divider" />

          <div className="invoice-generation-section">
            <h3>Generate invoice</h3>
            <p>Set the invoice amount. The invoice can be generated once the requirement above is complete.</p>
            <div className="invoice-generation-row">
              <label>
                <span>Invoice amount</span>
                <div className="invoice-amount-input">
                  <span>₱</span>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <small>Amount will be used as the invoice total.</small>
              </label>
              <button
                className="button button-primary"
                onClick={generateInvoice}
                disabled={busy || Number(amount) <= 0 || !documentsComplete}
              >
                {busy ? "Generating…" : "Generate invoice"}
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
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
  const [paymentEvidenceComplete, setPaymentEvidenceComplete] = useState(false);
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
      setPaymentEvidenceComplete(documentResult.some((item) => item.documentType === "PAYMENT_RECEIPT" && item.status === "Uploaded"));
    } catch {
      setPayment(null);
      setDocuments([]);
      setPaymentEvidenceComplete(false);
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
    if (!paymentEvidenceComplete) {
      onNotice({
        message: "Payment cannot be confirmed until the Sales Agent uploads payment proof.",
        tone: "error",
      });
      return;
    }
    if (!payment.submittedForFinance) {
      onNotice({
        message:
          "The Sales Agent must submit the completed down payment package to Finance first.",
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
                    : statusLabel(String(payment?.status ?? "NotStarted"))
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
                This Finance step is complete. The Sales Agent can now prepare
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
                  The Sales Agent uploads a screenshot, photo, or PDF. Review
                  the evidence here before confirming the payment.
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
                disabled={busy || !payment.documentsComplete || !paymentEvidenceComplete}
              >
                {busy ? "Confirming…" : "Confirm payment"}
              </button>
            </div>
            {!payment.documentsComplete && (
              <div className="read-only-note">
                <ShieldCheck size={16} /> Payment confirmation is blocked until
                the Sales Agent uploads:{" "}
                {missingDocuments.map(([, label]) => label).join(", ")}.
              </div>
            )}
            {payment.documentsComplete && !paymentEvidenceComplete && (
              <div className="read-only-note">
                <ShieldCheck size={16} /> Waiting for the Sales Agent to upload payment proof.
              </div>
            )}
          </>
        ) : (
          <div className="read-only-note">
            <ShieldCheck size={16} />{" "}
            {payment
              ? submitted
                ? "An invoiced payment is required before confirmation."
                : "Waiting for the Sales Agent to submit the invoice and required documents to Finance."
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
  const [attempted, setAttempted] = useState(false);

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
    setAttempted(true);
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
            ["meetingDateTime", "Meeting date and time", false],
            ["questionsConcerns", "Questions or concerns", false],
          ] as [keyof typeof form, string, boolean][]
        ).map(([key, label, required]) => (
          <label key={key}>
            <span>
              {label}
              {required ? <span className="required-mark"> *</span> : null}
            </span>
            {key === "meetingDateTime" ? (
              <BrandedDateTimePicker
                value={form.meetingDateTime}
                onChange={(meetingDateTime) =>
                  setForm((current) => ({ ...current, meetingDateTime }))
                }
              />
            ) : (
              <input
                value={form[key as keyof typeof form]}
                onChange={(e) =>
                  setForm((current) => ({ ...current, [key]: e.target.value }))
                }
                type={key === "age" ? "number" : key === "email" ? "email" : "text"}
                required={Boolean(required)}
                aria-invalid={attempted && required && !form[key].trim()}
                className={attempted && required && !form[key].trim() ? "field-missing" : undefined}
              />
            )}
            {attempted && required && !form[key].trim() ? (
              <small className="field-error">{label} is required.</small>
            ) : null}
          </label>
          ))}
        <div className="form-wide">
          <label>
            <span>
              Proposed franchise location <span className="field-optional">(optional)</span>
            </span>
            <input
              value={form.preferredLocation}
              onChange={(event) =>
                setForm((current) => ({ ...current, preferredLocation: event.target.value }))
              }
              maxLength={240}
              placeholder="Street, barangay, city, province"
            />
          </label>
        </div>
        <label>
          <span>
            Franchisee address <span className="field-optional">(optional for now)</span>
          </span>
          <input
            value={form.address}
            onChange={(e) =>
              setForm((current) => ({ ...current, address: e.target.value }))
            }
            minLength={5}
            maxLength={500}
            placeholder="Home or registered business address"
          />
          <small className="field-hint">Required before generating the franchise agreement.</small>
        </label>
        <IndustryField
          value={form.industry}
          onChange={(industry) =>
            setForm((current) => ({ ...current, industry }))
          }
        />
        <SourceOfIncomeField
          value={form.sourceOfIncome}
          onChange={(sourceOfIncome) =>
            setForm((current) => ({ ...current, sourceOfIncome }))
          }
          required
          invalid={!form.sourceOfIncome.trim()}
        />
        <div className="form-actions">
          <button className="button button-primary" disabled={loading}>
            {loading ? "Saving…" : "Save inquiry"}
          </button>
          <button
            type="button"
            className="button button-secondary"
            disabled={loading}
            onClick={async () => {
              setAttempted(true);
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
  const [welcomeDelivery, setWelcomeDelivery] = useState({
    status: lead.welcomeEmailStatus ?? "NotQueued",
    queuedAt: lead.welcomeEmailQueuedAt,
    sentAt: lead.welcomeEmailSentAt,
  });
  const [goodTime, setGoodTime] = useState(
    normalizedDiscussionTime(lead.goodTimeToDiscuss),
  );
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
          welcomeEmailStatus?: string;
          welcomeEmailQueuedAt?: string;
          welcomeEmailSentAt?: string;
          goodTimeToDiscuss?: string;
        };
        setNotes(record.notes ?? "");
        setVersion(record.version ?? lead.version);
        setProductLine(record.productLine ?? lead.productLine ?? "");
        setActualPrice(
          record.actualPrice?.toString() ?? lead.actualPrice?.toString() ?? "",
        );
        setCallOutcome(record.lastCallOutcome ?? lead.lastCallOutcome ?? "");
        setWelcomeDelivery({
          status: record.welcomeEmailStatus ?? lead.welcomeEmailStatus ?? "NotQueued",
          queuedAt: record.welcomeEmailQueuedAt ?? lead.welcomeEmailQueuedAt,
          sentAt: record.welcomeEmailSentAt ?? lead.welcomeEmailSentAt,
        });
        setGoodTime(
          normalizedDiscussionTime(
            record.goodTimeToDiscuss ?? lead.goodTimeToDiscuss,
          ),
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
      !goodTime ? "Preferred discussion time" : null,
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
      !goodTime ? "Preferred discussion time" : null,
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
          1. Review the system-tracked welcome email delivery and record the call outcome.
        </span>
        <span>2. Select the franchise product and agreed price.</span>
        <span>
          3. Save the nurturing details, then qualify or create a follow-up.
        </span>
      </div>
      {[
        !productLine ? "Product line" : null,
        !callOutcome.trim() ? "Call outcome" : null,
        !goodTime ? "Preferred discussion time" : null,
      ].some(Boolean) ? (
        <div className="missing-fields-summary" role="status">
          <strong>Still needed</strong>
          <span>
            {[
              !productLine ? "Product line" : null,
              !callOutcome.trim() ? "Call outcome" : null,
              !goodTime ? "Preferred discussion time" : null,
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
          <div className={`system-status-field ${welcomeDelivery.status.toLowerCase()}`}>
            <span>Welcome email</span>
            <strong>{welcomeDelivery.status === "Sent" && welcomeDelivery.sentAt
              ? `Sent ${formatDateTime(welcomeDelivery.sentAt)}`
              : welcomeDelivery.status === "Pending" && welcomeDelivery.queuedAt
                ? `Queued ${formatDateTime(welcomeDelivery.queuedAt)}`
                : welcomeDelivery.status === "Processing" ? "Sending now"
                  : welcomeDelivery.status === "Failed" ? "Delivery failed"
                    : "Not queued"}</strong>
            <small>Tracked automatically from the email service</small>
          </div>
          <label>
            Preferred time to discuss
            <select
              value={goodTime}
              onChange={(e) => {
                setGoodTime(e.target.value);
                setNurturingSaved(false);
              }}
              aria-invalid={!goodTime}
              className={!goodTime ? "field-missing" : undefined}
            >
              <option value="">Select a preferred time</option>
              {discussionTimeOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
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
  const [analysis, setAnalysis] = useState<LocationAnalysisResponse | null>(null);
  const [preferredLocation, setPreferredLocation] = useState(lead.preferredLocation ?? "");
  const [leaseOwnershipStatus, setLeaseOwnershipStatus] = useState("");
  const [answers, setAnswers] = useState<Record<string, LocationAnalysisAnswer>>({});
  const [notes, setNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [activeGroup, setActiveGroup] = useState(locationAnalysisGroups[0]);
  const [busy, setBusy] = useState(false);
  const canEdit = hasRole(session.user?.role, marketingWriteRoles);
  const canReview = hasRole(session.user?.role, ["GeneralManager"]);

  useEffect(() => {
    api.leads.location(lead.id).then((value) => {
      setAnalysis(value);
      setPreferredLocation(value.preferredLocation || lead.preferredLocation || "");
      setLeaseOwnershipStatus(value.leaseOwnershipStatus || "");
      setNotes(value.notes ?? "");
      setReviewNotes(value.reviewNotes ?? value.revisionReason ?? "");
      setAnswers(Object.fromEntries(value.answers.map((answer) => [answer.questionCode, answer])));
    }).catch(() => {
      setAnalysis(null);
      setPreferredLocation(lead.preferredLocation ?? "");
      setLeaseOwnershipStatus("");
      setNotes("");
      setReviewNotes("");
      setAnswers({});
    });
  }, [lead.id, lead.preferredLocation]);

  const status = analysis?.status ?? "Pending";
  const questionCount = analysis?.questionCount || locationAnalysisQuestions.length;
  const answeredCount = Object.keys(answers).length;
  const completion = Math.round((answeredCount / questionCount) * 100);
  const answerList = Object.values(answers);
  const isReturned = status === "Failed";
  const isReadOnly = (Boolean(analysis?.submittedAt) && !isReturned) || status === "Passed" || !canEdit;

  const saveDraft = async () => {
    if (!preferredLocation.trim()) throw new Error("Add the preferred location in Inquiry before saving this assessment.");
    const value = await api.leads.updateLocation(lead.id, {
      preferredLocation: preferredLocation.trim(),
      leaseOwnershipStatus: leaseOwnershipStatus || null,
      answers: answerList,
      notes: notes.trim() || null,
      expectedVersion: lead.version,
    });
    setAnalysis(value);
    setReviewNotes(value.reviewNotes ?? value.revisionReason ?? "");
    return value;
  };

  const saveAssessment = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await saveDraft();
      await onReload();
      onNotice({ message: "Location analysis draft saved.", tone: "success" });
    } catch (e) {
      onNotice({ message: errorMessage(e, "Unable to save the location analysis."), tone: "error" });
    } finally { setBusy(false); }
  };

  const submitForReview = async () => {
    if (answeredCount !== questionCount) {
      onNotice({ message: `Answer all ${questionCount} criteria before submitting.`, tone: "error" });
      return;
    }
    if (!leaseOwnershipStatus) {
      onNotice({ message: "Select the lease or ownership status before submitting.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      await saveDraft();
      const value = await api.leads.submitLocation(lead.id, { expectedVersion: lead.version });
      setAnalysis(value);
      await onReload();
      onNotice({ message: "Location analysis submitted for General Manager review.", tone: "success" });
    } catch (e) {
      onNotice({ message: errorMessage(e, "Unable to submit the location analysis."), tone: "error" });
    } finally { setBusy(false); }
  };

  const review = async (decision: "Approved" | "Returned") => {
    if (decision === "Returned" && !reviewNotes.trim()) {
      onNotice({ message: "Add a reason when returning the analysis for revision.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      await api.leads.evaluateLocation(lead.id, { decision, notes: reviewNotes.trim() || null, expectedVersion: lead.version });
      const value = await api.leads.location(lead.id);
      setAnalysis(value);
      await onReload();
      onNotice({ message: decision === "Approved" ? "Location analysis approved." : "Location analysis returned for revision.", tone: "success" });
    } catch (e) {
      onNotice({ message: errorMessage(e, "Unable to complete the location analysis review."), tone: "error" });
    } finally { setBusy(false); }
  };

  const responseCounts = ["YES_COMPLETELY", "YES_PARTIALLY", "NO", "DONT_KNOW"].map((code) => ({ code, count: answerList.filter((answer) => answer.response === code).length }));
  const attention = answerList.filter((answer) => answer.response === "NO" || answer.response === "YES_PARTIALLY");
  const nextGroup = locationAnalysisGroups.find((group) => locationAnalysisQuestions.filter((question) => question.group === group).some((question) => !answers[question.code]));

  return (
    <section className="location-analysis-shell">
      <div className="location-analysis-main">
        <div className="location-analysis-header">
          <div>
            <span className="eyebrow">LOCATION ANALYSIS</span>
            <h2>Evaluate the proposed franchise location</h2>
            <p>{lead.fullName} · {preferredLocation || "Location not provided"}</p>
          </div>
          <span className={`location-analysis-status ${status.toLowerCase()}`}>{status === "Returned" ? "Changes requested" : status}</span>
        </div>
        <div className="location-analysis-progress"><div><strong>{answeredCount} / {questionCount} answered</strong><span>{completion}% complete</span></div><div className="progress-track"><i style={{ width: `${completion}%` }} /></div></div>
        {!lead.preferredLocation && !analysis && <div className="location-analysis-callout"><AlertTriangle size={17} /> Add the proposed location in the Inquiry tab first, then return here to complete this assessment.</div>}
        <form onSubmit={saveAssessment}>
          <div className="location-analysis-meta">
            <label>
              Proposed franchise location <span className="required-mark"> *</span>
              <input
                value={preferredLocation}
                onChange={(event) => setPreferredLocation(event.target.value)}
                required
                maxLength={240}
                disabled={isReadOnly}
                placeholder="Street, barangay, city, province"
                aria-invalid={!preferredLocation.trim()}
                className={!preferredLocation.trim() ? "field-missing" : undefined}
              />
            </label>
            <label>Candidate<input value={analysis?.candidateName ?? lead.fullName} readOnly /></label>
            <label>Lease / ownership<select value={leaseOwnershipStatus} onChange={(e) => setLeaseOwnershipStatus(e.target.value)} disabled={isReadOnly}><option value="">Select status</option>{leaseOwnershipOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          {isReturned && <div className="location-analysis-review returned"><strong>Changes requested by General Manager</strong><p>{analysis?.revisionReason || "Review the feedback below and resubmit when ready."}</p></div>}
          <div className="location-analysis-groups">
            {locationAnalysisGroups.map((group) => {
              const groupQuestions = locationAnalysisQuestions.filter((question) => question.group === group);
              const groupAnswered = groupQuestions.filter((question) => answers[question.code]).length;
              return <details key={group} className="location-analysis-group" open={activeGroup === group} onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) setActiveGroup(group); }}>
                <summary><span><strong>{group}</strong><small>{groupAnswered} of {groupQuestions.length} answered</small></span><ChevronDown size={17} /></summary>
                <div className="location-analysis-question-list">
                  {groupQuestions.map((question, index) => {
                    const answer = answers[question.code];
                    return <fieldset className="location-question" key={question.code}><legend><span>{index + 1}. {question.prompt}</span>{question.hint && <small>{question.hint}</small>}</legend><div className="location-question-options">{Object.entries(locationAnalysisResponseLabels).map(([code, label]) => <label key={code} className={answer?.response === code ? "selected" : ""}><input type="radio" name={question.code} value={code} checked={answer?.response === code} onChange={() => setAnswers((current) => ({ ...current, [question.code]: { questionCode: question.code, response: code as LocationAnalysisAnswer["response"], remark: current[question.code]?.remark ?? null } }))} disabled={isReadOnly} />{label}</label>)}</div><label className="location-question-remark">Remark (optional)<textarea value={answer?.remark ?? ""} onChange={(e) => setAnswers((current) => { const existing = current[question.code]; return existing ? { ...current, [question.code]: { ...existing, remark: e.target.value } } : current; })} disabled={isReadOnly} maxLength={1000} placeholder="Add evidence, context, or a follow-up note" /></label></fieldset>;
                  })}
                </div>
              </details>;
            })}
          </div>
          <label className="location-analysis-notes">Overall assessment notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} disabled={isReadOnly} placeholder="Summarize important findings and risks." /></label>
          <p className="location-analysis-supporting"><FileText size={15} /> Add supporting photos or documents from the Documents tab.</p>
          {canEdit && !isReadOnly && <div className="location-analysis-actions"><button type="submit" className="button button-secondary" disabled={busy}>{busy ? "Saving…" : "Save draft"}</button><button type="button" className="button button-primary" disabled={busy || answeredCount !== questionCount || !leaseOwnershipStatus} onClick={submitForReview}><Send size={15} /> Submit for GM review</button></div>}
          {canReview && Boolean(analysis?.submittedAt) && status === "Pending" && <div className="location-analysis-review"><span className="eyebrow">GENERAL MANAGER REVIEW</span><h3>Review the completed assessment</h3><textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} maxLength={2000} placeholder="Add approval notes or explain what needs revision." /><div className="location-analysis-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => review("Returned")}>Return for revision</button><button type="button" className="button button-primary" disabled={busy} onClick={() => review("Approved")}><CheckCircle2 size={15} /> Approve analysis</button></div></div>}
          {status === "Passed" && <div className="location-analysis-finished"><CheckCircle2 size={17} /><div><strong>Location analysis passed</strong><p>{analysis?.evaluatedByName ? `Passed by ${analysis.evaluatedByName}.` : "The assessment is complete and read-only."}</p></div></div>}
          {!canEdit && !canReview && <div className="read-only-note"><ShieldCheck size={16} /> Location analysis is view-only for your role.</div>}
        </form>
      </div>
      <aside className="location-analysis-sidebar">
        <div className="location-analysis-summary"><span className="eyebrow">ASSESSMENT SUMMARY</span><strong>{completion}% complete</strong><p>{answeredCount} of {questionCount} criteria answered</p><div className="location-response-counts">{responseCounts.map((item) => <div key={item.code}><span className={`response-dot ${item.code.toLowerCase()}`} />{locationAnalysisResponseLabels[item.code]}<strong>{item.count}</strong></div>)}<div><span className="response-dot unanswered" />Unanswered<strong>{questionCount - answeredCount}</strong></div></div></div>
        {attention.length > 0 && <div className="location-analysis-attention"><span className="eyebrow">ITEMS REQUIRING ATTENTION</span>{attention.slice(0, 4).map((answer) => <div key={answer.questionCode}><AlertTriangle size={14} /><span>{locationAnalysisQuestions.find((question) => question.code === answer.questionCode)?.prompt}</span></div>)}</div>}
        <div className="location-analysis-next"><span className="eyebrow">NEXT</span><strong>{analysis?.submittedAt && status === "Pending" ? "Awaiting General Manager review" : status === "Passed" ? "Assessment passed" : nextGroup ? `Complete ${nextGroup}` : "Ready to submit"}</strong><p>{status === "Failed" ? "Update the requested items and submit again." : "Responses are saved as a draft until submitted."}</p></div>
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
  compactAfterUpload = false,
  documentCard = false,
  hideEmptyState = false,
}: {
  lead: Pick<Lead, "id">;
  onNotice: (notice: Notice) => void;
  onDocumentsChanged?: () => Promise<void>;
  embedded?: boolean;
  fixedDocumentType?: string;
  visibleTypes?: string[];
  hideUpload?: boolean;
  collapsible?: boolean;
  uploadedOnly?: boolean;
  compactAfterUpload?: boolean;
  documentCard?: boolean;
  hideEmptyState?: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState(
    fixedDocumentType ?? "VALID_ID_SIGNATURES",
  );
  const [busy, setBusy] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const canUpload =
    fixedDocumentType === "PAYMENT_RECEIPT"
      ? hasRole(session.user?.role, ["SalesAgent", "GeneralManager"])
      : hasRole(session.user?.role, ["SalesAgent", "GeneralManager"]);
  const uploadOptions: [string, string][] = [
    ...(hasRole(session.user?.role, ["Finance"])
      ? [["PAYMENT_RECEIPT", "Payment receipt or bank confirmation"] as [string, string]]
      : []),
    ...(hasRole(session.user?.role, ["SalesAgent"])
      ? [["VALID_ID_SIGNATURES", "Valid ID + 3 specimen signatures"] as [string, string]]
      : []),
    ...(hasRole(session.user?.role, ["GeneralManager"])
      ? ([
          ["FLOOR_PLAN", "Floor plan"],
          ["PERSPECTIVE", "Perspective"],
          ["SIGNED_CONTRACT", "Signed contract"],
        ] as [string, string][])
      : []),
  ];
  const typeFilteredDocuments = visibleTypes?.length
    ? documents.filter((item) => visibleTypes.includes(item.documentType))
    : documents;
  const uploadedDocuments = typeFilteredDocuments.filter(
    (item) => item.status === "Uploaded",
  );
  const compactMode = compactAfterUpload && uploadedDocuments.length > 0 && !replaceMode;
  const displayedDocuments = uploadedOnly || compactMode
    ? uploadedDocuments
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
        headers: {
          "Content-Type": intent.requiredContentType,
          // The API signs S3 uploads with explicit AES-256 server-side encryption.
          // S3 requires this header on the actual PUT as well as in the signature.
          "x-amz-server-side-encryption": "AES256",
        },
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
      if (replaceMode) {
        await Promise.all(uploadedDocuments.map((item) => api.leads.archiveDocument(lead.id, item.id)));
      }
      setFile(null);
      setReplaceMode(false);
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
      {canUpload && !hideUpload && !compactMode ? (
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
      ) : !hideUpload && !compactMode ? (
        <div className="read-only-note">
          <ShieldCheck size={16} /> Documents are view-only for your role.
        </div>
      ) : null}
      {loading ? (
        <Loading />
      ) : displayedDocuments.length ? (
        documentCard && uploadedDocuments.length > 0 && !replaceMode ? (
          <div className="contract-uploaded-files">
            {uploadedDocuments.map((item) => (
              <div className="contract-uploaded-file" key={item.id}>
                <div className="contract-uploaded-file-main">
                  <div className="document-icon"><FileText size={17} /></div>
                  <div>
                    <strong>{item.fileName}</strong>
                    <span>Uploaded {formatDate(item.createdAt)}</span>
                  </div>
                </div>
                <div className="contract-uploaded-file-actions">
                  <button type="button" className="text-link" onClick={() => download(item)}>{documentCard ? "View file" : "View"} <ArrowUpRight size={13} /></button>
                  {canUpload && !hideUpload && <button type="button" className="text-link muted-link" onClick={() => setReplaceMode(true)}>Replace</button>}
                </div>
              </div>
            ))}
          </div>
        ) : collapsible || compactMode ? (
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
                  <span>{documentTypeLabel(item.documentType)} · {Math.ceil(item.sizeBytes / 1024)} KB · {statusLabel(item.status)}</span>
                </div>
                <button className="text-link" onClick={() => download(item)}>
                  View <ArrowUpRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      ) : hideEmptyState ? null : (
        <EmptyState
          icon={FileText}
          title={
            fixedDocumentType === "PAYMENT_RECEIPT"
              ? "No payment evidence attached"
              : fixedDocumentType === "FLOOR_PLAN"
                ? "No floor plan uploaded"
              : fixedDocumentType === "PERSPECTIVE"
                ? "No perspective uploaded"
                : fixedDocumentType
                  ? `No ${documentTypeLabel(fixedDocumentType)} uploaded`
                : "No documents yet"
          }
          text={
            fixedDocumentType === "PAYMENT_RECEIPT"
              ? "The Sales Agent attaches a receipt screenshot, bank confirmation, or PDF before Finance verification."
              : fixedDocumentType === "FLOOR_PLAN"
                ? "Upload the floor plan required before the contract is submitted for GM review."
              : fixedDocumentType === "PERSPECTIVE"
                ? "Upload the site perspective required before the contract is submitted for GM review."
                : fixedDocumentType
                  ? `Upload the ${documentTypeLabel(fixedDocumentType)} required for this pre-launch requirement.`
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
            value={statusLabel(String(payment?.status ?? "NotStarted"))}
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
  const [contractDocuments, setContractDocuments] = useState<DocumentItem[]>([]);
  const [checklist, setChecklist] = useState<ReviewChecklist | null>(null);
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [template, setTemplate] = useState("STANDARD_FRANCHISE");
  const [notes, setNotes] = useState("");
  const [franchiseeName, setFranchiseeName] = useState("");
  const [drCareName, setDrCareName] = useState("");
  const [franchiseeEmail, setFranchiseeEmail] = useState(lead.email);
  const [drCareEmail, setDrCareEmail] = useState(session.user?.email ?? "");
  const [signingRequests, setSigningRequests] = useState<SigningRequest[]>([]);
  const [signingLinks, setSigningLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const canDraft = hasRole(session.user?.role, ["SalesAgent", "GeneralManager"]);
  const canReview = hasRole(session.user?.role, ["GeneralManager"]);
  const canSign = hasRole(session.user?.role, ["SalesAgent", "GeneralManager"]);
  const canEditDraft =
    canDraft &&
    (!contract ||
      contract.status === "Draft" ||
      contract.status === "RevisionRequested");
  const canChecklist = canReview && contract?.status === "InReview";
  const reviewFinished =
    canReview && Boolean(contract && ["Approved", "Signed"].includes(contract.status));
  const reload = async () => {
    try {
      const next = await api.leads.contract(lead.id);
      setContract(next);
      setTemplate(next.templateCode || "STANDARD_FRANCHISE");
      onContractChange?.(next);
      const nextChecklist = await api.leads.contractChecklist(lead.id);
      setChecklist(nextChecklist as ReviewChecklist);
      setChecklistDirty(false);
      const nextDocuments = await api.leads.documents(lead.id);
      setContractDocuments(nextDocuments);
      const requests = await api.leads.signingRequests(lead.id);
      setSigningRequests(requests);
      const active = requests.filter((item) => ["Pending", "Viewed"].includes(item.status));
      const franchisee = active.find((item) => item.signerRole === "franchisee");
      const drCare = active.find((item) => item.signerRole === "dr-care");
      if (franchisee) { setFranchiseeName((value) => value || franchisee.signerName); setFranchiseeEmail((value) => value || franchisee.signerEmail); }
      if (drCare) { setDrCareName((value) => value || drCare.signerName); setDrCareEmail((value) => value || drCare.signerEmail); }
    } catch {
      setContract(null);
      onContractChange?.(null);
      setChecklist(null);
      setContractDocuments([]);
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
  const toggleChecklist = (itemId: string) => {
    setChecklistDirty(true);
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
  };
  const approveContract = () => {
    if (!checklist?.complete) return;
    return run(async () => {
      await api.leads.updateContractChecklist(lead.id, {
        leadId: lead.id,
        items: checklist.items,
        complete: checklist.complete,
        expectedVersion: lead.version,
      });
      await api.leads.approveContract(lead.id, {
        notes: notes || "Approved",
        expectedVersion: lead.version,
      });
    }, "Checklist saved and contract approved.");
  };
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
    if (signerEmail.trim().toLowerCase().endsWith(".local")) {
      onNotice({ message: "Use a real inbox for electronic signing. Development .local addresses cannot receive the secure email.", tone: "error" });
      return;
    }
    return run(async () => {
      const created = await api.leads.createSigningRequest(lead.id, {
        signerRole: role,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim(),
        expiresInDays: 7,
      });
      if (created.signingUrl) {
        const absoluteUrl = new URL(created.signingUrl, window.location.origin).toString();
        setSigningLinks((current) => ({ ...current, [created.id]: absoluteUrl }));
        await navigator.clipboard.writeText(absoluteUrl).catch(() => undefined);
      }
    }, "Secure signing email queued. The new link is available below and was copied when browser permission allowed it.");
  };
  const copySigningLink = async (requestId: string) => {
    const link = signingLinks[requestId]; if (!link) return;
    try { await navigator.clipboard.writeText(link); onNotice({ message: "Signing link copied.", tone: "success" }); }
    catch { onNotice({ message: "The browser blocked clipboard access. Open the link and copy it from the address bar.", tone: "error" }); }
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
  const activeFranchiseeRequest = signingRequests.find((item) => item.signerRole === "franchisee" && ["Pending", "Viewed"].includes(item.status));
  const activeDrCareRequest = signingRequests.find((item) => item.signerRole === "dr-care" && ["Pending", "Viewed"].includes(item.status));
  const drCareEmailUnreachable = drCareEmail.trim().toLowerCase().endsWith(".local");
  const requiredContractDocuments = ["FLOOR_PLAN", "PERSPECTIVE"];
  const uploadedContractDocuments = requiredContractDocuments.filter((type) => contractDocuments.some((item) => item.documentType === type && item.status === "Uploaded"));
  const contractDocumentsComplete = uploadedContractDocuments.length === requiredContractDocuments.length;
  const contractPrerequisites = [
    !lead.address?.trim() ? "franchisee address" : null,
    !lead.preferredLocation?.trim() ? "proposed franchise site" : null,
  ].filter((item): item is string => Boolean(item));
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
          <>
          {(() => {
            const lifecycleStep = contract.status === "RevisionRequested"
              ? 2
              : contract.status === "InReview"
                ? 3
                : contract.status === "Signed"
                  ? 5
                  : contract.status === "Approved"
                    ? 4
                  : contractDocumentsComplete
                    ? 1
                    : 0;
            const lifecycleLabels = contract.status === "RevisionRequested"
              ? ["Draft created", "Documents ready", "Returned for revision", "Resubmit review", "E-signing"]
              : ["Draft created", "Documents ready", "GM review", "Review outcome", "E-signing"];
            return (
              <div className="contract-lifecycle-stepper" aria-label="Contract progress">
                {lifecycleLabels.map((label, index) => (
                  <div className={`contract-lifecycle-step ${index < lifecycleStep ? "complete" : index === lifecycleStep ? "active" : "upcoming"}`} key={label}>
                    <span>{index < lifecycleStep ? <CheckCircle2 size={13} /> : index + 1}</span>
                    <strong>{label}</strong>
                    {index < lifecycleLabels.length - 1 && <i />}
                  </div>
                ))}
              </div>
            );
          })()}
          {contract.status === "RevisionRequested" && (
            <div className="revision-request-card" role="status">
              <AlertTriangle size={20} />
              <div>
                <span className="eyebrow">RETURNED BY GENERAL MANAGER</span>
                <strong>Contract changes are required</strong>
                <p>{contract.revisionReason || "The General Manager requested changes to this contract."}</p>
                <small>
                  {contract.revisionRequestedAt
                    ? `Returned ${formatDateTime(contract.revisionRequestedAt)}`
                    : "Returned for revision"}
                  {" · Update or regenerate the agreement, then submit it for review again."}
                </small>
              </div>
              <div className="revision-request-actions">
                <button className="button button-secondary" onClick={openContract}><FileText size={14} /> Open contract</button>
                {canEditDraft && <button className="button button-secondary" disabled={busy} onClick={() => run(() => api.leads.generateContract(lead.id, { templateCode: template, version: "2026.07", expectedVersion: lead.version }), "Contract regenerated.")}><RefreshCw size={14} /> Regenerate</button>}
              </div>
            </div>
          )}
          <div className={`contract-generated-summary ${contract.status === "RevisionRequested" ? "revision-pending" : ""}`}>
            <div className="contract-generated-heading">
              <span className="contract-generated-icon">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <div className="contract-status-badge">
                  {contract.status === "RevisionRequested" ? "Changes requested" : "Generated"}
                </div>
                <strong>{contractTemplateLabel(contract.templateCode)}</strong>
                <small>
                  Version {contract.version} · Generated {formatDate(contract.updatedAt)}
                </small>
              </div>
            </div>
            {contract.status !== "RevisionRequested" && <div className="button-row">
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
                          version: "2026.07",
                          expectedVersion: lead.version,
                        }),
                      "Contract regenerated.",
                    )
                  }
                >
                  Regenerate
                </button>
              )}
            </div>}
          </div>
          </>
        )}
        {!contract && canEditDraft && (
          <>
            {contractPrerequisites.length > 0 && (
              <div className="callout">
                Add the {contractPrerequisites.join(" and ")} before generating the agreement. These details are optional while creating a new lead, but required for the contract.
              </div>
            )}
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
                        version: "2026.07",
                        expectedVersion: lead.version,
                      }),
                    contract ? "Contract regenerated." : "Contract generated.",
                  )
                }
              >
                Generate contract <ChevronRight size={15} />
              </button>
            </div>
          </>
        )}
        {!canEditDraft && !contract && (
          <div className="read-only-note">
            <ShieldCheck size={16} /> Contract drafting is available to
            the agreement after payment is confirmed.
          </div>
        )}
        {contract && (
          <>
            <details className="contract-workflow-disclosure">
              <summary>
                <span><CircleHelp size={15} /> <strong>How contract review works</strong></span>
                <span className="contract-workflow-steps">1) Draft and submit · 2) GM reviews · 3) Secure e-signing <ChevronDown size={15} /></span>
              </summary>
              <div className="contract-workflow-details">
                <span>1. Sales Agent drafts the agreement and submits it for review.</span>
                <span>2. The General Manager completes the review checklist and approves or requests revisions.</span>
                <span>3. The Sales Agent creates secure e-signing links for both parties.</span>
              </div>
            </details>
            {contract.status === "RevisionRequested" && (
              <div className="contract-feedback-card">
                <div className="contract-feedback-heading">
                  <div>
                    <strong>General Manager feedback</strong>
                    <span>Please address the following before resubmitting.</span>
                  </div>
                  <span className="contract-feedback-requester"><span className="contract-avatar">GM</span> Requested by <strong>{contract.revisionRequestedByName || "General Manager"}</strong></span>
                </div>
                <div className="contract-revision-reason">
                  <span className="contract-feedback-icon"><CircleHelp size={17} /></span>
                  <div>
                    <span className="contract-revision-reason-label">Revision reason</span>
                    <p>{contract.revisionReason || "The General Manager requested changes to this contract."}</p>
                  </div>
                </div>
                <div className="contract-feedback-next">
                  <strong>Before you resubmit</strong>
                  <span>Review the reason, update the agreement and required documents, then explain what changed in the resubmission notes below.</span>
                </div>
              </div>
            )}
            {canEditDraft && ["Draft", "RevisionRequested"].includes(contract.status) && (
              <div className="contract-supporting-documents">
                <div className="contract-section-heading">
                  <div>
                    <strong>Required drafting documents</strong>
                    <span>Upload both files before submitting the agreement for GM review.</span>
                  </div>
                  <strong className="contract-completion-count">
                    {contractDocumentsComplete ? <CheckCircle2 size={15} /> : <span className="contract-count-dot" />}
                    {uploadedContractDocuments.length} of {requiredContractDocuments.length} complete
                  </strong>
                </div>
                <div className="contract-document-grid">
                  <div>
                    <div className={`contract-document-label ${uploadedContractDocuments.includes("FLOOR_PLAN") ? "complete" : "pending"}`}>
                      {uploadedContractDocuments.includes("FLOOR_PLAN") ? <CheckCircle2 size={15} /> : <span className="contract-check-pending" />} <strong>Floor plan</strong>
                    </div>
                    <DocumentsPanel
                      lead={lead}
                      onNotice={onNotice}
                      onDocumentsChanged={reload}
                      embedded
                      fixedDocumentType="FLOOR_PLAN"
                      visibleTypes={["FLOOR_PLAN"]}
                      compactAfterUpload
                      documentCard
                    />
                  </div>
                  <div>
                    <div className={`contract-document-label ${uploadedContractDocuments.includes("PERSPECTIVE") ? "complete" : "pending"}`}>
                      {uploadedContractDocuments.includes("PERSPECTIVE") ? <CheckCircle2 size={15} /> : <span className="contract-check-pending" />} <strong>Perspective</strong>
                    </div>
                    <DocumentsPanel
                      lead={lead}
                      onNotice={onNotice}
                      onDocumentsChanged={reload}
                      embedded
                      fixedDocumentType="PERSPECTIVE"
                      visibleTypes={["PERSPECTIVE"]}
                      compactAfterUpload
                      documentCard
                    />
                  </div>
                </div>
              </div>
            )}
            {canEditDraft && ["Draft", "RevisionRequested"].includes(contract.status) && (
              <div className="contract-review-submit-card">
                <div className="contract-review-submit-heading">
                  <div>
                    <strong>{contract.status === "RevisionRequested" ? "Address requested changes" : "Ready for GM review"}</strong>
                    <span>{contract.status === "RevisionRequested" ? "Update the agreement and explain what changed before resubmitting." : "Everything looks good. Add optional notes and submit for GM review."}</span>
                  </div>
                </div>
                <div className="contract-review-submit-body">
                  <div className="contract-review-checks">
                    <span><CheckCircle2 size={15} /> Contract generated</span>
                    <span className={uploadedContractDocuments.includes("FLOOR_PLAN") ? "" : "pending"}>{uploadedContractDocuments.includes("FLOOR_PLAN") ? <CheckCircle2 size={15} /> : <span className="contract-check-pending" />} Floor plan {uploadedContractDocuments.includes("FLOOR_PLAN") ? "uploaded" : "pending"}</span>
                    <span className={uploadedContractDocuments.includes("PERSPECTIVE") ? "" : "pending"}>{uploadedContractDocuments.includes("PERSPECTIVE") ? <CheckCircle2 size={15} /> : <span className="contract-check-pending" />} Perspective {uploadedContractDocuments.includes("PERSPECTIVE") ? "uploaded" : "pending"}</span>
                  </div>
                  <label className="wide-label">
                    Resubmission notes {contract.status === "Draft" ? "(optional)" : ""}
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={4000}
                      placeholder="Tell the General Manager what was changed"
                    />
                  </label>
                </div>
                <div className="contract-review-submit-actions">
                  <span><ShieldCheck size={14} /> Secure and auditable</span>
                  <button className="button button-primary" disabled={busy} onClick={submitContractForReview}>
                    <Send size={15} /> Submit for GM review
                  </button>
                </div>
              </div>
            )}
            {canChecklist && (
              <label className="wide-label">
                Revision reason or approval notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={4000}
                  placeholder="Explain any required changes before returning the contract"
                />
              </label>
            )}
            {reviewFinished && (
              <div className="completion-card">
                <CheckCircle2 size={19} />
                <div>
                  <strong>Contract review complete</strong>
                  <span>
                    The General Manager approved this contract. The checklist is
                    locked as the review record, and the Sales Agent owns the signing
                    step from here.
                  </span>
                </div>
              </div>
            )}
            {canReview && checklist && (
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
                        {item.required ? "Required" : "Optional"}
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
                    {checklistDirty ? "Save review checklist" : "Checklist saved"}
                  </button>
                )}
              </div>
            )}
            {canChecklist && (
              <div className="button-row">
                <button
                  className="button button-primary"
                  disabled={
                    busy ||
                    contract.status !== "InReview" ||
                    !checklist?.complete
                  }
                  onClick={approveContract}
                >
                  Save checklist & approve
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy || contract.status !== "InReview" || notes.trim().length < 2}
                  onClick={() =>
                    run(
                      () =>
                        api.leads.requestRevision(lead.id, {
                          reason: notes.trim(),
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
            {canChecklist &&
              !checklist?.complete &&
              (
                <div className="read-only-note">
                  <ShieldCheck size={16} /> Complete every required review item
                  before approving. Approval saves the latest checklist first.
                </div>
              )}
            {canChecklist && contract.status === "InReview" && notes.trim().length < 2 && (
              <div className="read-only-note">
                <AlertTriangle size={16} /> Enter a clear reason above before returning the contract for revision.
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
                      {activeFranchiseeRequest ? "Send replacement franchisee link" : "Create franchisee signing link"}
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
                      aria-invalid={drCareEmailUnreachable}
                      className={drCareEmailUnreachable ? "field-missing" : undefined}
                    />
                    {drCareEmailUnreachable && <small className="field-error">Use a real inbox. Development .local addresses cannot receive signing emails.</small>}
                    <button
                      className="button button-secondary"
                      disabled={busy || Boolean(contract.drCareSignerName)}
                      onClick={() =>
                        requestSignature("dr-care", drCareName, drCareEmail)
                      }
                    >
                      {activeDrCareRequest ? "Send replacement Dr. Care link" : "Create Dr. Care signing link"}
                    </button>
                  </label>
                </div>
                {signingRequests.some((item) => item.status !== "Voided") && (
                  <div className="signing-request-list">
                    {signingRequests.filter((item) => item.status !== "Voided").map((item) => {
                      const active = ["Pending", "Viewed"].includes(item.status);
                      const link = signingLinks[item.id];
                      return <div className="signing-request-row" key={item.id}>
                        <ShieldCheck size={17} />
                        <div className="signing-request-copy"><strong>{item.signerName}</strong><span>{item.signerRole === "dr-care" ? "Dr. Care signer" : "Franchisee signer"} · {item.signerEmail}</span><small>{statusLabel(item.status)} · {item.emailQueued ? "Invitation email queued" : "Invitation was not emailed — send a new link"} · Expires {formatDate(item.expiresAt)}</small></div>
                        <div className="signing-request-actions">
                          {link && <><button className="button button-secondary" onClick={() => copySigningLink(item.id)}><Copy size={14} /> Copy link</button><a className="button button-primary" href={link} target="_blank" rel="noreferrer">Open link <ArrowUpRight size={14} /></a></>}
                          {active && !link && <button className="button button-secondary" disabled={busy} onClick={() => {
                            if (item.signerEmail.toLowerCase().endsWith(".local")) { setDrCareName(item.signerName); setDrCareEmail(""); onNotice({ message: "Enter a real Dr. Care signer inbox above, then send the replacement link.", tone: "error" }); return; }
                            void requestSignature(item.signerRole as "franchisee" | "dr-care", item.signerName, item.signerEmail);
                          }}>{item.signerEmail.toLowerCase().endsWith(".local") ? "Change email" : "Send new link"}</button>}
                          {active && <button className="button button-secondary signing-cancel" disabled={busy} onClick={() => run(() => api.leads.voidSigningRequest(lead.id, item.id), "Signing request cancelled.")}>Cancel</button>}
                        </div>
                      </div>;
                    })}
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

type PreLaunchFilter = "all" | "incomplete" | "blocked" | "completed";
type PreLaunchChecklistItem = {
  id: string;
  code: string;
  name: string;
  required: boolean;
  complete: boolean;
  paused: boolean;
  notes?: string;
  completedAt?: string;
};

const preLaunchCategoryDefinitions = [
  { key: "site", label: "Site & Compliance", description: "Location, permits, lease, and site requirements." },
  { key: "business", label: "Business & Finance", description: "Commercial, payment, and financial readiness." },
  { key: "clinical", label: "Clinical & Staffing", description: "Staff assignments, credentials, and training." },
  { key: "operations", label: "Operations", description: "Inventory, receipts, and operating setup." },
  { key: "launch", label: "Launch Preparation", description: "Final coordination and opening readiness." },
] as const;

const preLaunchCategoryCodes: Record<string, string[]> = {
  site: ["DOH_FLOOR_PLAN", "LOCATION_ANALYSIS", "LEASE_AND_ADDRESS", "PERMITS", "SIGNAGE_AND_COMPLIANCE", "PHARMACY_PERMITS", "PHARMACY_SITE_READY"],
  business: ["BUSINESS_PROPOSAL", "FINANCING_PLAN", "BANK_DETAILS", "FULL_PAYMENT", "BUSINESS_PLAN", "OFFICIAL_RECEIPT"],
  clinical: ["CLINICAL_STAFF", "CLINICAL_CREDENTIALS", "ANIMAL_BITE_TRAINING", "TRAINING_APPLICATION", "PHARMACY_STAFF", "PHARMACY_TRAINING"],
  operations: ["VALID_ID_TIN", "ACKNOWLEDGEMENT_RECEIPT", "DTI_REGISTRATION", "SITE_PHOTOS", "ABC_PRELAUNCH_CHECKLIST", "OPENING_STOCKS", "INVENTORY_PLAN", "PHARMACY_PRELAUNCH_CHECKLIST", "PHARMACY_OPENING_STOCKS"],
  launch: ["APPLICATION_FORM", "PRELAUNCH_MEETING", "LEAD_TIME", "GRAND_OPENING", "FRANCHISE_AGREEMENT"],
};

const preLaunchDocumentCodes = new Set([
  "DOH_FLOOR_PLAN", "LEASE_AND_ADDRESS", "DTI_REGISTRATION", "SITE_PHOTOS", "PERMITS",
  "BUSINESS_PLAN", "VALID_ID_TIN", "FRANCHISE_AGREEMENT", "TRAINING_APPLICATION", "PHARMACY_PERMITS",
]);

function preLaunchCategoryFor(code: string) {
  const normalized = code.trim().toUpperCase();
  return preLaunchCategoryDefinitions.find((category) => preLaunchCategoryCodes[category.key].includes(normalized)) ?? preLaunchCategoryDefinitions.at(-1)!;
}

function preLaunchBlockedReason(item: PreLaunchChecklistItem) {
  if (item.code.trim().toUpperCase() === "ANIMAL_BITE_TRAINING") return "Waiting for a qualified doctor or nurse to be assigned.";
  return "Waiting for the prerequisite to be completed.";
}

function preLaunchItemMeta(item: PreLaunchChecklistItem, categoryLabel: string) {
  if (item.paused) return { label: "Blocked", detail: preLaunchBlockedReason(item), tone: "blocked" };
  if (item.complete) return { label: "Completed", detail: item.completedAt ? `Completed ${formatDate(item.completedAt)}` : "Requirement completed", tone: "complete" };
  if (preLaunchDocumentCodes.has(item.code.trim().toUpperCase())) return { label: "Required document", detail: `Not uploaded · ${categoryLabel}`, tone: "pending" };
  if (["CLINICAL_STAFF", "PHARMACY_STAFF"].includes(item.code.trim().toUpperCase())) return { label: "Required", detail: "Not assigned", tone: "pending" };
  return { label: item.required ? "Required" : "Optional", detail: `Not completed · ${categoryLabel}`, tone: "pending" };
}

function documentRequirementsCount(items: PreLaunchChecklistItem[], completedOnly: boolean) {
  return items.filter((item) => preLaunchDocumentCodes.has(item.code.trim().toUpperCase()) && (!completedOnly || item.complete)).length;
}

function PreLaunchDocumentRequirement({
  lead,
  item,
  onNotice,
  onDocumentsChanged,
}: {
  lead: Lead;
  item: PreLaunchChecklistItem;
  onNotice: (notice: Notice) => void;
  onDocumentsChanged?: () => Promise<void>;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const documentType = item.code.trim().toUpperCase();
  const uploadedDocuments = documents.filter(
    (document) => document.documentType.trim().toUpperCase() === documentType && document.status === "Uploaded",
  );
  const pendingDocuments = documents.filter(
    (document) => document.documentType.trim().toUpperCase() === documentType && document.status !== "Archived" && document.status !== "Uploaded",
  );
  const reload = async () => {
    setLoading(true);
    try {
      setDocuments(await api.leads.documents(lead.id));
    } catch (e) {
      onNotice({ message: errorMessage(e, "Unable to load the required document."), tone: "error" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, [lead.id, documentType]);
  const handleDocumentsChanged = async () => {
    await reload();
    await onDocumentsChanged?.();
  };
  const statusLabel = loading
    ? "Checking file status…"
    : uploadedDocuments.length
      ? `${uploadedDocuments.length} file${uploadedDocuments.length === 1 ? "" : "s"} uploaded`
      : pendingDocuments.length
        ? "Upload in progress"
        : "No file uploaded yet";
  return (
    <div className="prelaunch-document-requirement">
      <div className="prelaunch-document-summary">
        <span className="prelaunch-document-summary-icon"><FileText size={14} /></span>
        <span className="prelaunch-document-summary-copy">
          <strong>Required document</strong>
          <small>{statusLabel} · {documentTypeLabel(documentType)}</small>
        </span>
        <button
          type="button"
          className="text-link prelaunch-document-toggle"
          onClick={() => setExpanded((current) => !current)}
        >
          {uploadedDocuments.length ? "Manage file" : "Upload document"}
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      {expanded && (
        <div className="prelaunch-document-editor">
          <DocumentsPanel
            lead={lead}
            onNotice={onNotice}
            onDocumentsChanged={handleDocumentsChanged}
            embedded
            fixedDocumentType={documentType}
            visibleTypes={[documentType]}
            compactAfterUpload
            documentCard
          />
        </div>
      )}
    </div>
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
    items: PreLaunchChecklistItem[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [nurseOrDoctorAvailable, setNurseOrDoctorAvailable] = useState(false);
  const [signedContractReviewed, setSignedContractReviewed] = useState(false);
  const [filter, setFilter] = useState<PreLaunchFilter>("all");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const itemOrder = useRef<string[]>([]);
  const canComplete = hasRole(session.user?.role, marketingWriteRoles);
  const reload = () =>
    api.leads
      .preLaunch(lead.id)
      .then((value) => setChecklist(value as typeof checklist))
      .catch(() => setChecklist(null));
  useEffect(() => {
    setFilter("all");
    setOpenCategories({});
    itemOrder.current = [];
    setSignedContractReviewed(false);
    void reload();
  }, [lead.id]);
  useEffect(() => {
    if (!checklist) return;
    const ids = checklist.items.map((item) => item.id);
    const current = new Set(itemOrder.current);
    itemOrder.current = [
      ...itemOrder.current.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !current.has(id)),
    ];
  }, [checklist]);
  const openSignedContract = async () => {
    try {
      const result = await api.leads.contractDownload(lead.id);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      onNotice({ message: errorMessage(e, "Unable to open the signed agreement."), tone: "error" });
    }
  };
  const initialize = async () => {
    setBusy(true);
    try {
      await api.leads.initializePreLaunch(lead.id, nurseOrDoctorAvailable, signedContractReviewed);
      onNotice({
        message: lead.state === "ContractSigned"
          ? "Signed agreement reviewed and pre-launch started."
          : "Product-specific checklist initialized.",
        tone: "success",
      });
      await reload();
      await onReload();
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
      await onReload();
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
  // The API does not guarantee collection ordering after an update. Keep the
  // first-seen order so checking an item never makes the checklist jump around.
  const checklistItems = [...(checklist?.items ?? [])].sort((left, right) => {
    const leftIndex = itemOrder.current.indexOf(left.id);
    const rightIndex = itemOrder.current.indexOf(right.id);
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
  const totalItems = checklistItems.length;
  const completedItems = checklistItems.filter((item) => item.complete).length;
  const blockedItems = checklistItems.filter((item) => item.paused);
  const remainingItems = totalItems - completedItems;
  const completionPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
  const filterCounts = {
    all: totalItems,
    incomplete: checklistItems.filter((item) => !item.complete).length,
    blocked: blockedItems.length,
    completed: completedItems,
  };
  const matchesFilter = (item: PreLaunchChecklistItem) =>
    filter === "all" || (filter === "completed" ? item.complete : filter === "blocked" ? item.paused : !item.complete);
  const groupedCategories = preLaunchCategoryDefinitions
    .map((definition, index) => ({
      ...definition,
      index,
      items: checklistItems.filter((item) => matchesFilter(item) && preLaunchCategoryFor(item.code).key === definition.key),
      allItems: checklistItems.filter((item) => preLaunchCategoryFor(item.code).key === definition.key),
    }))
    .filter((category) => category.items.length > 0);
  const firstIncomplete = blockedItems[0] ?? checklistItems.find((item) => !item.complete);
  const requiredIncomplete = checklistItems.some((item) => item.required && !item.complete);
  const nextCategory = firstIncomplete ? preLaunchCategoryFor(firstIncomplete.code) : null;
  const focusBlocked = () => {
    setFilter("blocked");
    if (blockedItems[0]) setOpenCategories((current) => ({ ...current, [preLaunchCategoryFor(blockedItems[0].code).key]: true }));
  };
  return (
    <>
    <section className="panel tab-panel">
      <PanelHeader
        title={lead.state === "ContractSigned" ? "Review signed agreement" : "Pre-launch readiness"}
        subtitle={lead.state === "ContractSigned"
          ? "Both parties have signed. Review the final agreement before starting pre-launch."
          : "ABC checklists include the required animal-bite training item."}
      />
      {!checklist ? (
        canComplete ? (
          <div className="empty-feature">
            {lead.state === "ContractSigned" ? (
              <div className="signed-contract-review-card">
                <div className="signed-contract-review-icon"><FileText size={22} /></div>
                <div>
                  <strong>Signed agreement ready for review</strong>
                  <span>Open the final PDF and confirm that you reviewed it before starting the pre-launch checklist.</span>
                </div>
                <button className="button button-secondary" onClick={openSignedContract}>
                  <FileText size={14} /> Open signed agreement
                </button>
              </div>
            ) : (
              <div className="empty-feature-icon">
                <ClipboardCheck size={25} />
              </div>
            )}
            <h2>{lead.state === "ContractSigned" ? "Start pre-launch when ready" : "Start the readiness checklist"}</h2>
            <p>
              {lead.state === "ContractSigned"
                ? "Starting pre-launch is a separate step so the signed agreement can be reviewed first."
                : "Initialize the checklist to load the product-specific launch requirements."}
            </p>
            {lead.state === "ContractSigned" && (
              <label className="signature-consent signed-contract-review-confirmation">
                <input
                  type="checkbox"
                  checked={signedContractReviewed}
                  onChange={(e) => setSignedContractReviewed(e.target.checked)}
                /> I reviewed the fully signed agreement and it is ready for pre-launch.
              </label>
            )}
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
              disabled={busy || (lead.state === "ContractSigned" && !signedContractReviewed)}
            >
              {lead.state === "ContractSigned" ? "Start pre-launch" : "Initialize checklist"}
            </button>
          </div>
        ) : (
          lead.state === "ContractSigned" ? (
            <div className="signed-contract-review-card signed-contract-review-card-readonly">
              <div className="signed-contract-review-icon"><FileText size={22} /></div>
              <div>
                <strong>Signed agreement ready for review</strong>
                <span>Review the final agreement before the Sales Agent or General Manager starts pre-launch.</span>
              </div>
              <button className="button button-secondary" onClick={openSignedContract}>
                <FileText size={14} /> Open signed agreement
              </button>
            </div>
          ) : (
            <div className="read-only-note">
              <ShieldCheck size={16} /> The readiness checklist has not been
              initialized.
            </div>
          )
        )
      ) : (
        <div className="prelaunch-readiness-layout">
          <div className="prelaunch-checklist-main">
            <div className="prelaunch-readiness-header">
              <div>
                <span className="eyebrow">PRE-LAUNCH READINESS</span>
                <h2>Everything required before handoff and opening.</h2>
                <span>{statusLabel(checklist.status)} · {totalItems} requirements tracked</span>
              </div>
              <div className="prelaunch-readiness-percent">
                <strong>{completionPercent}%</strong>
                <span>{completedItems} of {totalItems} completed</span>
              </div>
            </div>
            <div className="prelaunch-progress-track" aria-label={`${completionPercent}% complete`}>
              <i style={{ width: `${completionPercent}%` }} />
            </div>
            <div className="prelaunch-readiness-stats">
              <span>{remainingItems} remaining</span>
              <span>{blockedItems.length} blocked</span>
              <span>{completedItems} completed</span>
            </div>

            {blockedItems.length > 0 && (
              <div className="prelaunch-blocker-callout" role="status">
                <span className="prelaunch-blocker-icon"><AlertTriangle size={17} /></span>
                <div>
                  <strong>{blockedItems.length} item{blockedItems.length === 1 ? " is" : "s are"} blocked</strong>
                  <span>{preLaunchBlockedReason(blockedItems[0])}</span>
                </div>
                <button type="button" className="text-link" onClick={focusBlocked}>View blocker <ChevronRight size={14} /></button>
              </div>
            )}

            <div className="prelaunch-filter-row" role="tablist" aria-label="Checklist filters">
              {([
                ["all", "All"],
                ["incomplete", "Incomplete"],
                ["blocked", "Blocked"],
                ["completed", "Completed"],
              ] as [PreLaunchFilter, string][]).map(([value, label]) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                  key={value}
                >
                  {label} <span>{filterCounts[value]}</span>
                </button>
              ))}
            </div>

            <div className="prelaunch-category-list">
              {groupedCategories.length ? groupedCategories.map((category) => {
                const categoryCompleted = category.allItems.filter((item) => item.complete).length;
                const categoryBlocked = category.allItems.filter((item) => item.paused).length;
                const isOpen = openCategories[category.key] ?? category.index === 0;
                return (
                  <section className="prelaunch-category" key={category.key}>
                    <button
                      type="button"
                      className="prelaunch-category-header"
                      aria-expanded={isOpen}
                      onClick={() => setOpenCategories((current) => ({ ...current, [category.key]: !isOpen }))}
                    >
                      <span className="prelaunch-category-chevron">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                      <span className="prelaunch-category-title">
                        <strong>{category.label}</strong>
                        <small>{category.description}</small>
                      </span>
                      <span className="prelaunch-category-count">{categoryCompleted} / {category.allItems.length} complete</span>
                      {categoryBlocked > 0 && <span className="prelaunch-category-blocked">{categoryBlocked} blocked</span>}
                    </button>
                    {isOpen && (
                      <div className="prelaunch-category-items">
                        {category.items.map((item) => {
                          const meta = preLaunchItemMeta(item, category.label);
                          const canToggle = canComplete && checklist.status.toUpperCase() !== "COMPLETED" && !item.paused;
                          return (
                            <div
                              className={`prelaunch-item ${item.complete ? "complete" : ""} ${item.paused ? "blocked" : ""}`}
                              key={item.id}
                            >
                              <button
                                type="button"
                                className="prelaunch-item-toggle"
                                onClick={() => toggle(item)}
                                disabled={!canToggle}
                                title={!canToggle && item.paused ? preLaunchBlockedReason(item) : undefined}
                              >
                                <span className={`prelaunch-item-check ${item.complete ? "checked" : ""}`}>
                                  {item.complete && <CheckCircle2 size={14} />}
                                </span>
                                <span className="prelaunch-item-copy">
                                  <strong>{item.name}</strong>
                                  <small>{meta.detail}</small>
                                </span>
                              </button>
                              <span className={`prelaunch-item-status ${meta.tone}`}>
                                <strong>{meta.label}</strong>
                                {item.paused && <AlertTriangle size={13} />}
                              </span>
                              {preLaunchDocumentCodes.has(item.code.trim().toUpperCase()) && (
                                <PreLaunchDocumentRequirement
                                  lead={lead}
                                  item={item}
                                  onNotice={onNotice}
                                  onDocumentsChanged={async () => {
                                    await reload();
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              }) : (
                <div className="prelaunch-filter-empty">
                  <Filter size={17} /> No requirements match this filter.
                </div>
              )}
            </div>

            {canComplete && checklist.status.toUpperCase() !== "COMPLETED" ? (
              <div className="prelaunch-sticky-footer">
                <div>
                  <strong>{completedItems} of {totalItems} requirements complete</strong>
                  <span>{remainingItems} requirements remaining</span>
                </div>
                <button
                  className="button button-primary"
                  onClick={complete}
                  disabled={busy || requiredIncomplete}
                  title={requiredIncomplete ? "Complete all required items before finishing pre-launch." : undefined}
                >
                  Complete pre-launch <ChevronRight size={15} />
                </button>
              </div>
            ) : checklist.status.toUpperCase() === "COMPLETED" ? (
              <div className="completion-card">
                <CheckCircle2 size={19} />
                <div>
                  <strong>Pre-launch completed</strong>
                  <span>This finished checklist is read-only and ready for endorsement.</span>
                </div>
              </div>
            ) : (
              <div className="read-only-note">
                <ShieldCheck size={16} /> Checklist is view-only for your role.
              </div>
            )}
          </div>

          <aside className="prelaunch-readiness-sidebar">
            <section className="prelaunch-summary-card">
              <div className="prelaunch-sidebar-heading">
                <strong>Readiness summary</strong>
                <StatusPill state={checklist.status.toUpperCase() === "COMPLETED" ? "Qualified" : "PreLaunch"} label={statusLabel(checklist.status)} />
              </div>
              <div className="prelaunch-summary-metrics">
                <div><strong>{completedItems} / {totalItems}</strong><span>Complete</span></div>
                <div><strong>{completionPercent}%</strong><span>Ready</span></div>
                <div><strong>{remainingItems}</strong><span>Remaining</span></div>
                <div><strong>{blockedItems.length}</strong><span>Blocked</span></div>
                <div><strong>{documentRequirementsCount(checklistItems, true)} / {documentRequirementsCount(checklistItems, false)}</strong><span>Documents</span></div>
                <div><strong>{remainingItems}</strong><span>Assigned to this step</span></div>
              </div>
            </section>
            <section className="prelaunch-next-action-card">
              <span className="eyebrow">NEXT RECOMMENDED ACTION</span>
              <strong>{blockedItems.length ? "Resolve blocked requirement" : firstIncomplete ? firstIncomplete.name : "All requirements complete"}</strong>
              <p>{blockedItems.length ? preLaunchBlockedReason(blockedItems[0]) : firstIncomplete ? "Complete this requirement to move the readiness score forward." : "The checklist is ready for completion and handoff."}</p>
              {firstIncomplete && (
                <button type="button" className="button button-secondary" onClick={() => {
                  setFilter(firstIncomplete.paused ? "blocked" : "incomplete");
                  if (nextCategory) setOpenCategories((current) => ({ ...current, [nextCategory.key]: true }));
                }}>
                  View requirement <ChevronRight size={14} />
                </button>
              )}
            </section>
          </aside>
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
  }, [lead.id, lead.state]);
  const acknowledged =
    String(endorsement?.status ?? "").toLowerCase() === "acknowledged";
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
        title={acknowledged ? "Handoff complete" : "Handoff"}
        subtitle={
          acknowledged
            ? "The Admin Team acknowledged this opportunity. The downstream process is now complete."
            : "Route a completed opportunity to the receiving team with context."
        }
      />
      {endorsement && acknowledged ? (
        <div className="handoff-finished-card">
          <div className="completion-card">
            <CheckCircle2 size={19} />
            <div>
              <strong>Opportunity handed off successfully</strong>
              <span>
                The Admin Team acknowledged the completed franchise handoff. No
                further Sales Agent action is required.
              </span>
            </div>
          </div>
          <div className="snapshot-grid">
            <Info label="Receiving team" value={roleLabel(String(endorsement.receivingTeam))} />
            <Info label="Status" value={statusLabel(String(endorsement.status))} />
            <Info label="Handoff created" value={formatDate(String(endorsement.createdAt))} />
            <Info
              label="Acknowledged"
              value={endorsement.acknowledgedAt ? formatDate(String(endorsement.acknowledgedAt)) : "—"}
            />
          </div>
          <p className="callout">{String(endorsement.handoffNotes)}</p>
        </div>
      ) : endorsement ? (
        <div className="process-card">
          <div className="snapshot-grid">
            <Info
              label="Receiving team"
              value={roleLabel(String(endorsement.receivingTeam))}
            />
            <Info label="Status" value={statusLabel(String(endorsement.status))} />
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
            Handoff notes <span className="required-mark">*</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
              aria-required="true"
              aria-describedby="handoff-notes-hint"
              placeholder="Summarize what the Admin Team needs to know for onboarding."
              required
            />
            <small id="handoff-notes-hint" className="field-hint">Required before this opportunity can be handed off.</small>
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
    acknowledgedAt?: string;
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
          text="The Sales Agent or General Manager must complete pre-launch and create the handoff record first."
        />
      </section>
    );
  return (
    <section className="panel tab-panel">
      <PanelHeader
        title={item.status === "Acknowledged" ? "Handoff complete" : "Receive endorsement"}
        subtitle={
          item.status === "Acknowledged"
            ? "This opportunity has been accepted by the Admin Team and is now complete."
            : "Review the exact boundary between completed Sales Agent work and remaining Admin work."
        }
      />
      <div className="snapshot-grid">
        <Info label="Receiving team" value={roleLabel(item.receivingTeam)} />
        <Info label="Status" value={statusLabel(item.status)} />
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
                  : "Completed by Sales Agent"}
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
                <span>
                  The Admin Team now owns the downstream process.
                  {item.acknowledgedAt ? ` Acknowledged ${formatDate(item.acknowledgedAt)}.` : ""}
                </span>
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const load = async (requestedPage: number) => {
    setBusy(true);
    try {
      const response = await api.audit.list(leadId, requestedPage);
      setLogs(response.items);
      setPage(response.page);
      setTotal(response.total);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load(1);
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
      {total > 10 && (
        <PaginationControls
          page={page}
          totalPages={Math.max(1, Math.ceil(total / 10))}
          total={total}
          busy={busy}
          onPageChange={(nextPage) => load(nextPage)}
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
  const realtimeRevision = useRealtimeRefresh();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedWork, setCompletedWork] = useState<CompletedWorkItem[]>([]);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedPageBusy, setCompletedPageBusy] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<"todo" | "completed">("todo");
  const [notice, setNotice] = useState<Notice | null>(null);
  const canManageTasks = hasRole(user.role, marketingWriteRoles);
  const load = async () => {
    try {
      const [nextTasks, nextCompletedWork, nextLeads] = await Promise.all([
        api.tasks.list(),
        api.tasks.completed(1),
        api.leads.list("?limit=100&sort=updatedAt"),
      ]);
      setTasks(nextTasks);
      setCompletedWork(nextCompletedWork.items);
      setCompletedPage(nextCompletedWork.page);
      setCompletedTotal(nextCompletedWork.total);
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
  }, [realtimeRevision]);
  const loadCompletedPage = async (page: number) => {
    if (completedPageBusy) return;
    setCompletedPageBusy(true);
    try {
      const response = await api.tasks.completed(page);
      setCompletedWork(response.items);
      setCompletedPage(response.page);
      setCompletedTotal(response.total);
    } catch (e) {
      setNotice({
        message: errorMessage(e, "Unable to load completed work."),
        tone: "error",
      });
    } finally {
      setCompletedPageBusy(false);
    }
  };
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
  const persistedOpenTasks = tasks.filter((task) => task.status === "Open");
  const persistedLeadIds = new Set(persistedOpenTasks.map((task) => task.leadId));
  const workflowDueAt = new Date();
  workflowDueAt.setHours(23, 59, 59, 999);
  const workflowTasks: Task[] = leads
    .filter((lead) => isMyCurrentAction(lead, user) && !persistedLeadIds.has(lead.id))
    .map((lead) => ({
      id: `workflow:${lead.id}`,
      leadId: lead.id,
      assignedTo: user.id,
      title: nextStepForLead(lead, Boolean(lead.downPaymentSubmittedForFinance)).label,
      status: "Open" as const,
      createdAt: lead.updatedAt,
      dueAt: workflowDueAt.toISOString(),
    }));
  const openTasks = [...persistedOpenTasks, ...workflowTasks];
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
      subtitle="Everything assigned to you that needs attention, plus your completed work history."
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
          <span>Completed {completedTotal}</span>
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
          Completed <span>{completedTotal}</span>
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : view === "completed" ? (
        <section className="panel task-queue-panel">
          <PanelHeader
            title="Completed recently"
            subtitle="Tasks and workflow actions you completed."
          />
          {completedWork.length ? (
            <>
              <div className="task-queue-list">
                {completedWork.map((item) => (
                  <CompletedWorkCard
                    key={`${item.kind}:${item.id}`}
                    item={item}
                    lead={leadById.get(item.leadId)}
                  />
                ))}
              </div>
              {completedTotal > 10 && (
                <PaginationControls
                  page={completedPage}
                  totalPages={Math.max(1, Math.ceil(completedTotal / 10))}
                  total={completedTotal}
                  busy={completedPageBusy}
                  onPageChange={loadCompletedPage}
                />
              )}
            </>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="No completed work yet"
              text="Tasks and workflow actions you finish will appear here."
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
  const workflowAction = task.id.startsWith("workflow:");
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
        ) : canManage && !workflowAction ? (
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
            {workflowAction
              ? "your role"
              : task.assignedTo === currentUserId
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

function CompletedWorkCard({
  item,
  lead,
}: {
  item: CompletedWorkItem;
  lead?: Lead;
}) {
  return (
    <article className="task-queue-card completed">
      <div className="task-queue-status">
        <span className="checkbox checked" aria-label="Completed">
          <CheckCircle2 size={14} />
        </span>
      </div>
      <div className="task-queue-body">
        <strong>{item.title}</strong>
        {lead ? (
          <NavLink to={`/leads/${lead.id}`} className="task-queue-lead">
            {lead.fullName} · {pipelineStageLabel(lead.state)}
          </NavLink>
        ) : (
          <span className="task-queue-lead">Franchise opportunity</span>
        )}
        <p>{item.detail}</p>
        <div className="task-queue-meta">
          <span>Completed {formatDateTime(item.completedAt)}</span>
          <span>{item.kind === "Workflow" ? "Workflow action" : "Task"}</span>
        </div>
      </div>
      {lead && (
        <NavLink
          to={`/leads/${lead.id}`}
          className="button button-secondary task-queue-action"
        >
          Open opportunity <ChevronRight size={15} />
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
  if (task.id.startsWith("workflow:")) return "Current workflow action";
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
          "SalesAgent",
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
  const realtimeRevision = useRealtimeRefresh();
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
  }, [load, realtimeRevision]);
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

function FinanceWorkbench() {
  const role = session.user?.role;
  if (!hasRole(role, ["Finance", "Leadership"])) return <Navigate to="/" replace />;
  const realtimeRevision = useRealtimeRefresh();
  const [view, setView] = useState<"action" | "history">("action");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [ownerId, setOwnerId] = useState("");
  const [owners, setOwners] = useState<{ id: string; displayName: string }[]>([]);
  const [result, setResult] = useState<FinanceWorkbenchResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    api.users.list("?page=1&pageSize=100").then((result) => setOwners(
      result.items
        .filter((item) => item.isActive !== false && (item.roles ?? [item.role]).some((role) => canonicalRole(role) === "SalesAgent"))
        .map((item) => ({ id: item.id, displayName: item.displayName })),
    )).catch(() => setOwners([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("status", view === "action" ? "awaiting" : status);
    params.set("page", String(page));
    params.set("pageSize", "20");
    if (search.trim()) params.set("search", search.trim());
    if (ownerId) params.set("ownerId", ownerId);
    if (dateRange !== "all") {
      const days = dateRange === "today" ? 1 : Number(dateRange);
      params.set("from", new Date(Date.now() - days * 86400000).toISOString());
      params.set("to", new Date().toISOString());
    }
    setLoading(true);
    setError("");
    api.finance.workbench(`?${params.toString()}`).then((value) => {
      if (!cancelled) setResult(value);
    }).catch((e) => {
      if (!cancelled) setError(errorMessage(e, "Unable to load the finance workbench."));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [view, status, search, dateRange, ownerId, page, realtimeRevision]);

  const changeView = (next: "action" | "history") => {
    setView(next);
    setPage(1);
    if (next === "action") setStatus("all");
  };
  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  const exportCurrentView = () => {
    const rows = [
      ["Lead", "Invoice", "Amount", "Status", "Owner", "Submitted", "Confirmed"],
      ...(result?.items ?? []).map((item) => [
        item.leadName,
        item.invoiceNumber ?? "",
        `${item.currency} ${item.amount.toFixed(2)}`,
        financeStatusLabel(item.status),
        item.ownerName,
        item.submittedAt ? formatDateTime(item.submittedAt) : "",
        item.confirmedAt ? formatDateTime(item.confirmedAt) : "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finance-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 20)));
  const items = result?.items ?? [];
  const subtitle = view === "action"
    ? "Review submitted payments before the franchise workflow can continue."
    : "Find every submitted payment and see who confirmed it, when, and why.";

  return (
    <Page title="Finance" subtitle={subtitle}>
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      <div className="finance-metrics">
        <FinanceMetric label="Awaiting review" value={String(result?.awaitingCount ?? 0)} hint="Submitted packages" tone="amber" icon={Clock3} />
        <FinanceMetric label="Pending amount" value={formatMoney(result?.pendingAmount ?? 0)} hint="Awaiting confirmation" tone="red" icon={WalletCards} />
        <FinanceMetric label="Confirmed this month" value={formatMoney(result?.confirmedThisMonth ?? 0)} hint="Confirmed collections" tone="green" icon={CheckCircle2} />
        <FinanceMetric label="Exceptions" value={String(result?.exceptionCount ?? 0)} hint="Returned or cancelled" tone="slate" icon={AlertTriangle} />
      </div>
      <section className="panel finance-workbench-panel">
        <div className="finance-workbench-header"><div><h2>Payment operations</h2><p>Keep payment review and payment history in one auditable workspace.</p></div>{view === "history" && <button className="button button-secondary" onClick={exportCurrentView} disabled={!items.length}><FileText size={15} /> Export</button>}</div>
        <div className="queue-view-tabs finance-view-tabs" role="tablist" aria-label="Finance view">
          <button className={view === "action" ? "active" : ""} role="tab" aria-selected={view === "action"} onClick={() => changeView("action")}>Action required <span>{result?.awaitingCount ?? 0}</span></button>
          <button className={view === "history" ? "active" : ""} role="tab" aria-selected={view === "history"} onClick={() => changeView("history")}>Payment history</button>
        </div>
        <div className="finance-toolbar">
          <label className="finance-search"><Search size={16} /><input value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} placeholder="Search lead or invoice…" /></label>
          <label><span>Status</span><select value={view === "action" ? "awaiting" : status} disabled={view === "action"} onChange={(event) => changeFilter(setStatus, event.target.value)}><option value="all">All statuses</option><option value="awaiting">Awaiting review</option><option value="confirmed">Confirmed</option><option value="returned">Returned</option><option value="cancelled">Cancelled</option></select></label>
          <label><span>Date</span><select value={dateRange} onChange={(event) => changeFilter(setDateRange, event.target.value)}><option value="all">All dates</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
          <label><span>Owner</span><select value={ownerId} onChange={(event) => changeFilter(setOwnerId, event.target.value)}><option value="">All owners</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}</select></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        {loading ? <Loading /> : items.length ? <><div className="finance-table-wrap"><div className="finance-table finance-table-heading"><span>Lead / franchise</span><span>Invoice</span><span>Amount</span><span>Submitted</span><span>Age</span><span>Status</span><span /></div>{items.map((item) => <FinancePaymentRow key={item.paymentId} item={item} onOpen={() => setSelectedPaymentId(item.paymentId)} />)}</div><FinancePagination page={page} totalPages={totalPages} total={result?.total ?? 0} onChange={setPage} /></> : <div className="finance-empty"><CheckCircle2 size={22} /><strong>{view === "action" ? "No payments awaiting review" : "No payment history matches"}</strong><span>{view === "action" ? "New submitted payment packages will appear here." : "Try a different search, status, owner, or date filter."}</span></div>}
      </section>
      {selectedPaymentId && <FinancePaymentDrawer paymentId={selectedPaymentId} onClose={() => setSelectedPaymentId(null)} onConfirmed={() => { setSelectedPaymentId(null); setNotice({ message: "Payment confirmed and the finance history was updated.", tone: "success" }); setPage(1); }} />}
    </Page>
  );
}

function FinanceMetric({ label, value, hint, tone, icon: IconComponent }: { label: string; value: string; hint: string; tone: string; icon: Icon }) {
  return <div className="finance-metric"><div className={`finance-metric-icon ${tone}`}><IconComponent size={17} /></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

function FinancePaymentRow({ item, onOpen }: { item: FinancePaymentItem; onOpen: () => void }) {
  const age = paymentAge(item.activityAt);
  return <button className="finance-table finance-table-row" onClick={onOpen} type="button"><span className="finance-lead-cell"><span className="avatar avatar-tiny">{initials(item.leadName)}</span><span><strong>{item.leadName}</strong><small>{item.location ?? "Location not provided"} · {item.ownerName}</small></span></span><span className="finance-invoice-cell">{item.invoiceNumber ?? "—"}</span><span className="finance-amount-cell">{formatMoney(item.amount, item.currency)}</span><span>{item.submittedAt ? formatDate(item.submittedAt) : "—"}</span><span className={`finance-age ${age.tone}`}>{age.label}</span><span><span className={`finance-status ${item.status.toLowerCase()}`}>{financeStatusLabel(item.status)}</span></span><ChevronRight size={16} /></button>;
}

function FinancePagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  if (total <= 0) return null;
  return <div className="finance-pagination"><span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span><div><button className="button button-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="button button-secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button></div></div>;
}

function FinancePaymentDrawer({ paymentId, onClose, onConfirmed }: { paymentId: string; onClose: () => void; onConfirmed: () => void }) {
  const [detail, setDetail] = useState<FinancePaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  useEffect(() => {
    setError("");
    setLoading(true);
    api.finance.payment(paymentId).then(setDetail).catch((e) => setError(errorMessage(e, "Unable to load payment details."))).finally(() => setLoading(false));
  }, [paymentId]);
  const refreshDetail = async () => {
    try {
      setDetail(await api.finance.payment(paymentId));
    } catch (e) {
      setError(errorMessage(e, "Unable to refresh payment details."));
    }
  };
  const openDocument = async (document: DocumentItem) => {
    try {
      const result = await api.leads.downloadUrl(document.leadId, document.id) as { downloadUrl?: string };
      if (result.downloadUrl) window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) { setError(errorMessage(e, "Unable to open the payment proof.")); }
  };
  const openInvoice = async () => {
    if (!detail) return;
    try {
      const result = await api.leads.invoiceDownload(detail.payment.leadId);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) { setError(errorMessage(e, "Unable to open the invoice.")); }
  };
  const confirm = async () => {
    if (!detail || !reference.trim()) { setError("Enter the payment reference before confirming."); return; }
    setBusy(true); setError("");
    try {
      await api.leads.confirmPayment(detail.payment.leadId, { referenceNumber: reference.trim(), amount: detail.payment.amount, currency: detail.payment.currency, paidAt: new Date().toISOString() });
      onConfirmed();
    } catch (e) { setError(errorMessage(e, "Unable to confirm this payment.")); } finally { setBusy(false); }
  };
  const canAttachProof = detail?.payment.status === "Awaiting" && hasRole(session.user?.role, ["SalesAgent"]);
  return (
    <div
      className="finance-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="finance-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-drawer-title"
      >
        <div className="finance-drawer-header">
          <div>
            <span className="eyebrow">PAYMENT RECORD</span>
            <h2 id="finance-drawer-title">
              {loading ? "Loading payment…" : detail?.payment.invoiceNumber ?? "Payment details"}
            </h2>
            {detail && (
              <p>
                {detail.payment.leadName} · {formatMoney(detail.payment.amount, detail.payment.currency)}
              </p>
            )}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close payment details">
            <X size={18} />
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {loading ? (
          <Loading />
        ) : detail ? (
          <>
            <div className="finance-drawer-status">
              <span className={`finance-status ${detail.payment.status.toLowerCase()}`}>
                {financeStatusLabel(detail.payment.status)}
              </span>
              <span>{detail.payment.location ?? "Location not provided"}</span>
            </div>
            <div className="finance-drawer-section">
              <h3>Payment timeline</h3>
              <div className="finance-timeline">
                {detail.events.length ? (
                  detail.events.map((event) => (
                    <div className="finance-timeline-item" key={event.id}>
                      <i />
                      <div>
                        <strong>{financeEventLabel(event.type)}</strong>
                        <p>{event.message}</p>
                        <small>{formatDateTime(event.createdAt)} · {event.actorName}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="muted">No payment events recorded yet.</span>
                )}
              </div>
            </div>
            <div className="finance-drawer-section">
              <h3>Documents</h3>
              <div className="finance-proof-list">
                <button className="finance-proof" onClick={openInvoice} type="button">
                  <FileText size={16} />
                  <span>
                    <strong>{detail.payment.invoiceNumber ?? "Down payment invoice"}</strong>
                    <small>Invoice</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
                {!canAttachProof && detail.evidenceDocuments.length
                  ? detail.evidenceDocuments.map((document) => (
                      <button className="finance-proof" key={document.id} onClick={() => openDocument(document)} type="button">
                        <FileText size={16} />
                        <span>
                          <strong>{document.fileName}</strong>
                          <small>Payment proof · {Math.ceil(document.sizeBytes / 1024)} KB</small>
                        </span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                  : null}
                {!canAttachProof && !detail.evidenceDocuments.length ? (
                  <div className="finance-proof-empty">No payment proof attached.</div>
                ) : null}
              </div>
              {canAttachProof ? (
                <div className="finance-proof-upload">
                  <strong>Attach payment proof</strong>
                  <span>Upload a receipt, bank confirmation, or other proof before confirming.</span>
                  <DocumentsPanel
                    lead={{ id: detail.payment.leadId }}
                    onNotice={(notice) => setError(notice.tone === "error" ? notice.message : "")}
                    onDocumentsChanged={refreshDetail}
                    embedded
                    fixedDocumentType="PAYMENT_RECEIPT"
                    visibleTypes={["PAYMENT_RECEIPT"]}
                    documentCard
                    hideEmptyState
                  />
                </div>
              ) : null}
            </div>
            {detail.payment.confirmationReference && (
              <div className="finance-reference">
                <span>Confirmation reference</span>
                <strong>{detail.payment.confirmationReference}</strong>
                {detail.payment.confirmedByName && (
                  <small>
                    Confirmed by {detail.payment.confirmedByName}
                    {detail.payment.confirmedAt ? ` · ${formatDateTime(detail.payment.confirmedAt)}` : ""}
                  </small>
                )}
              </div>
            )}
            {detail.payment.status === "Awaiting" && (
              <div className="finance-confirm-box">
                <h3>Confirm payment</h3>
                <p>Match the invoice, payment proof, and received amount before recording confirmation.</p>
                <label>
                  Payment reference
                  <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank or receipt reference" />
                </label>
                <button className="button button-primary button-wide" onClick={confirm} disabled={busy}>
                  {busy ? "Confirming…" : "Confirm payment"}
                </button>
              </div>
            )}
          </>
        ) : null}
      </aside>
    </div>
  );
}

function financeStatusLabel(status: string) {
  return status === "Awaiting" ? "Awaiting review" : status === "Confirmed" ? "Confirmed" : statusLabel(status);
}
function financeEventLabel(type: string) {
  return type === "InvoiceGenerated" ? "Payment invoice generated" : type === "DownPaymentSubmittedForFinance" ? "Payment submitted to Finance" : type === "PaymentConfirmed" ? "Payment confirmed" : statusLabel(type);
}
function paymentAge(value: string) {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 3600000));
  if (hours < 1) return { label: "<1h", tone: "fresh" };
  if (hours < 24) return { label: `${hours}h`, tone: "fresh" };
  const days = Math.floor(hours / 24);
  return { label: `${days}d`, tone: days >= 3 ? "old" : "watch" };
}
function formatMoney(value: number, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function PreLaunchQueue() {
  if (hasRole(session.user?.role, ["AdminTeam"])) return <EndorsementsQueue />;
  if (
    !hasRole(session.user?.role, [
      "SalesAgent",
      "GeneralManager",
      "Leadership",
    ])
  )
    return <Navigate to="/" replace />;
  return <PreLaunchQueueContent />;
}
function PreLaunchQueueContent() {
  const realtimeRevision = useRealtimeRefresh();
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
  }, [realtimeRevision]);
  return (
    <Page
      title="Signed agreements & pre-launch"
      subtitle="Review fully signed agreements before explicitly starting readiness work."
    >
      <section className="panel queue-panel">
        <PanelHeader
          title="Ready for the next step"
          subtitle="A signed agreement must be reviewed before its pre-launch checklist starts."
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
                    {item.state === "ContractSigned" ? "Review signed agreement" : "Open pre-launch checklist"} · Updated {formatDate(item.updatedAt)}
                  </span>
                </div>
                <ChevronRight size={17} />
              </NavLink>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="No signed agreements awaiting review"
            text="Fully signed opportunities will appear here before their pre-launch checklist starts."
          />
        )}
      </section>
    </Page>
  );
}

function EndorsementsQueue() {
  const realtimeRevision = useRealtimeRefresh();
  type HandoffItem = {
    code: string;
    name: string;
    completedByMarketing: boolean;
    adminActionRequired: boolean;
    notes?: string | null;
  };
  type Handoff = {
    id: string;
    leadId: string;
    fullName: string;
    receivingTeam: string;
    status: string;
    handoffNotes: string;
    items: HandoffItem[];
    createdAt: string;
    acknowledgedAt?: string | null;
  };
  type HandoffView = "pending" | "acknowledged" | "all";
  const [items, setItems] = useState<Handoff[]>([]);
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [preLaunch, setPreLaunch] = useState<{ items?: PreLaunchChecklistItem[]; status?: string } | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [openingDocument, setOpeningDocument] = useState<string | null>(null);
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const [view, setView] = useState<HandoffView>("pending");
  const [search, setSearch] = useState("");
  const [sortOldestFirst, setSortOldestFirst] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const canAcknowledge = hasRole(session.user?.role, ["AdminTeam"]);
  const load = async () => {
    try {
      const [endorsements, queue] = await Promise.all([
        api.endorsements.list(),
        api.queues.admin().catch(() => []),
      ]);
      const queueNames = new Map(
        (queue as { leadId: string; fullName: string }[]).map((item) => [item.leadId, item.fullName]),
      );
      const mapped = (endorsements as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id),
        leadId: String(item.leadId),
        fullName: queueNames.get(String(item.leadId)) ?? "Endorsed franchisee",
        receivingTeam: String(item.receivingTeam ?? "Admin Team"),
        status: String(item.status ?? "Pending"),
        handoffNotes: String(item.handoffNotes ?? ""),
        items: Array.isArray(item.items) ? item.items as HandoffItem[] : [],
        createdAt: String(item.createdAt),
        acknowledgedAt: item.acknowledgedAt ? String(item.acknowledgedAt) : null,
      }));
      setItems(mapped);
      setLeadNames((current) => ({
        ...current,
        ...Object.fromEntries(queueNames.entries()),
      }));
      const missingLeadIds = [...new Set(mapped.map((item) => item.leadId).filter((id) => !queueNames.has(id)))];
      if (missingLeadIds.length) {
        const resolved = await Promise.allSettled(missingLeadIds.map((id) => api.leads.get(id)));
        const resolvedNames = Object.fromEntries(
          resolved.flatMap((result, index) => result.status === "fulfilled" ? [[missingLeadIds[index], result.value.fullName]] : []),
        );
        setLeadNames((current) => ({ ...current, ...resolvedNames }));
      }
    } catch {
      setItems([]);
    }
  };
  useEffect(() => {
    void load();
  }, [realtimeRevision]);
  const statusIs = (item: Handoff, status: HandoffView) => {
    if (status === "all") return true;
    return status === "pending" ? item.status.toLowerCase() === "pending" : item.status.toLowerCase() === "acknowledged";
  };
  const filteredItems = items
    .filter((item) => statusIs(item, view))
    .filter((item) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [item.fullName, leadNames[item.leadId], item.leadId, item.handoffNotes, item.receivingTeam]
        .some((value) => value?.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const aDate = Date.parse(a.acknowledgedAt ?? a.createdAt);
      const bDate = Date.parse(b.acknowledgedAt ?? b.createdAt);
      return sortOldestFirst ? aDate - bDate : bDate - aDate;
    });
  const pending = items.filter((item) => item.status.toLowerCase() === "pending");
  const acknowledged = items.filter((item) => item.status.toLowerCase() === "acknowledged");
  const acknowledgedThisMonth = acknowledged.filter((item) => {
    if (!item.acknowledgedAt) return false;
    const date = new Date(item.acknowledgedAt);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const averageHours = acknowledged.length
    ? Math.round(acknowledged.reduce((total, item) => total + Math.max(0, Date.parse(item.acknowledgedAt ?? item.createdAt) - Date.parse(item.createdAt)) / 3600000, 0) / acknowledged.length)
    : 0;
  const oldestPending = [...pending].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
  const selected = selectedId ? filteredItems.find((item) => item.id === selectedId) ?? null : null;
  useEffect(() => {
    if (selectedId && !filteredItems.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [selectedId, items, view, search]);
  useEffect(() => {
    if (!selected) {
      setLead(null);
      setPreLaunch(null);
      setDocuments([]);
      setDocumentsError("");
      setDocumentsLoading(false);
      return;
    }
    let cancelled = false;
    setShowAllDocuments(false);
    setDocumentsLoading(true);
    setDocumentsError("");
    void Promise.all([
      api.leads.get(selected.leadId).catch(() => null),
      api.leads.preLaunch(selected.leadId).catch(() => null),
      api.leads.documents(selected.leadId).catch((error) => {
        if (!cancelled) setDocumentsError(errorMessage(error, "Documents could not be loaded."));
        return [] as DocumentItem[];
      }),
    ]).then(([leadResult, checklist, documentResult]) => {
      if (cancelled) return;
      setLead(leadResult as Lead | null);
      setPreLaunch(checklist as { items?: PreLaunchChecklistItem[]; status?: string } | null);
      setDocuments(documentResult as DocumentItem[]);
      setDocumentsLoading(false);
    });
    return () => { cancelled = true; };
  }, [selected?.id]);
  const acknowledge = async (id: string) => {
    setBusy(id);
    try {
      await api.endorsements.acknowledge(id);
      await load();
    } finally {
      setBusy(null);
    }
  };
  const openDocument = async (document: DocumentItem) => {
    setOpeningDocument(document.id);
    setDocumentsError("");
    try {
      const result = await api.leads.downloadUrl(document.leadId, document.id) as { downloadUrl?: string };
      if (!result.downloadUrl) throw new Error("A download link is not available for this document.");
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setDocumentsError(errorMessage(error, "Unable to open this document."));
    } finally {
      setOpeningDocument(null);
    }
  };
  // ADMIN_ONBOARDING is an internal receiving-team follow-up, not a
  // pre-launch requirement completed by Marketing. Keep it in the handoff
  // boundary for the acknowledgement workflow, but do not count it here.
  const assessmentItems = selected?.items.filter((item) => item.code.trim().toUpperCase() !== "ADMIN_ONBOARDING") ?? [];
  const completedItems = assessmentItems.filter((item) => item.completedByMarketing);
  const requiredItems = assessmentItems.filter((item) => item.completedByMarketing || item.adminActionRequired);
  const completedCount = completedItems.length;
  const totalCount = requiredItems.length || selected?.items.length || 0;
  const reviewDocuments = documents.filter((document) => document.status.toLowerCase() === "uploaded");
  const visibleDocuments = showAllDocuments ? reviewDocuments : reviewDocuments.slice(0, 3);
  const statusTone = selected?.status.toLowerCase() === "acknowledged" ? "green" : "amber";
  const formatAge = (createdAt: string) => {
    const hours = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 3600000));
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };
  return (
    <Page
      title="Handoff queue"
      subtitle="Receive completed franchise opportunities and confirm ownership."
    >
      <div className="handoff-metrics">
        <div className="handoff-metric"><span className="handoff-metric-icon danger"><ClipboardCheck size={17} /></span><span><small>Pending handoffs</small><strong>{pending.length}</strong><em>Awaiting your action</em></span></div>
        <div className="handoff-metric"><span className="handoff-metric-icon success"><CheckCircle2 size={17} /></span><span><small>Acknowledged this month</small><strong>{acknowledgedThisMonth.length}</strong><em>Handoffs received</em></span></div>
        <div className="handoff-metric"><span className="handoff-metric-icon info"><Clock3 size={17} /></span><span><small>Average handoff time</small><strong>{averageHours ? `${averageHours}h` : "—"}</strong><em>From endorsement to acknowledgement</em></span></div>
        <div className="handoff-metric"><span className="handoff-metric-icon warning"><AlertTriangle size={17} /></span><span><small>Oldest pending</small><strong>{oldestPending ? formatAge(oldestPending.createdAt) : "—"}</strong><em>{oldestPending ? (leadNames[oldestPending.leadId] ?? oldestPending.fullName) : "Nothing waiting"}</em></span></div>
      </div>
      <div className="handoff-workbench">
        <section className="panel handoff-list-panel">
          <div className="handoff-tabs" role="tablist" aria-label="Handoff status">
            {([['pending', 'Pending handoffs', pending.length], ['acknowledged', 'Acknowledged', acknowledged.length], ['all', 'All handoffs', items.length]] as const).map(([key, label, count]) => <button key={key} role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}<b>{count}</b></button>)}
          </div>
          <div className="handoff-toolbar"><label className="handoff-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search franchise…" aria-label="Search handoffs" /></label><button className="button button-secondary handoff-sort" onClick={() => setSortOldestFirst((value) => !value)}><Clock3 size={14} />{sortOldestFirst ? "Oldest first" : "Newest first"}<ChevronDown size={14} /></button></div>
          <p className="handoff-list-hint">{canAcknowledge ? "Review the handoff context, then acknowledge receipt." : "View-only handoff activity for your role."}</p>
          {filteredItems.length ? <div className="handoff-table" role="list">{filteredItems.map((item) => {
            const isSelected = item.id === selected?.id;
            const name = leadNames[item.leadId] ?? item.fullName;
            return <button className={`handoff-row ${isSelected ? "selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)} role="listitem"><span className="avatar">{initials(name)}</span><span className="handoff-row-main"><strong>{name}</strong><small>{lead?.id === item.leadId && lead.preferredLocation ? lead.preferredLocation : "Marketing Operations"}</small></span><span className="handoff-row-meta"><strong>{formatDate(item.createdAt)}</strong><small>{item.status.toLowerCase() === "pending" ? `${formatAge(item.createdAt)} ago` : item.acknowledgedAt ? `Received ${formatDate(item.acknowledgedAt)}` : "Received"}</small></span><span className={`status-pill ${item.status.toLowerCase() === "pending" ? "amber" : "green"}`}>{item.status.toLowerCase() === "pending" ? "Ready" : "Acknowledged"}</span><span className="handoff-row-action">Review handoff</span><ChevronRight size={16} /></button>;
          })}</div> : <EmptyState icon={ClipboardCheck} title={view === "pending" ? "No pending handoffs" : "No handoffs found"} text={search ? "Try a different search term." : "Completed opportunities will appear here when they are handed off."} />}
        </section>
      {selected && selectedId && <Modal title="Review handoff" subtitle={`${leadNames[selected.leadId] ?? selected.fullName} · ${selected.status.toLowerCase() === "pending" ? "Ready for handoff" : "Acknowledged"}`} onClose={() => setSelectedId(null)}>
        <div className="handoff-modal-content">
          {selected ? <>
            <div className="handoff-detail-heading"><span className="avatar">{initials(leadNames[selected.leadId] ?? selected.fullName)}</span><div><strong>{leadNames[selected.leadId] ?? selected.fullName}</strong><small>{lead?.preferredLocation ?? "Franchise opportunity"}</small></div><span className={`status-pill ${statusTone}`}>{selected.status.toLowerCase() === "pending" ? "Ready for handoff" : "Acknowledged"}</span></div>
            <div className="handoff-detail-section"><h3>Handoff from</h3><div className="handoff-owner"><span className="avatar small">M</span><span><strong>Marketing Operations</strong><small>{formatDateTime(selected.createdAt)}</small></span></div></div>
            <div className="handoff-detail-section"><div className="handoff-section-title"><h3>Pre-launch summary</h3><span>{completedCount} of {totalCount || "—"} complete</span></div><div className="handoff-summary-list">{(assessmentItems.length ? assessmentItems : preLaunch?.items ?? []).slice(0, 6).map((item) => <div key={item.code} className={(("completedByMarketing" in item && item.completedByMarketing) || ("complete" in item && item.complete)) ? "complete" : "pending"}><CheckCircle2 size={14} /><span>{item.name}</span></div>)}</div></div>
            <div className="handoff-detail-section"><div className="handoff-section-title"><h3>Documents for review</h3><span>{documentsLoading ? "Loading…" : `${reviewDocuments.length} uploaded`}</span></div>{documentsLoading ? <p className="handoff-document-empty">Loading handoff documents…</p> : reviewDocuments.length ? <><div className="handoff-document-list">{visibleDocuments.map((document) => <button type="button" className="handoff-document" key={document.id} onClick={() => void openDocument(document)} disabled={openingDocument === document.id}><span className="handoff-document-icon"><FileText size={15} /></span><span><strong>{documentTypeLabel(document.documentType)}</strong><small>{document.fileName} · {formatDate(document.createdAt)}</small></span><span className="handoff-document-open">{openingDocument === document.id ? "Opening…" : "Open"}<ArrowUpRight size={14} /></span></button>)}</div>{reviewDocuments.length > 3 && <button type="button" className="handoff-document-more" onClick={() => setShowAllDocuments((value) => !value)}>{showAllDocuments ? "Show fewer documents" : `Show all ${reviewDocuments.length} documents`}<ChevronDown size={14} className={showAllDocuments ? "up" : ""} /></button>}</> : <p className="handoff-document-empty">No uploaded documents are available for review yet.</p>}{documentsError && <p className="handoff-document-error">{documentsError}</p>}</div>
            <div className="handoff-detail-section"><h3>Handoff notes</h3><p className="handoff-notes">{selected.handoffNotes || "No notes were added to this handoff."}</p></div>
            {selected.status.toLowerCase() === "pending" && <div className="handoff-next"><strong>After acknowledgement</strong><ol><li>Admin Team accepts ownership</li><li>Franchisee moves to launch preparation</li><li>Handoff is recorded in the audit trail</li></ol></div>}
            {(selected.status.toLowerCase() === "acknowledged" || (selected.status.toLowerCase() === "pending" && canAcknowledge)) && <div className="handoff-action-bar">
              {selected.status.toLowerCase() === "pending" && canAcknowledge && <button className="button button-primary button-wide" onClick={() => void acknowledge(selected.id)} disabled={busy === selected.id}>{busy === selected.id ? "Acknowledging…" : "Acknowledge handoff"}<ChevronRight size={16} /></button>}
              {selected.status.toLowerCase() === "acknowledged" && <p className="handoff-readonly"><CheckCircle2 size={15} /> Acknowledged {selected.acknowledgedAt ? formatDateTime(selected.acknowledgedAt) : "by the Admin Team"}.</p>}
            </div>}
          </> : <div className="handoff-detail-empty"><ClipboardCheck size={24} /><strong>Select a handoff to review</strong><span>Choose a row to see the pre-launch context and notes.</span></div>}
        </div>
      </Modal>}
      </div>
    </Page>
  );
}

function Reports() {
  if (
    !hasRole(session.user?.role, [
      "GeneralManager",
      "Finance",
      "Leadership",
    ])
  )
    return <Navigate to="/" replace />;
  return <ReportsContent />;
}
function ReportsContent() {
  type Overview = { totalLeads: number; byState: Record<string, number>; confirmedDownPayments: number };
  type Conversion = { rates: Record<string, number>; from: string; to: string };
  type Goal = { year: number; target: number; achieved: number; completionPercentage: number };
  type Payment = { totalInvoiced: number; totalConfirmed: number; pendingCount: number; pendingAmount?: number };
  type AgentRow = { agentId: string; agentName: string; leads: number; qualified: number; endorsed: number; confirmedRevenue?: number };
  type ReportingPeriod = "current" | "previous" | "year";
  const [period, setPeriod] = useState<ReportingPeriod>("current");
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState<UserRecord[]>([]);
  const [report, setReport] = useState<Overview | null>(null);
  const [previousReport, setPreviousReport] = useState<Overview | null>(null);
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [previousConversion, setPreviousConversion] = useState<Conversion | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [leaderboard, setLeaderboard] = useState<AgentRow[]>([]);
  const [payments, setPayments] = useState<Payment | null>(null);
  const [previousPayments, setPreviousPayments] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const realtimeRevision = useRealtimeRefresh();

  const getPeriod = (value: ReportingPeriod) => {
    const now = new Date();
    if (value === "year")
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
    const offset = value === "previous" ? -1 : 0;
    const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    return { from, to };
  };
  const queryFor = (value: ReportingPeriod, selectedAgent = agentId) => {
    const range = getPeriod(value);
    return `?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}${selectedAgent ? `&agentId=${encodeURIComponent(selectedAgent)}` : ""}`;
  };
  const labelForPeriod = (value: ReportingPeriod) => {
    const range = getPeriod(value);
    const monthFormatter = new Intl.DateTimeFormat("en-PH", { month: "short" });
    const month = monthFormatter.format(range.from);
    if (range.from.getFullYear() === range.to.getFullYear() && range.from.getMonth() === range.to.getMonth())
      return `${month} ${range.from.getDate()}–${range.to.getDate()}, ${range.from.getFullYear()}`;
    const formatter = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });
    return `${formatter.format(range.from)} – ${formatter.format(range.to)}`;
  };
  useEffect(() => {
    api.users.list("?page=1&pageSize=100").then((value) => setAgents(value.items.filter((item) => item.isActive && (item.roles ?? [item.role]).some((role) => canonicalRole(role) === "SalesAgent")))).catch(() => undefined);
  }, []);
  useEffect(() => {
    setLoading(true);
    setError("");
    const currentQuery = queryFor(period);
    const previousQuery = queryFor("previous");
    const goalQuery = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    if (hasRole(session.user?.role, ["Finance"])) {
      api.reports.downPayments(currentQuery).then((value) => setPayments(value as Payment)).catch((e) => setError(errorMessage(e, "Unable to load finance reports."))).finally(() => setLoading(false));
      return;
    }
    Promise.all([
      api.reports.overview(currentQuery),
      api.reports.conversion(currentQuery),
      api.reports.goals(goalQuery),
      api.reports.leaderboard(currentQuery),
      api.reports.downPayments(currentQuery),
      api.reports.overview(previousQuery),
      api.reports.conversion(previousQuery),
      api.reports.downPayments(previousQuery),
    ]).then(([overview, conversionResult, goalResult, leaderboardResult, paymentResult, previousOverview, previousConversionResult, previousPaymentResult]) => {
      setReport(overview as Overview);
      setConversion(conversionResult as Conversion);
      setGoal(goalResult as Goal);
      setLeaderboard(leaderboardResult as AgentRow[]);
      setPayments(paymentResult as Payment);
      setPreviousReport(previousOverview as Overview);
      setPreviousConversion(previousConversionResult as Conversion);
      setPreviousPayments(previousPaymentResult as Payment);
    }).catch((e) => setError(errorMessage(e, "Unable to load reports."))).finally(() => setLoading(false));
  }, [period, agentId, realtimeRevision]);

  const money = (value?: number | null) => value == null ? "—" : `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
  const delta = (current?: number, previous?: number) => {
    if (current == null || previous == null) return "";
    const change = current - previous;
    return `${change >= 0 ? "↑" : "↓"} ${Math.abs(change).toLocaleString()} vs previous month`;
  };
  const rate = conversion?.rates ?? {};
  const reached = (key: string) => report?.totalLeads ? Math.round(report.totalLeads * (rate[key] ?? 0) / 100) : 0;
  const funnel = [
    ["New", "New leads"],
    ["Inquiry", "Inquiry"],
    ["Nurturing", "Nurturing"],
    ["DownPaymentPending", "Invoice & Documents"],
    ["ContractReview", "Contract Review"],
    ["ContractSigned", "Contract Signed"],
    ["EndorsedToAdmin", "Endorsed"],
    ["Acknowledged", "Acknowledged"],
  ].map(([key, label]) => ({ key, label, count: reached(key), percent: rate[key] ?? 0 }));
  const largestDrop = funnel.slice(1).reduce((largest, current, index) => {
    const prior = funnel[index];
    const loss = prior.count - current.count;
    return loss > largest.loss ? { from: prior, to: current, loss } : largest;
  }, { from: funnel[0], to: funnel[1], loss: 0 });
  const goalTarget = goal?.target ?? 0;
  const goalAchieved = goal?.achieved ?? 0;
  const elapsedMonths = Math.max(1, new Date().getMonth());
  const expectedByNow = Math.round(goalTarget * elapsedMonths / 12);
  const remainingMonths = Math.max(1, 12 - elapsedMonths);
  const goalBehind = Math.max(0, expectedByNow - goalAchieved);
  const collectionRate = payments && payments.totalInvoiced > 0 ? Math.round(payments.totalConfirmed / payments.totalInvoiced * 100) : 0;
  const revenueDelta = payments && previousPayments ? delta(payments.totalConfirmed, previousPayments.totalConfirmed) : "";
  const conversionDelta = conversion && previousConversion ? delta(rate.ContractReview, previousConversion.rates.ContractReview) : "";
  const insights = [
    goalTarget > 0 && goalAchieved === 0 ? { tone: "danger", title: `No franchises endorsed yet`, detail: `0 of ${goalTarget} annual target completed.` } : null,
    largestDrop.loss > 0 ? { tone: "warning", title: `${largestDrop.loss} opportunities stalled before ${largestDrop.to.label}`, detail: `Review pending work between ${largestDrop.from.label} and ${largestDrop.to.label}.` } : null,
    payments && payments.totalInvoiced > 0 && payments.totalConfirmed === payments.totalInvoiced ? { tone: "success", title: "All invoiced payments have been collected", detail: `${money(payments.totalInvoiced)} invoiced · ${money(payments.totalConfirmed)} confirmed.` } : null,
  ].filter(Boolean) as { tone: "danger" | "warning" | "success"; title: string; detail: string }[];
  const groupedConversion = [
    ["Lead acquisition", "New", "Inquiry"],
    ["Qualification", "Inquiry", "Qualified"],
    ["Commercial", "Qualified", "DownPaymentPending"],
    ["Contracting", "DownPaymentPending", "ContractReview"],
    ["Contracting", "ContractReview", "ContractSigned"],
    ["Franchise launch", "ContractSigned", "EndorsedToAdmin"],
    ["Franchise launch", "EndorsedToAdmin", "Acknowledged"],
  ].map(([group, from, to]) => {
    const fromCount = reached(from);
    const toCount = reached(to);
    return { group, from, to, fromCount, toCount, percentage: fromCount ? Math.round(toCount / fromCount * 100) : 0 };
  });
  const topPerformer = leaderboard[0];
  if (loading) return <Page title="Reports" subtitle="Preparing an operational view of performance and next actions."><Loading /></Page>;
  if (error) return <Page title="Reports" subtitle={error}><button className="button button-secondary" onClick={() => window.location.reload()}>Try again</button></Page>;
  if (hasRole(session.user?.role, ["Finance"])) return (
    <Page title="Finance reports" subtitle="Collection performance and payment risk.">
      <ReportContext period={period} setPeriod={setPeriod} agentId={agentId} setAgentId={setAgentId} agents={agents} label={labelForPeriod(period)} />
      <PaymentPerformance payments={payments} />
    </Page>
  );
  return (
    <Page title="Reports" subtitle="Performance, bottlenecks, and the actions that move the franchise operation forward.">
      <ReportContext period={period} setPeriod={setPeriod} agentId={agentId} setAgentId={setAgentId} agents={agents} label={labelForPeriod(period)} />
      <section className="metric-grid report-metrics report-metrics-four">
        <Metric label="Total leads" value={report ? String(report.totalLeads) : "—"} hint={delta(report?.totalLeads, previousReport?.totalLeads)} icon={UsersRound} tone="red" />
        <Metric label="Confirmed revenue" value={money(payments?.totalConfirmed ?? report?.confirmedDownPayments)} hint={`${payments ? `${collectionRate}% collected` : "Finance confirmed"}${revenueDelta ? ` · ${revenueDelta}` : ""}`} icon={WalletCards} tone="green" />
        <Metric label="Overall conversion" value={`${rate.ContractReview ?? 0}%`} hint={`${reached("ContractReview")} of ${report?.totalLeads ?? 0} reached Contract Review${conversionDelta ? ` · ${conversionDelta}` : ""}`} icon={Activity} tone="blue" />
        <Metric label={`${goal?.year ?? new Date().getFullYear()} goal`} value={`${goalAchieved} / ${goalTarget} endorsed`} hint={`${Math.max(0, goalTarget - goalAchieved)} remaining · ${remainingMonths} months left`} icon={CheckCircle2} tone="amber" />
      </section>
      <section className="panel report-panel report-insights">
        <PanelHeader title="Insights requiring attention" subtitle="Signals worth acting on this reporting period." />
        <div className="insight-list">
          {insights.map((item) => <div className={`report-insight ${item.tone}`} key={item.title}><span>{item.tone === "success" ? "✓" : "!"}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>)}
          {!insights.length && <div className="report-insight success"><span>✓</span><div><strong>No immediate bottleneck detected</strong><small>Keep monitoring the next stage transition and collection rate.</small></div></div>}
        </div>
      </section>
      <div className="report-two-column">
        <section className="panel report-panel funnel-panel">
          <PanelHeader title="Pipeline funnel" subtitle="Cumulative opportunities that reached each milestone." />
          <div className="funnel-list">
            {funnel.map((item, index) => <div className="funnel-step" key={item.key}><div className="funnel-step-label"><strong>{item.count}</strong><span>{item.label}</span><em>{item.percent}%</em></div><div className="funnel-track"><i style={{ width: `${Math.max(item.percent, item.count ? 4 : 0)}%` }} /></div>{index < funnel.length - 1 && <div className="funnel-arrow">↓</div>}</div>)}
          </div>
          {largestDrop.loss > 0 && <div className="bottleneck-callout"><AlertTriangle size={16} /><span><strong>Largest drop-off: {largestDrop.from.label} → {largestDrop.to.label}</strong>{Math.round(largestDrop.loss / Math.max(1, largestDrop.from.count) * 100)}% of opportunities are stalled or lost here.</span></div>}
        </section>
        <section className="panel report-panel goal-panel">
          <PanelHeader title={`${goal?.year ?? new Date().getFullYear()} franchise goal`} subtitle="Are endorsements on pace for the annual target?" />
          <div className="goal-progress-heading"><strong>{goalAchieved} / {goalTarget} endorsed</strong><span>{goal?.completionPercentage ?? 0}%</span></div>
          <div className="goal-progress-track"><i style={{ width: `${Math.min(100, goal?.completionPercentage ?? 0)}%` }} /></div>
          <div className="goal-pace-grid"><Info label="Target pace by now" value={String(expectedByNow)} /><Info label="Actual" value={String(goalAchieved)} /><Info label="Behind target" value={String(goalBehind)} /></div>
          <div className="goal-required-pace"><span>Required pace</span><strong>{Math.ceil(Math.max(0, goalTarget - goalAchieved) / remainingMonths)} endorsements/month</strong><small>to hit the annual target</small></div>
        </section>
      </div>
      <section className="panel report-panel">
        <PanelHeader title="Conversion by stage" subtitle="Grouped transitions make the weak handoff visible." />
        <div className="conversion-groups">{groupedConversion.map((item) => <div className="conversion-group" key={`${item.from}-${item.to}`}><span>{item.group}</span><strong>{labelForState(item.from as LeadState)} → {labelForState(item.to as LeadState)}</strong><div className="report-track"><i className={item.percentage < 50 ? "weak" : ""} style={{ width: `${Math.max(2, item.percentage)}%` }} /></div><em>{item.percentage}% <small>({item.toCount} / {item.fromCount})</small></em></div>)}</div>
      </section>
      <div className="report-two-column">
        <section className="panel report-panel">
          <PanelHeader title="Agent performance" subtitle="Productivity, conversion, and confirmed revenue." />
          <div className="report-table"><div className="report-table-row report-table-heading"><span>Agent</span><span>Leads</span><span>Qualified</span><span>Conversion</span><span>Revenue</span><span>Endorsed</span></div>{leaderboard.map((item) => <div className="report-table-row" key={item.agentId}><strong>{item.agentName}</strong><span>{item.leads}</span><span>{item.qualified}</span><span className={item.leads && item.qualified / item.leads < .5 ? "weak-text" : ""}>{item.leads ? `${Math.round(item.qualified / item.leads * 100)}%` : "0%"}</span><span>{money(item.confirmedRevenue ?? 0)}</span><span>{item.endorsed}</span></div>)}</div>{topPerformer && <div className="top-performer"><CheckCircle2 size={15} /><span><strong>Top performer: {topPerformer.agentName}</strong>{topPerformer.qualified} qualified opportunities · {money(topPerformer.confirmedRevenue ?? 0)} confirmed</span></div>}</section>
        <PaymentPerformance payments={payments} />
      </div>
    </Page>
  );
}

function ReportContext({ period, setPeriod, agentId, setAgentId, agents, label }: { period: "current" | "previous" | "year"; setPeriod: (value: "current" | "previous" | "year") => void; agentId: string; setAgentId: (value: string) => void; agents: { id: string; displayName: string; role: string; isActive: boolean }[]; label: string }) {
  return <section className="report-context"><ReportPeriodPicker period={period} setPeriod={setPeriod} label={label} /><label><span>Branch</span><select disabled><option>All branches</option></select></label><label><span>Agent</span><select value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">All agents</option>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.displayName}</option>)}</select></label><label><span>Compare with</span><select defaultValue="previous"><option value="previous">Previous month</option></select></label></section>;
}

function ReportPeriodPicker({ period, setPeriod, label }: { period: "current" | "previous" | "year"; setPeriod: (value: "current" | "previous" | "year") => void; label: string }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const options: { value: "current" | "previous" | "year"; title: string; description: string; tone: string }[] = [
    { value: "current", title: "This month", description: "Live month-to-date view", tone: "red" },
    { value: "previous", title: "Previous month", description: "Completed prior month", tone: "amber" },
    { value: "year", title: "Year to date", description: "January through this period", tone: "blue" },
  ];
  return <div className="report-date-picker" ref={pickerRef}><button type="button" className={`report-date-trigger ${open ? "open" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="listbox"><span className="report-date-icon"><CalendarDays size={17} /></span><span className="report-date-trigger-copy"><small>REPORTING PERIOD</small><strong>{label}</strong></span><ChevronDown size={16} className="report-date-chevron" /></button>{open && <div className="report-date-menu" role="listbox" aria-label="Reporting period"><div className="report-date-menu-heading"><strong>Choose a reporting window</strong><span>Use a preset to refresh every report.</span></div><div className="report-date-options">{options.map((option) => <button type="button" role="option" aria-selected={period === option.value} className={`report-date-option ${period === option.value ? "active" : ""}`} key={option.value} onClick={() => { setPeriod(option.value); setOpen(false); }}><span className={`report-date-option-dot ${option.tone}`} /><span className="report-date-option-copy"><strong>{option.title}</strong><small>{option.description}</small></span>{period === option.value && <CheckCircle2 size={16} />}</button>)}</div></div>}</div>;
}

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function BrandedDateTimePicker({ value, onChange, selectedLabel = "Meeting time", emptyLabel = "Optional · choose a date and time", clearLabel = "Clear date and time", required = false }: { value: string; onChange: (value: string) => void; selectedLabel?: string; emptyLabel?: string; clearLabel?: string; required?: boolean }) {
  const selectedDate = parseLocalDateTime(value);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const date = selectedDate ?? new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedDate) setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  useEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return;
    }
    const updatePopoverPosition = () => {
      const bounds = pickerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const viewportPadding = 12;
      const width = Math.min(320, Math.max(180, window.innerWidth - viewportPadding * 2));
      const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
      const left = Math.min(Math.max(viewportPadding, bounds.left), maxLeft);
      const estimatedHeight = 315;
      const opensAbove = bounds.bottom + estimatedHeight > window.innerHeight - viewportPadding && bounds.top > estimatedHeight + viewportPadding;
      setPopoverStyle(opensAbove
        ? { left, width, bottom: Math.max(viewportPadding, window.innerHeight - bounds.top + 8) }
        : { left, width, top: Math.min(Math.max(viewportPadding, bounds.bottom + 8), Math.max(viewportPadding, window.innerHeight - estimatedHeight - viewportPadding)) });
    };
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open]);
  const baseDate = selectedDate ?? new Date();
  const hour12 = ((baseDate.getHours() + 11) % 12) + 1;
  const meridiem = baseDate.getHours() >= 12 ? "PM" : "AM";
  const monthTitle = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(viewMonth);
  const displayValue = selectedDate
    ? new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(selectedDate)
    : "Choose date and time";
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: 42 }, (_, index) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index - firstDay + 1));
  const todayKey = localDateKey(new Date());
  const chooseDate = (date: Date) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), baseDate.getHours(), baseDate.getMinutes());
    onChange(localDateTimeValue(next));
    setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };
  const chooseTime = (nextHour12: number, nextMinute: number, nextMeridiem: string) => {
    const nextHour = (nextHour12 % 12) + (nextMeridiem === "PM" ? 12 : 0);
    const next = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), nextHour, nextMinute);
    onChange(localDateTimeValue(next));
  };
  return <div className="branded-datetime" ref={pickerRef}><div className="branded-datetime-trigger-row"><button type="button" className={`branded-datetime-trigger ${open ? "open" : ""} ${selectedDate ? "has-value" : ""}`} onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="dialog" aria-required={required}><span className="branded-datetime-icon"><CalendarDays size={16} /></span><span className="branded-datetime-copy"><strong>{displayValue}</strong><small>{selectedDate ? selectedLabel : emptyLabel}</small></span><ChevronDown size={16} className="branded-datetime-chevron" /></button>{selectedDate && <button type="button" className="branded-datetime-clear" onClick={() => onChange("")} aria-label={clearLabel}><X size={14} /></button>}</div>{open && popoverStyle && <div className="branded-datetime-popover" style={popoverStyle} role="dialog" aria-label="Choose date and time"><div className="branded-datetime-month"><button type="button" onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button><strong>{monthTitle}</strong><button type="button" onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button></div><div className="branded-datetime-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div><div className="branded-datetime-calendar">{calendarDays.map((date) => { const inMonth = date.getMonth() === viewMonth.getMonth(); const selected = selectedDate && localDateKey(date) === localDateKey(selectedDate); const today = localDateKey(date) === todayKey; return <button type="button" key={date.toISOString()} className={`${inMonth ? "" : "muted"} ${selected ? "selected" : ""} ${today ? "today" : ""}`} onClick={() => chooseDate(date)} aria-pressed={Boolean(selected)}>{date.getDate()}</button>; })}</div><div className="branded-datetime-time"><span>Time</span><select value={hour12} onChange={(event) => chooseTime(Number(event.target.value), baseDate.getMinutes(), meridiem)} aria-label="Hour">{Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option value={hour} key={hour}>{String(hour).padStart(2, "0")}</option>)}</select><span>:</span><select value={baseDate.getMinutes()} onChange={(event) => chooseTime(hour12, Number(event.target.value), meridiem)} aria-label="Minute">{Array.from({ length: 12 }, (_, index) => index * 5).map((minute) => <option value={minute} key={minute}>{String(minute).padStart(2, "0")}</option>)}</select><select value={meridiem} onChange={(event) => chooseTime(hour12, baseDate.getMinutes(), event.target.value)} aria-label="AM or PM"><option>AM</option><option>PM</option></select></div><div className="branded-datetime-actions"><button type="button" onClick={() => { const now = new Date(); chooseDate(now); }} >Today</button><button type="button" className="primary" onClick={() => setOpen(false)}>Done</button></div></div>}</div>;
}

type UserEditorValues = {
  displayName: string;
  email: string;
  roles: Role[];
  activeRole: Role;
};

const userRoleCards: { role: Role; icon: Icon }[] = [
  { role: "SalesAgent", icon: UserRound },
  { role: "GeneralManager", icon: UserRound },
  { role: "Finance", icon: BarChart3 },
  { role: "AdminTeam", icon: UsersRound },
  { role: "Leadership", icon: Crown },
];

function UserManagementPage() {
  if (!hasRole(session.user?.role, ["GeneralManager", "Leadership"]))
    return <Navigate to="/" replace />;
  return <UserManagementContent />;
}

function UserManagementContent() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; user?: UserRecord } | null>(null);
  const canManageUsers = hasRole(session.user?.role, ["GeneralManager"]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (activeFilter !== "all") params.set("active", activeFilter);
      const result = await api.users.list(`?${params.toString()}`);
      setUsers(result.items);
      setTotal(result.total);
    } catch (e) {
      setNotice({ message: errorMessage(e, "Unable to load users."), tone: "error" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [page, search, activeFilter]);

  const submit = async (values: UserEditorValues) => {
    if (values.roles.length === 0) throw new Error("Select at least one role.");
    if (!values.roles.includes(values.activeRole)) throw new Error("Choose an active role from the assigned roles.");
    if (editor?.mode === "create") {
      await api.users.create({ email: values.email, displayName: values.displayName, roles: values.roles, role: values.activeRole });
      setNotice({ message: "User created and activation email sent.", tone: "success" });
    } else if (editor?.user) {
      await api.users.update(editor.user.id, { displayName: values.displayName, roles: values.roles, role: values.activeRole });
      setNotice({ message: "User access updated.", tone: "success" });
    }
    setEditor(null);
    await load();
  };

  const deactivate = async (user: UserRecord) => {
    if (!window.confirm(`Deactivate ${user.displayName}? They will no longer be able to sign in.`)) return;
    try {
      await api.users.deactivate(user.id);
      setNotice({ message: `${user.displayName} was deactivated.`, tone: "success" });
      await load();
    } catch (e) {
      setNotice({ message: errorMessage(e, "Unable to deactivate user."), tone: "error" });
    }
  };

  return (
    <Page title="User management" subtitle={canManageUsers ? "Create staff accounts, grant multiple roles, and choose the role each person is acting as." : "View workspace users, assigned roles, and account status."}>
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      <section className="panel user-management-panel">
        <div className="user-management-heading">
          <div><PanelHeader title="Workspace users" subtitle={`${total} account${total === 1 ? "" : "s"} in this organization.`} /></div>
          {canManageUsers && <button className="button button-primary" onClick={() => setEditor({ mode: "create" })}><Plus size={16} /> Create user</button>}
        </div>
        <div className="user-management-toolbar">
          <label className="toolbar-search"><Search size={16} /><input value={searchDraft} placeholder="Search name or email" onChange={(event) => setSearchDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setPage(1); setSearch(searchDraft.trim()); } }} /></label>
          <select value={activeFilter} onChange={(event) => { setPage(1); setActiveFilter(event.target.value); }}><option value="all">All accounts</option><option value="true">Active only</option><option value="false">Inactive only</option></select>
          <button className="button button-secondary" onClick={() => { setPage(1); setSearch(searchDraft.trim()); }}>Search</button>
        </div>
        {loading ? <Loading /> : users.length === 0 ? <EmptyState icon={UsersRound} title="No users found" text="Try another search or create the first account." /> : (
          <div className="user-table-wrap"><table className="user-table"><thead><tr><th>User</th><th>Assigned roles</th><th>Active role</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{users.map((user) => {
            const roles = user.roles?.length ? user.roles : [user.role];
            return <tr key={user.id}><td><div className="user-table-name"><div className="avatar">{initials(user.displayName)}</div><span><strong>{user.displayName}</strong><small>{user.email}</small></span></div></td><td><div className="role-pills">{roles.map((role) => <span key={role} className="role-pill">{roleLabel(role)}</span>)}</div></td><td><span className="active-role-label">{roleLabel(user.role)}</span></td><td><span className={`account-status ${user.isActive ? "active" : "inactive"}`}>{user.isActive ? "Active" : "Inactive"}</span></td><td className="muted">{formatDate(user.createdAt)}</td><td>{canManageUsers && <div className="table-actions"><button className="button button-quiet" onClick={() => setEditor({ mode: "edit", user })}>Edit access</button>{user.isActive && user.id !== session.user?.id && <button className="button button-quiet danger" onClick={() => void deactivate(user)}>Deactivate</button>}</div>}</td></tr>;
          })}</tbody></table></div>
        )}
        <div className="pagination-bar"><span className="muted">Page {page} of {totalPages}</span><div><button className="button button-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} /> Previous</button><button className="button button-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight size={15} /></button></div></div>
      </section>
      {editor && <Modal title={editor.mode === "create" ? "Create user" : "Edit user access"} subtitle={editor.mode === "create" ? "Add a user and send a secure activation email." : "Assign one or more roles and choose the role used for the next session."} onClose={() => setEditor(null)}><UserEditorForm mode={editor.mode} user={editor.user} onSubmit={submit} onCancel={() => setEditor(null)} /></Modal>}
    </Page>
  );
}

function UserEditorForm({ mode, user, onSubmit, onCancel }: { mode: "create" | "edit"; user?: UserRecord; onSubmit: (values: UserEditorValues) => Promise<void>; onCancel: () => void }) {
  const existingRoles: Role[] = user?.roles?.length ? user.roles.map(canonicalRole).filter((role): role is Role => Boolean(role)) : user ? [canonicalRole(user.role) ?? "SalesAgent"] : ["SalesAgent"];
  const [values, setValues] = useState<UserEditorValues>({ displayName: user?.displayName ?? "", email: user?.email ?? "", roles: existingRoles, activeRole: canonicalRole(user?.role) ?? existingRoles[0] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggleRole = (role: Role) => setValues((current) => { const roles = current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role]; return { ...current, roles, activeRole: roles.includes(current.activeRole) ? current.activeRole : (roles[0] ?? role) }; });
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await onSubmit(values); } catch (e) { setError(errorMessage(e, "Unable to save user.")); } finally { setBusy(false); } };
  return <form className="stack-form user-editor-form" onSubmit={submit}><div className="form-grid"><label><span>Full name</span><input required minLength={2} maxLength={160} value={values.displayName} onChange={(event) => setValues({ ...values, displayName: event.target.value })} placeholder="Enter full name" /></label><label><span>Email</span><input required type="email" maxLength={254} disabled={mode === "edit"} value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} placeholder="Enter email address" /></label></div>{mode === "create" && <div className="user-editor-info"><CircleHelp size={16} /><span>A secure temporary password will be generated in the background and sent in the activation email. The user will change it on first sign-in.</span></div>}<fieldset className="role-editor"><legend>Assigned roles</legend><div className="role-card-grid">{userRoleCards.map(({ role, icon: RoleIcon }) => { const selected = values.roles.includes(role); return <label key={role} className={`role-card ${selected ? "selected" : ""}`}><input type="checkbox" checked={selected} onChange={() => toggleRole(role)} /><span className="role-card-icon"><RoleIcon size={17} /></span><span className="role-card-name">{roleLabel(role)}</span><span className="role-card-check">{selected ? <CheckCircle2 size={17} /> : <span />}</span></label>; })}</div></fieldset><label className="primary-role-field"><span>Primary role</span><small>Used as the default workspace after sign-in.</small><select value={values.activeRole} onChange={(event) => setValues({ ...values, activeRole: event.target.value as Role })}>{values.roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="user-editor-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={busy || values.roles.length === 0}>{busy ? "Saving…" : mode === "create" ? "Create user & send invite" : "Save access"}</button></div></form>;
}

function PaymentPerformance({ payments }: { payments: { totalInvoiced: number; totalConfirmed: number; pendingCount: number; pendingAmount?: number } | null }) {
  const invoiced = payments?.totalInvoiced ?? 0;
  const confirmed = payments?.totalConfirmed ?? 0;
  const collectionRate = invoiced ? Math.round(confirmed / invoiced * 100) : 0;
  return <section className="panel report-panel payment-performance"><PanelHeader title="Payment performance" subtitle="A single view of invoiced, collected, and outstanding cash." /><div className="payment-performance-total"><strong>{payments ? `₱${confirmed.toLocaleString()}` : "—"}</strong><span>Confirmed collections</span></div><div className="payment-performance-stats"><Info label="Invoiced" value={payments ? `₱${invoiced.toLocaleString()}` : "—"} /><Info label="Confirmed" value={payments ? `₱${confirmed.toLocaleString()}` : "—"} /><Info label="Pending" value={payments ? `₱${(payments.pendingAmount ?? 0).toLocaleString()}` : "—"} /></div><div className="collection-rate"><strong>Collection rate: {collectionRate}%</strong><span>{payments?.pendingCount ?? 0} payment(s) awaiting confirmation</span></div></section>;
}

function SettingsPage() {
  if (!hasRole(session.user?.role, ["GeneralManager", "Leadership"]))
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
  const canEditSettings = hasRole(session.user?.role, ["GeneralManager"]);
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

function EventsPage() {
  if (!hasRole(session.user?.role, ["GeneralManager"]))
    return <Navigate to="/" replace />;

  const realtimeRevision = useRealtimeRefresh();
  const navigate = useNavigate();
  const [events, setEvents] = useState<LeadCaptureEventRecord[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [eventPage, setEventPage] = useState(1);
  const [form, setForm] = useState({ name: "", description: "", startsAt: localDateTimeValue(new Date()), endsAt: localDateTimeValue(new Date(Date.now() + 8 * 60 * 60 * 1000)), activate: true });
  const pageSize = 5;

  const eventStatus = (item: LeadCaptureEventRecord) => {
    const startsAt = new Date(item.startsAt).getTime();
    const endsAt = new Date(item.endsAt).getTime();
    if (item.isOpen) return "Open";
    if (item.isActive && startsAt > Date.now()) return "Upcoming";
    if (item.isActive && endsAt <= Date.now()) return "Closed";
    return "Closed";
  };
  const eventStatusClass = (item: LeadCaptureEventRecord) => eventStatus(item).toLowerCase();
  const load = async () => {
    try {
      const [nextEvents, leadPage] = await Promise.all([
        api.leadCaptureEvents.list(),
        api.leads.list("?limit=100&sort=createdAt").catch(() => ({ items: [] as Lead[] })),
      ]);
      setEvents(nextEvents);
      setRecentLeads(leadPage.items);
      setSelectedId((current) => current && nextEvents.some((item) => item.id === current) ? current : nextEvents[0]?.id ?? null);
    } catch (error) {
      setNotice({ message: errorMessage(error, "Unable to load prospect events."), tone: "error" });
    }
  };
  useEffect(() => { void load(); }, [realtimeRevision]);

  const selected = events.find((item) => item.id === selectedId) ?? null;
  useEffect(() => {
    setCopied(false);
    if (!selected?.publicUrl) { setQr(""); return; }
    QRCode.toDataURL(selected.publicUrl, { width: 320, margin: 2, color: { dark: "#18202a", light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
  }, [selected]);

  const now = Date.now();
  const filteredEvents = events.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${item.name} ${item.description ?? ""}`.toLowerCase().includes(query);
    const status = eventStatus(item).toLowerCase();
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const date = new Date(item.startsAt);
    const current = new Date();
    const matchesDate = dateFilter === "all" || (dateFilter === "month" && date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth()) || (dateFilter === "next30" && date.getTime() >= now && date.getTime() <= now + 30 * 24 * 60 * 60 * 1000);
    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPage = Math.min(eventPage, totalPages);
  const pageEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeCount = events.filter((item) => item.isOpen).length;
  const upcoming = events.filter((item) => eventStatus(item) === "Upcoming").sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  const closedCount = events.filter((item) => eventStatus(item) === "Closed").length;
  const totalProspects = events.reduce((sum, item) => sum + item.registrationCount, 0);
  const selectedProspects = selected ? recentLeads.filter((lead) => lead.captureEventId === selected.id).slice(0, 3) : [];

  const openCreate = () => {
    setEditing(false);
    setForm({ name: "", description: "", startsAt: localDateTimeValue(new Date()), endsAt: localDateTimeValue(new Date(Date.now() + 8 * 60 * 60 * 1000)), activate: true });
    setShowCreate(true);
  };
  const openEdit = () => {
    if (!selected) return;
    setEditing(true);
    setForm({ name: selected.name, description: selected.description ?? "", startsAt: localDateTimeValue(new Date(selected.startsAt)), endsAt: localDateTimeValue(new Date(selected.endsAt)), activate: selected.isActive });
    setShowCreate(true);
  };
  const saveEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.startsAt || !form.endsAt) {
      setNotice({
        message: !form.startsAt || !form.endsAt ? "Choose both a start and end date and time." : "Enter an event name.",
        tone: "error",
      });
      return;
    }
    setCreating(true); setNotice(null);
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), activate: form.activate };
      const saved = editing && selected ? await api.leadCaptureEvents.update(selected.id, payload) : await api.leadCaptureEvents.create(payload);
      setEvents((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedId(saved.id);
      setShowCreate(false);
      setNotice({ message: editing ? "Event details updated." : "Event created. Download the QR and display it at the event.", tone: "success" });
    } catch (error) {
      setNotice({ message: errorMessage(error, editing ? "Unable to update the event." : "Unable to create the event."), tone: "error" });
    } finally { setCreating(false); }
  };
  const updateEvent = async (action: "activate" | "deactivate" | "regenerateLink") => {
    if (!selected) return;
    setBusyId(selected.id); setNotice(null);
    try {
      const next = await api.leadCaptureEvents[action](selected.id);
      setEvents((current) => current.map((item) => item.id === next.id ? next : item));
      if (action === "regenerateLink") setNotice({ message: "A new QR link was generated. The previous link is no longer valid.", tone: "success" });
    } catch (error) {
      setNotice({ message: errorMessage(error, "Unable to update the event."), tone: "error" });
    } finally { setBusyId(""); }
  };
  const copyLink = async () => {
    if (!selected?.publicUrl) return;
    try { await navigator.clipboard.writeText(selected.publicUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setNotice({ message: "Copying is unavailable in this browser. Select the link and copy it manually.", tone: "error" }); }
  };

  return (
    <Page
      title="Prospect capture events"
      subtitle="Create and manage prospect capture links and QR codes for campaigns, expos, and community events."
      actions={<button className="button button-primary" onClick={openCreate}><Plus size={16} /> Create event</button>}
    >
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      <div className="metric-grid event-metric-grid">
        <Metric label="Active events" value={String(activeCount)} hint="Currently accepting prospects" icon={CalendarDays} tone="red" />
        <Metric label="Upcoming" value={String(events.filter((item) => eventStatus(item) === "Upcoming").length)} hint={upcoming ? `Next: ${upcoming.name}` : "No upcoming events"} icon={Clock3} tone="amber" />
        <Metric label="Closed" value={String(closedCount)} hint="Past or closed events" icon={Archive} tone="blue" />
        <Metric label="Total prospects" value={totalProspects.toLocaleString()} hint="Captured across all events" icon={UsersRound} tone="green" />
      </div>

      <div className="event-workspace-grid">
        <section className="panel event-catalog-panel">
          <div className="event-toolbar">
            <label className="event-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setEventPage(1); }} placeholder="Search events…" aria-label="Search events" /></label>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setEventPage(1); }} aria-label="Filter by status"><option value="all">Status: All</option><option value="open">Open</option><option value="upcoming">Upcoming</option><option value="closed">Closed</option></select>
            <select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setEventPage(1); }} aria-label="Filter by date"><option value="all">Date: All</option><option value="month">This month</option><option value="next30">Next 30 days</option></select>
            <button type="button" className="event-filter-button" onClick={() => { setSearch(""); setStatusFilter("all"); setDateFilter("all"); setEventPage(1); }}><RefreshCw size={14} /> Reset</button>
          </div>
          <div className="event-table-head"><span>Event name</span><span>Schedule</span><span>Status</span><span>Prospects</span><span> </span></div>
          <div className="event-table-body">
            {pageEvents.length ? pageEvents.map((item) => (
              <button type="button" key={item.id} className={`event-table-row ${selected?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}>
                <span className="event-table-event"><span className="event-row-icon"><CalendarDays size={15} /></span><span><strong>{item.name}</strong><small>{item.description || "Franchise prospect event"}</small></span></span>
                <span className="event-table-schedule"><strong>{formatDate(item.startsAt)}</strong><small>{new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(item.startsAt))} – {new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(item.endsAt))}</small></span>
                <span><em className={`event-status-pill ${eventStatusClass(item)}`}>{eventStatus(item)}</em></span>
                <span className="event-prospect-count">{item.registrationCount.toLocaleString()}<small>captured</small></span>
                <ChevronRight size={15} className="event-row-chevron" />
              </button>
            )) : <EmptyState icon={CalendarDays} title="No events match" text="Create a prospect event or adjust the filters." />}
          </div>
          <div className="event-pagination"><span>Showing {filteredEvents.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredEvents.length)} of {filteredEvents.length} events</span><div><button type="button" className="icon-button" disabled={currentPage <= 1} onClick={() => setEventPage((page) => Math.max(1, page - 1))} aria-label="Previous page"><ChevronLeft size={15} /></button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 3).map((page) => <button type="button" key={page} className={`event-page-number ${currentPage === page ? "active" : ""}`} onClick={() => setEventPage(page)}>{page}</button>)}<button type="button" className="icon-button" disabled={currentPage >= totalPages} onClick={() => setEventPage((page) => Math.min(totalPages, page + 1))} aria-label="Next page"><ChevronRight size={15} /></button></div></div>
        </section>

        <section className="panel event-detail-panel">
          {selected ? <>
            <div className="event-detail-heading"><div className="event-detail-title"><span className="event-detail-icon"><CalendarDays size={18} /></span><div><h2>{selected.name}</h2><span className={`event-status-pill ${eventStatusClass(selected)}`}>{eventStatus(selected)}</span></div></div><button type="button" className="icon-button" onClick={() => setSelectedId(null)} aria-label="Close event details"><X size={17} /></button></div>
            <div className="event-detail-meta"><span><CalendarDays size={14} /> {formatDate(selected.startsAt)}</span><span><Clock3 size={14} /> {new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(selected.startsAt))} – {new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(selected.endsAt))}</span></div>
            <div className="event-detail-hero"><div className="event-total-prospects"><span>Total prospects</span><strong>{selected.registrationCount.toLocaleString()}</strong><small>captured for this event</small></div><div className="event-qr-frame">{qr ? <img src={qr} alt={`QR code for ${selected.name}`} /> : <div className="event-qr-empty"><QrCode size={32} /><span>Regenerate the link to show the QR</span></div>}</div></div>
            <div className="event-link-label">Public prospect link</div><div className="event-link-row"><input readOnly value={selected.publicUrl || "Link needs regeneration"} aria-label="Public prospect link" /><button type="button" className="event-copy-button" disabled={!selected.publicUrl} onClick={copyLink}><Copy size={14} /> {copied ? "Copied" : "Copy link"}</button></div>
            {!selected.publicUrl && <p className="event-link-help">This event was created before persistent links were enabled. Regenerate the link once to restore its QR code and save it for future reloads.</p>}
            <div className="event-detail-actions"><a className="button button-secondary" href={qr || undefined} download={qr ? `${selected.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png` : undefined} onClick={(event) => { if (!qr) event.preventDefault(); }}>{qr ? "Download QR" : "QR unavailable"}<ArrowUpRight size={14} /></a>{selected.publicUrl ? <a className="button button-secondary" href={selected.publicUrl} target="_blank" rel="noreferrer">Open prospect page <ArrowUpRight size={14} /></a> : <button type="button" className="button button-secondary" onClick={() => updateEvent("regenerateLink")}>Regenerate link <ArrowUpRight size={14} /></button>}</div>
            <div className="event-quick-actions"><span>Quick actions</span><div><button type="button" className="button button-quiet" onClick={openEdit}><Pencil size={14} /> Edit event</button><button type="button" className="button button-quiet" onClick={() => navigate("/pipeline")}><UsersRound size={14} /> View prospects</button><button type="button" className="button button-quiet danger" disabled={busyId === selected.id} onClick={() => updateEvent(selected.isActive ? "deactivate" : "activate")}>{selected.isActive ? <Archive size={14} /> : <CheckCircle2 size={14} />}{selected.isActive ? "Close event" : "Open event"}</button></div></div>
          </> : <EmptyState icon={QrCode} title="Select an event" text="Choose an event from the list to view its QR code, public link, and prospect activity." />}
        </section>
      </div>

      <section className="panel event-recent-panel"><div className="event-recent-heading"><div><h3>Recent prospects</h3><p>Latest franchise opportunities captured through the selected event.</p></div>{selected && <button type="button" className="text-link" onClick={() => navigate("/pipeline")}>View all prospects <ArrowUpRight size={14} /></button>}</div>{selectedProspects.length ? <div className="event-recent-table"><div className="event-recent-row event-recent-head"><span>Prospect</span><span>Event</span><span>Captured</span><span>Contact</span><span>Status</span></div>{selectedProspects.map((lead) => <NavLink to={`/leads/${lead.id}`} className="event-recent-row" key={lead.id}><span className="event-recent-name"><span className="avatar avatar-small">{initials(lead.fullName)}</span><strong>{lead.fullName}</strong></span><span>{selected?.name}</span><span>{formatDateTime(lead.createdAt)}</span><span>{lead.email || lead.contactNumber || "Not provided"}</span><span><em className="event-status-pill prospect-status">New</em></span></NavLink>)}</div> : <div className="event-recent-empty"><UsersRound size={19} /><span><strong>{selected ? "No prospects captured yet" : "Select an event to see recent prospects"}</strong><small>New franchise prospects will appear here as people complete the public form.</small></span></div>}</section>

      {showCreate && <Modal title={editing ? "Edit event" : "Create prospect event"} subtitle={editing ? "Update the schedule or event details without changing the public QR link." : "Set up a reusable QR link for your next franchise prospect campaign."} onClose={() => setShowCreate(false)}><form className="event-modal-form" onSubmit={saveEvent}><label>Event name<input required minLength={2} maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Community Health Expo" /></label><label>Description <span className="field-optional">(optional)</span><textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Shown to prospects before they share their details." /></label><div className="form-grid"><div className="event-date-field"><span>Starts <span className="required-mark">*</span></span><BrandedDateTimePicker value={form.startsAt} required selectedLabel="Event time" emptyLabel="Required · choose start date and time" clearLabel="Clear event start" onChange={(value) => setForm({ ...form, startsAt: value })} /></div><div className="event-date-field"><span>Ends <span className="required-mark">*</span></span><BrandedDateTimePicker value={form.endsAt} required selectedLabel="Event time" emptyLabel="Required · choose end date and time" clearLabel="Clear event end" onChange={(value) => setForm({ ...form, endsAt: value })} /></div></div><label className="event-active-toggle"><input type="checkbox" checked={form.activate} onChange={(event) => setForm({ ...form, activate: event.target.checked })} /><span className="event-active-toggle-copy"><strong>Open prospect capture immediately</strong><small>Start accepting prospect entries as soon as this event is created.</small></span></label><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" disabled={creating}>{creating ? "Saving…" : editing ? "Save changes" : "Create event"}<ArrowUpRight size={15} /></button></div></form></Modal>}
    </Page>
  );
}

function LeadDetailsEditForm({
  lead,
  onSubmit,
  onCancel,
}: {
  lead: Lead;
  onSubmit: (payload: unknown) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    fullName: lead.fullName,
    age: lead.age?.toString() ?? "",
    contactNumber: lead.contactNumber,
    email: lead.email,
    sourceOfIncome: lead.sourceOfIncome,
    address: lead.address ?? "",
    preferredLocation: lead.preferredLocation ?? "",
    industry: lead.industry ?? "",
    meetingDateTime: lead.meetingDateTime?.slice(0, 16) ?? "",
    questionsConcerns: lead.questionsConcerns ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const emailValue = form.email.trim();
  const contactNumberValue = form.contactNumber.trim();
  const invalidEmail =
    emailValue.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const invalidContactNumber =
    contactNumberValue.length > 0 && !/^[0-9+().\-\s]+$/.test(contactNumberValue);
  const invalidAge =
    form.age.trim().length > 0 &&
    (!Number.isInteger(Number(form.age)) || Number(form.age) < 18 || Number(form.age) > 120);
  const missingFields = [
    form.fullName.trim().length < 2 ? "Full name" : null,
    form.address.trim().length < 5 ? "Franchisee address" : null,
  ].filter((item): item is string => Boolean(item));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (missingFields.length || invalidEmail || invalidContactNumber || invalidAge) return;
    setBusy(true);
    try {
      await onSubmit({
        fullName: form.fullName.trim(),
        age: form.age.trim() ? Number(form.age) : null,
        contactNumber: contactNumberValue || null,
        email: emailValue || null,
        sourceOfIncome: form.sourceOfIncome.trim() || null,
        address: form.address.trim(),
        preferredLocation: form.preferredLocation.trim() || null,
        industry: form.industry.trim() || null,
        meetingDateTime: form.meetingDateTime
          ? new Date(form.meetingDateTime).toISOString()
          : null,
        questionsConcerns: form.questionsConcerns.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid lead-details-edit-form" onSubmit={submit} noValidate>
      {attempted && (missingFields.length || invalidEmail || invalidContactNumber || invalidAge) ? (
        <div className="missing-fields-summary form-wide" role="alert">
          <strong>Please complete</strong>
          <span>
            {[...missingFields,
              ...(invalidEmail ? ["Email format"] : []),
              ...(invalidContactNumber ? ["Contact number format"] : []),
              ...(invalidAge ? ["Age"] : []),
            ].join(", ")}
          </span>
        </div>
      ) : null}
      <label>
        <span>Full name <span className="required-mark">*</span></span>
        <input
          required
          minLength={2}
          maxLength={160}
          value={form.fullName}
          onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
          aria-invalid={attempted && form.fullName.trim().length < 2}
          className={attempted && form.fullName.trim().length < 2 ? "field-missing" : undefined}
        />
      </label>
      <label>
        <span>Age <span className="field-optional">(optional)</span></span>
        <input
          type="number"
          min={18}
          max={120}
          value={form.age}
          onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
          aria-invalid={attempted && invalidAge}
          className={attempted && invalidAge ? "field-missing" : undefined}
        />
      </label>
      <label>
        <span>Contact number <span className="field-optional">(optional)</span></span>
        <input
          type="tel"
          autoComplete="tel"
          placeholder="+63 917 123 4567"
          value={form.contactNumber}
          onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))}
          aria-invalid={attempted && invalidContactNumber}
          className={attempted && invalidContactNumber ? "field-missing" : undefined}
        />
      </label>
      <label>
        <span>Email <span className="field-optional">(optional)</span></span>
        <input
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          aria-invalid={attempted && invalidEmail}
          className={attempted && invalidEmail ? "field-missing" : undefined}
        />
      </label>
      <div className="form-wide">
        <label>
          <span>Franchisee address <span className="required-mark">*</span></span>
          <input
            required
            minLength={5}
            maxLength={500}
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            placeholder="Home or registered business address"
            aria-invalid={attempted && form.address.trim().length < 5}
            className={attempted && form.address.trim().length < 5 ? "field-missing" : undefined}
          />
          {attempted && form.address.trim().length < 5 ? (
            <small className="field-error">Franchisee address is required.</small>
          ) : null}
        </label>
      </div>
      <div className="form-wide">
        <label>
          <span>Proposed franchise location <span className="field-optional">(optional)</span></span>
          <input
            maxLength={240}
            value={form.preferredLocation}
            onChange={(event) => setForm((current) => ({ ...current, preferredLocation: event.target.value }))}
            placeholder="Street, barangay, city, province"
          />
        </label>
      </div>
      <SourceOfIncomeField
        value={form.sourceOfIncome}
        onChange={(sourceOfIncome) => setForm((current) => ({ ...current, sourceOfIncome }))}
      />
      <IndustryField
        value={form.industry}
        onChange={(industry) => setForm((current) => ({ ...current, industry }))}
      />
      <label>
        <span>Meeting date and time <span className="field-optional">(optional)</span></span>
        <BrandedDateTimePicker
          value={form.meetingDateTime}
          onChange={(meetingDateTime) => setForm((current) => ({ ...current, meetingDateTime }))}
        />
      </label>
      <label className="form-wide">
        <span>Questions or concerns <span className="field-optional">(optional)</span></span>
        <textarea
          rows={3}
          maxLength={4000}
          value={form.questionsConcerns}
          onChange={(event) => setForm((current) => ({ ...current, questionsConcerns: event.target.value }))}
          placeholder="Capture any context the team should know."
        />
      </label>
      <div className="form-actions form-wide">
        <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save lead details"}
        </button>
      </div>
    </form>
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
    address: "",
    preferredLocation: "",
    leadSource: "Manual",
    productLine: "",
    assignedAgentId: "",
  });
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [agents, setAgents] = useState<
    UserRecord[]
  >([]);
  const emailValue = form.email.trim();
  const contactNumberValue = form.contactNumber.trim();
  const invalidEmail =
    emailValue.length > 0 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const invalidContactNumber =
    contactNumberValue.length > 0 &&
    !/^[0-9+().\-\s]+$/.test(contactNumberValue);
  const missingFields = [
    !form.fullName.trim() ? "Full name" : null,
    form.address.trim().length < 5 ? "Franchisee address" : null,
    hasRole(session.user?.role, ["GeneralManager"]) &&
    !form.assignedAgentId
      ? "Responsible owner"
      : null,
  ].filter(Boolean) as string[];
  useEffect(() => {
    if (hasRole(session.user?.role, ["GeneralManager"]))
      api.users
        .list("?page=1&pageSize=100")
        .then((result) =>
          setAgents(
            result.items.filter(
              (item) =>
                item.isActive &&
                (item.roles ?? [item.role]).some((role) => canonicalRole(role) === "SalesAgent"),
            ),
          ),
        )
        .catch(() => undefined);
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (
      missingFields.length > 0 ||
      invalidEmail ||
      invalidContactNumber
    )
      return;
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        contactNumber: contactNumberValue || null,
        email: emailValue || null,
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
      (missingFields.length > 0 || invalidEmail || invalidContactNumber) ? (
        <div className="missing-fields-summary form-wide" role="alert">
          <strong>Please complete</strong>
          <span>
            {[...missingFields,
              ...(invalidEmail ? ["Email format"] : []),
              ...(invalidContactNumber ? ["Contact number format"] : []),
            ].join(", ")}
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
        <span>
          Contact number <span className="field-optional">(optional)</span>
        </span>
        <input
          type="tel"
          autoComplete="tel"
          placeholder="+63 917 123 4567"
          value={form.contactNumber}
          onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
          aria-invalid={attempted && invalidContactNumber}
          className={
            attempted && invalidContactNumber ? "field-missing" : undefined
          }
        />
        {attempted && invalidContactNumber ? (
          <small className="field-error">
            Enter a valid phone number, or leave it blank.
          </small>
        ) : null}
      </label>
      <label>
        <span>
          Email <span className="field-optional">(optional)</span>
        </span>
        <input
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          aria-invalid={attempted && invalidEmail}
          className={attempted && invalidEmail ? "field-missing" : undefined}
        />
        {attempted && invalidEmail ? (
          <small className="field-error">
            Enter a valid email address, or leave it blank.
          </small>
        ) : null}
      </label>
      <label>
        <span>
          Franchisee address <span className="required-mark">*</span>
        </span>
        <input
          required
          minLength={5}
          maxLength={500}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Home or registered business address"
          aria-invalid={attempted && form.address.trim().length < 5}
          className={attempted && form.address.trim().length < 5 ? "field-missing" : undefined}
        />
        {attempted && form.address.trim().length < 5 ? (
          <small className="field-error">Franchisee address is required.</small>
        ) : (
          <small className="field-hint">Used on the franchise agreement and official records.</small>
        )}
      </label>
      <div className="form-wide">
        <label>
          <span>
            Proposed franchise location <span className="field-optional">(optional)</span>
          </span>
          <input
            value={form.preferredLocation}
            onChange={(event) => setForm({ ...form, preferredLocation: event.target.value })}
            maxLength={240}
            placeholder="Street, barangay, city, province"
          />
        </label>
      </div>
      <SourceOfIncomeField
        value={form.sourceOfIncome}
        onChange={(sourceOfIncome) => setForm({ ...form, sourceOfIncome })}
      />
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
      {hasRole(session.user?.role, ["GeneralManager"]) && (
        <label>
          <span>
            Responsible owner <span className="required-mark">*</span>
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
            <option value="">Select owner</option>
            {agents.map((agent) => (
              <option value={agent.id} key={agent.id}>
                {agent.displayName} — {roleLabel(agent.role as Role)}
                {agent.id === session.user?.id ? " (You)" : ""}
              </option>
            ))}
          </select>
          {attempted && !form.assignedAgentId ? (
            <small className="field-error">Choose the responsible owner.</small>
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
  const nextStep = nextStepForLead(lead, Boolean(lead.downPaymentSubmittedForFinance));
  const nextOwner = nextActionOwnerForLead(lead, Boolean(lead.downPaymentSubmittedForFinance));
  const overdue = isOverdueLead(lead);
  return (
    <NavLink
      to={`/leads/${lead.id}`}
      className={`lead-row dashboard-focus-row ${overdue ? "is-overdue" : ""}`}
    >
      <div className={`avatar ${overdue ? "dashboard-focus-avatar-overdue" : ""}`}>
        {initials(lead.fullName)}
      </div>
      <div className="lead-row-main">
        <div className="dashboard-focus-title">
          <strong>{lead.fullName}</strong>
          <StatusPill state={lead.state} />
        </div>
        <span className="dashboard-focus-location">
          {lead.preferredLocation ?? "Location not provided"} · Updated {formatDate(lead.updatedAt)}
        </span>
        <small className="dashboard-focus-next">
          <span>Next: {nextStep.label}</span> · {nextOwner}
        </small>
      </div>
      <span className="dashboard-focus-open">
        Open <ChevronRight size={16} />
      </span>
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
function roleLabel(role: Role | string) {
  return ({
    SalesAgent: "Sales Agent",
    MarketingAgent: "Sales Agent",
    MarketingAdmin: "General Manager",
    GeneralManager: "General Manager",
    Finance: "Finance",
    AdminTeam: "Admin Team",
    Leadership: "Leadership",
  } as Record<string, string>)[role] ?? friendlyFieldLabel(role);
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
      DOH_FLOOR_PLAN: "DOH floor plan and device layout",
      LEASE_AND_ADDRESS: "Lease contract and exact site address",
      DTI_REGISTRATION: "DTI registration",
      SITE_PHOTOS: "Site photos",
      PERMITS: "Business permits",
      BUSINESS_PLAN: "Franchisee business plan",
      VALID_ID_TIN: "Valid ID and TIN",
      FRANCHISE_AGREEMENT: "Signed franchise agreement",
      TRAINING_APPLICATION: "Training application",
      PHARMACY_PERMITS: "Pharmacy licenses and permits",
    }[type] ?? friendlyFieldLabel(type)
  );
}
function statusLabel(status: string) {
  const normalized = status.trim();
  return (
    {
      NotConfigured: "Not configured",
      NotGenerated: "Not generated",
      NotStarted: "Not started",
      UploadPending: "Upload in progress",
      Uploaded: "Ready",
      Archived: "Archived",
      Pending: "Awaiting action",
      Invoiced: "Invoice generated",
      Submitted: "Awaiting Finance verification",
      Confirmed: "Payment confirmed",
      Draft: "Draft in progress",
      InReview: "Under review",
      RevisionRequested: "Changes requested",
      Approved: "Approved for signing",
      Signed: "Fully signed",
      Created: "Signing link created",
      Viewed: "Viewed by signer",
      Completed: "Signed",
      Expired: "Link expired",
      Revoked: "Link revoked",
      IN_PROGRESS: "In progress",
      COMPLETED: "Completed",
      Acknowledged: "Acknowledged",
    }[normalized] ?? friendlyFieldLabel(normalized)
  );
}

export default App;
