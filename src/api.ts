const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8080";

export type Role =
  | "SalesAgent"
  | "MarketingAgent"
  | "MarketingAdmin"
  | "GeneralManager"
  | "Finance"
  | "AdminTeam"
  | "Leadership";
export type LeadState =
  | "New"
  | "Inquiry"
  | "InquiryIncomplete"
  | "Nurturing"
  | "FollowUp"
  | "Qualified"
  | "DownPaymentPending"
  | "DownPaymentConfirmed"
  | "ContractDrafting"
  | "ContractReview"
  | "ContractSigned"
  | "PreLaunch"
  | "EndorsedToAdmin"
  | "Acknowledged";
export type ProductLine = "Abc" | "Pharmacy" | "Combo";

export interface UserProfile {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: Role;
  roles?: Role[];
  mustChangePassword?: boolean;
}
export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  roles?: Role[];
  isActive: boolean;
  createdAt: string;
}
export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: UserProfile;
}
export interface Lead {
  id: string;
  fullName: string;
  age?: number;
  contactNumber: string;
  email: string;
  sourceOfIncome: string;
  leadSource: string;
  address?: string;
  industry?: string;
  meetingDateTime?: string;
  questionsConcerns?: string;
  preferredLocation?: string;
  productLine?: ProductLine;
  listPrice?: number;
  actualPrice?: number;
  welcomeEmailStatus?: string;
  welcomeEmailQueuedAt?: string;
  welcomeEmailSentAt?: string;
  goodTimeToDiscuss?: string;
  lastCallOutcome?: string;
  state: LeadState;
  assignedAgentId: string;
  assignedAgentName?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  locationAnalysisPending: boolean;
  downPaymentSubmittedForFinance?: boolean;
  captureEventId?: string | null;
}
export interface LeadPage {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
}
export interface PublicEventLanding {
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  isOpen: boolean;
}
export interface LeadCaptureEventRecord {
  id: string;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  isOpen: boolean;
  registrationCount: number;
  publicUrl: string;
}
export interface PublicEventRegistrationResponse {
  message: string;
  eventName: string;
}
export type LocationAnalysisResponseCode =
  | "YES_COMPLETELY"
  | "YES_PARTIALLY"
  | "NO"
  | "DONT_KNOW";
export interface LocationAnalysisAnswer {
  questionCode: string;
  response: LocationAnalysisResponseCode;
  remark?: string | null;
}
export interface LocationAnalysisQuestion {
  code: string;
  group: string;
  prompt: string;
  hint?: string | null;
}
export interface LocationAnalysisResponse {
  leadId: string;
  candidateName: string;
  preferredLocation: string;
  leaseOwnershipStatus: string;
  status: "Pending" | "Passed" | "Failed" | string;
  notes?: string | null;
  reviewNotes?: string | null;
  updatedAt: string;
  answers: LocationAnalysisAnswer[];
  questionCount: number;
  answeredCount: number;
  submittedAt?: string | null;
  submittedByName?: string | null;
  evaluatedAt?: string | null;
  evaluatedByName?: string | null;
  revisionReason?: string | null;
  questions: LocationAnalysisQuestion[];
}
export interface Activity {
  id: string;
  type: string;
  message: string;
  fromState?: LeadState;
  toState?: LeadState;
  createdAt: string;
  actorName?: string;
}
export interface Task {
  id: string;
  leadId: string;
  assignedTo: string;
  title: string;
  status: "Open" | "Completed" | "Cancelled";
  createdAt: string;
  dueAt?: string | null;
}
export interface CompletedWorkItem {
  id: string;
  leadId: string;
  title: string;
  detail: string;
  kind: "Task" | "Workflow";
  completedAt: string;
}
export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface DocumentItem {
  id: string;
  leadId: string;
  documentType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
}
export interface Contract {
  leadId: string;
  contractId: string;
  status: string;
  templateCode: string;
  version: string;
  updatedAt: string;
  gmApproved?: boolean;
  franchiseeSignerName?: string;
  franchiseeSignedAt?: string;
  drCareSignerName?: string;
  drCareSignedAt?: string;
  revisionReason?: string;
  revisionRequestedAt?: string;
  revisionRequestedBy?: string;
  revisionRequestedByName?: string;
}
export interface SigningRequest {
  id: string;
  leadId: string;
  contractId: string;
  signerRole: string;
  signerName: string;
  signerEmail: string;
  status: string;
  expiresAt: string;
  signedAt?: string;
  emailQueued: boolean;
  signingUrl?: string;
}
export interface QueueItem {
  leadId: string;
  fullName: string;
  state: LeadState;
  updatedAt: string;
  version: number;
}
export interface FinancePaymentItem {
  paymentId: string;
  leadId: string;
  leadName: string;
  location?: string;
  leadState: LeadState;
  ownerId: string;
  ownerName: string;
  invoiceNumber?: string;
  amount: number;
  currency: string;
  status: "Awaiting" | "Confirmed" | string;
  activityAt: string;
  submittedAt?: string;
  confirmedAt?: string;
  submittedByName?: string;
  confirmedByName?: string;
  confirmationReference?: string;
  hasPaymentEvidence: boolean;
}
export interface FinancePaymentEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actorName: string;
}
export interface FinancePaymentDetail {
  payment: FinancePaymentItem;
  events: FinancePaymentEvent[];
  evidenceDocuments: DocumentItem[];
}
export interface FinanceWorkbenchResponse {
  items: FinancePaymentItem[];
  page: number;
  pageSize: number;
  total: number;
  awaitingCount: number;
  pendingAmount: number;
  confirmedThisMonth: number;
  exceptionCount: number;
}
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let currentUser: UserProfile | null = null;
let refreshPromise: Promise<LoginResponse | null> | null = null;

function normalizeUser(user: UserProfile): UserProfile {
  return { ...user, roles: user.roles?.length ? user.roles : [user.role] };
}

export const session = {
  get token() {
    return accessToken;
  },
  get user() {
    return currentUser;
  },
  set(response: LoginResponse) {
    accessToken = response.accessToken;
    currentUser = normalizeUser(response.user);
  },
  clear() {
    accessToken = null;
    currentUser = null;
  },
};

async function rawRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && retry && !path.includes("/auth/")) {
    const refreshed = await refresh();
    if (refreshed) return rawRequest<T>(path, init, false);
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      detail?: string;
      title?: string;
      errors?: Record<string, string[]>;
    } | null;
    const fieldErrors = problem?.errors ?? {};
    const validationMessage = Object.entries(fieldErrors)
      .flatMap(([field, messages]) =>
        messages.map((message) => `${friendlyFieldName(field)}: ${message}`),
      )
      .join(" ");
    throw new ApiError(
      validationMessage ||
        problem?.detail ||
        problem?.title ||
        `Request failed (${response.status})`,
      response.status,
      fieldErrors,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function friendlyFieldName(field: string) {
  const name = field.split(".").at(-1) ?? field;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

const json = <T>(value: T): RequestInit => ({
  method: "POST",
  body: JSON.stringify(value),
});
const patch = <T>(value: T): RequestInit => ({
  method: "PATCH",
  body: JSON.stringify(value),
});

async function refresh() {
  if (!refreshPromise)
    refreshPromise = rawRequest<LoginResponse>(
      "/api/v1/auth/refresh",
      { method: "POST" },
      false,
    )
      .then((result) => {
        session.set(result);
        return result;
      })
      .catch(() => {
        session.clear();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      rawRequest<LoginResponse>(
        "/api/v1/auth/login",
        json({ email, password }),
      ),
    refresh: () => refresh(),
    logout: () =>
      rawRequest<{ message: string }>("/api/v1/auth/logout", {
        method: "POST",
      }),
    forgotPassword: (email: string) =>
      rawRequest<{ message: string }>(
        "/api/v1/auth/forgot-password",
        json({ email }),
      ),
    resetPassword: (payload: {
      token: string;
      email: string;
      newPassword: string;
    }) =>
      rawRequest<{ message: string }>(
        "/api/v1/auth/reset-password",
        json(payload),
      ),
    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
      rawRequest<LoginResponse>(
        "/api/v1/auth/change-password",
        json(payload),
      ),
    me: () => rawRequest<UserProfile>("/api/v1/auth/me"),
    switchRole: (role: Role) =>
      rawRequest<LoginResponse>("/api/v1/auth/switch-role", json({ role })),
  },
  users: {
    list: (query = "") =>
      rawRequest<PagedResponse<UserRecord>>(`/api/v1/users${query}`),
    create: (payload: unknown) =>
      rawRequest<UserRecord>("/api/v1/users", json(payload)),
    get: (id: string) => rawRequest<UserRecord>(`/api/v1/users/${id}`),
    update: (id: string, payload: unknown) =>
      rawRequest<UserRecord>(`/api/v1/users/${id}`, patch(payload)),
    deactivate: (id: string) =>
      rawRequest<{ userId: string; isActive: boolean; changedAt: string }>(
        `/api/v1/users/${id}/deactivate`,
        json({}),
      ),
  },
  reference: {
    pipelineStates: () =>
      rawRequest<unknown[]>("/api/v1/reference/pipeline-states"),
    productLines: () =>
      rawRequest<unknown[]>("/api/v1/reference/product-lines"),
    documentTypes: () =>
      rawRequest<unknown[]>("/api/v1/reference/document-types"),
    taskTypes: () => rawRequest<unknown[]>("/api/v1/reference/task-types"),
    checklists: (productLine: string) =>
      rawRequest<unknown[]>(
        `/api/v1/reference/checklists/${encodeURIComponent(productLine)}`,
      ),
  },
  leads: {
    list: (query = "") => rawRequest<LeadPage>(`/api/v1/leads${query}`),
    listAll: async (query = "") => {
      const params = new URLSearchParams(query.replace(/^\?/, ""));
      params.delete("cursor");

      const requestedLimit = Number(params.get("limit"));
      const pageSize = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.max(1, Math.min(100, Math.floor(requestedLimit)))
        : 100;
      params.set("limit", String(pageSize));

      const items: Lead[] = [];
      let page = 1;
      let total = 0;
      do {
        params.set("page", String(page));
        const result = await rawRequest<LeadPage>(`/api/v1/leads?${params.toString()}`);
        items.push(...result.items);
        total = result.total;
        if (!result.items.length || items.length >= total) break;
        page += 1;
      } while (page <= Math.max(1, Math.ceil(total / pageSize)));

      return { items: items.slice(0, total), total, page: 1, pageSize } satisfies LeadPage;
    },
    get: (id: string) => rawRequest<Lead>(`/api/v1/leads/${id}`),
    create: (payload: unknown) =>
      rawRequest<Lead>("/api/v1/leads", json(payload)),
    updateDetails: (id: string, payload: unknown) =>
      rawRequest<Lead>(`/api/v1/leads/${id}`, patch(payload)),
    startInquiry: (id: string) =>
      rawRequest<Lead>(`/api/v1/leads/${id}/inquiry/start`, json({})),
    getInquiry: (id: string) => rawRequest<Lead>(`/api/v1/leads/${id}/inquiry`),
    updateInquiry: (id: string, payload: unknown) =>
      rawRequest<Lead>(`/api/v1/leads/${id}/inquiry`, patch(payload)),
    submitInquiry: (id: string) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/inquiry/submit`, json({})),
    getNurturing: (id: string) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/nurturing`),
    updateNurturing: (id: string, payload: unknown) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/nurturing`, patch(payload)),
    recordCallOutcome: (id: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/nurturing/call-outcome`,
        json(payload),
      ),
    qualify: (id: string, payload: unknown) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/qualification`, json(payload)),
    assign: (id: string, payload: unknown) =>
      rawRequest<Lead>(`/api/v1/leads/${id}/assign`, json(payload)),
    activities: (id: string, page = 1) =>
      rawRequest<PagedResponse<Activity>>(
        `/api/v1/leads/${id}/activities?page=${page}`,
      ),
    addActivity: (id: string, payload: unknown) =>
      rawRequest<Activity>(`/api/v1/leads/${id}/activities`, json(payload)),
    location: (id: string) =>
      rawRequest<LocationAnalysisResponse>(`/api/v1/leads/${id}/location-analysis`),
    updateLocation: (id: string, payload: unknown) =>
      rawRequest<LocationAnalysisResponse>(`/api/v1/leads/${id}/location-analysis`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    submitLocation: (id: string, payload: unknown = {}) =>
      rawRequest<LocationAnalysisResponse>(
        `/api/v1/leads/${id}/location-analysis/submit`,
        json(payload),
      ),
    evaluateLocation: (id: string, payload: unknown) =>
      rawRequest<{ leadId: string; decision: string; notes?: string; evaluatedAt: string; state: LeadState }>(
        `/api/v1/leads/${id}/location-analysis/evaluate`,
        json(payload),
      ),
    tasks: (id: string) => rawRequest<Task[]>(`/api/v1/leads/${id}/tasks`),
    createTask: (id: string, payload: unknown) =>
      rawRequest<Task>(`/api/v1/leads/${id}/tasks`, json(payload)),
    downPayment: (id: string) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/down-payment`),
    updateDownPayment: (id: string, payload: unknown) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/down-payment`, patch(payload)),
    generateInvoice: (id: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/down-payment/generate-invoice`,
        json(payload),
      ),
    submitDownPaymentForFinance: (id: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/down-payment/submit-finance`,
        json(payload),
      ),
    invoice: (id: string) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/down-payment/invoice`),
    invoiceDownload: (id: string) =>
      rawRequest<{
        documentId: string;
        downloadUrl: string;
        expiresAt: string;
      }>(`/api/v1/leads/${id}/down-payment/invoice/download-url`),
    confirmPayment: (id: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/down-payment/confirm`,
        json(payload),
      ),
    documents: (id: string) =>
      rawRequest<DocumentItem[]>(`/api/v1/leads/${id}/documents`),
    uploadIntent: (id: string, payload: unknown) =>
      rawRequest<{
        documentId: string;
        objectKey: string;
        uploadUrl: string;
        expiresAt: string;
        requiredContentType: string;
        maxSizeBytes: number;
      }>(`/api/v1/leads/${id}/documents/upload-intents`, json(payload)),
    completeUpload: (id: string, documentId: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/documents/${documentId}/complete`,
        json(payload),
      ),
    downloadUrl: (id: string, documentId: string) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/documents/${documentId}/download-url`,
      ),
    archiveDocument: (id: string, documentId: string) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/documents/${documentId}/archive`,
        json({}),
      ),
    contract: (id: string) =>
      rawRequest<Contract>(`/api/v1/leads/${id}/contract`),
    generateContract: (id: string, payload: unknown) =>
      rawRequest<Contract>(
        `/api/v1/leads/${id}/contract/generate`,
        json(payload),
      ),
    updateContract: (id: string, payload: unknown) =>
      rawRequest<Contract>(`/api/v1/leads/${id}/contract`, patch(payload)),
    submitContractReview: (id: string, payload: unknown) =>
      rawRequest<Contract>(
        `/api/v1/leads/${id}/contract/submit-review`,
        json(payload),
      ),
    contractChecklist: (id: string) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/contract/review-checklist`),
    updateContractChecklist: (id: string, payload: unknown) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/contract/review-checklist`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    approveContract: (id: string, payload: unknown) =>
      rawRequest<Contract>(
        `/api/v1/leads/${id}/contract/approve`,
        json(payload),
      ),
    requestRevision: (id: string, payload: unknown) =>
      rawRequest<Contract>(
        `/api/v1/leads/${id}/contract/request-revision`,
        json(payload),
      ),
    contractDownload: (id: string) =>
      rawRequest<{
        documentId: string;
        downloadUrl: string;
        expiresAt: string;
      }>(`/api/v1/leads/${id}/contract/download-url`),
    signingRequests: (id: string) =>
      rawRequest<SigningRequest[]>(
        `/api/v1/leads/${id}/contract/signing-requests`,
      ),
    createSigningRequest: (id: string, payload: unknown) =>
      rawRequest<SigningRequest>(
        `/api/v1/leads/${id}/contract/signing-requests`,
        json(payload),
      ),
    voidSigningRequest: (id: string, requestId: string) =>
      rawRequest<SigningRequest>(
        `/api/v1/leads/${id}/contract/signing-requests/${requestId}/void`,
        json({}),
      ),
    preLaunch: (id: string) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/pre-launch`),
    initializePreLaunch: (
      id: string,
      nurseOrDoctorAvailable = false,
      confirmSignedContractReview = false,
    ) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/pre-launch/initialize`,
        json({ nurseOrDoctorAvailable, confirmSignedContractReview }),
      ),
    updatePreLaunchItem: (id: string, itemId: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/pre-launch/items/${itemId}`,
        patch(payload),
      ),
    sendPreLaunchVideo: (id: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/pre-launch/send-video`,
        json(payload),
      ),
    completePreLaunch: (id: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/leads/${id}/pre-launch/complete`,
        json(payload),
      ),
    endorsement: (id: string) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/endorsement`),
    createEndorsement: (id: string, payload: unknown) =>
      rawRequest<unknown>(`/api/v1/leads/${id}/endorsement`, json(payload)),
  },
  tasks: {
    list: (leadId?: string) =>
      rawRequest<Task[]>(
        `/api/v1/tasks${leadId ? `?leadId=${encodeURIComponent(leadId)}` : ""}`,
      ),
    completed: (page = 1) =>
      rawRequest<PagedResponse<CompletedWorkItem>>(
        `/api/v1/tasks/completed?page=${page}`,
      ),
    get: (id: string) => rawRequest<Task>(`/api/v1/tasks/${id}`),
    create: (payload: unknown) =>
      rawRequest<Task>("/api/v1/tasks", json(payload)),
    update: (id: string, payload: unknown) =>
      rawRequest<Task>(`/api/v1/tasks/${id}`, patch(payload)),
    complete: (id: string, payload: unknown = {}) =>
      rawRequest<Task>(`/api/v1/tasks/${id}/complete`, json(payload)),
    snooze: (id: string, dueAt: string) =>
      rawRequest<Task>(`/api/v1/tasks/${id}/snooze`, json({ dueAt })),
  },
  endorsements: {
    list: () => rawRequest<unknown[]>("/api/v1/endorsements"),
    get: (id: string) => rawRequest<unknown>(`/api/v1/endorsements/${id}`),
    acknowledge: (id: string) =>
      rawRequest<unknown>(`/api/v1/endorsements/${id}/acknowledge`, json({})),
  },
  queues: {
    finance: () => rawRequest<QueueItem[]>("/api/v1/finance/payment-queue"),
    gm: () => rawRequest<QueueItem[]>("/api/v1/gm/contract-review-queue"),
    admin: () => rawRequest<QueueItem[]>("/api/v1/admin/endorsement-queue"),
  },
  finance: {
    workbench: (query = "") =>
      rawRequest<FinanceWorkbenchResponse>(`/api/v1/finance/workbench${query}`),
    payment: (id: string) =>
      rawRequest<FinancePaymentDetail>(`/api/v1/finance/payments/${id}`),
  },
  reports: {
    overview: (query = "") =>
      rawRequest<unknown>(`/api/v1/reports/overview${query}`),
    pipeline: (query = "") =>
      rawRequest<unknown>(`/api/v1/reports/pipeline${query}`),
    conversion: (query = "") =>
      rawRequest<unknown>(`/api/v1/reports/conversion${query}`),
    goals: (query = "") => rawRequest<unknown>(`/api/v1/reports/goals${query}`),
    leaderboard: (query = "") =>
      rawRequest<unknown>(`/api/v1/reports/agent-leaderboard${query}`),
    downPayments: (query = "") =>
      rawRequest<unknown>(`/api/v1/reports/down-payments${query}`),
  },
  notifications: {
    list: () => rawRequest<Notification[]>("/api/v1/notifications"),
    markRead: (id: string) =>
      rawRequest<Notification>(`/api/v1/notifications/${id}/read`, json({})),
  },
  audit: {
    list: (leadId?: string, page = 1) =>
      rawRequest<PagedResponse<{
        id: string;
        leadId?: string;
        actorId?: string;
        action: string;
        createdAt: string;
      }>>(
        `/api/v1/audit-logs?page=${page}${leadId ? `&leadId=${encodeURIComponent(leadId)}` : ""}`,
      ),
  },
  settings: {
    pricing: () => rawRequest<unknown>("/api/v1/settings/pricing"),
    updatePricing: (payload: unknown) =>
      rawRequest<unknown>("/api/v1/settings/pricing", patch(payload)),
    invoice: () => rawRequest<unknown>("/api/v1/settings/invoice"),
    updateInvoice: (payload: unknown) =>
      rawRequest<unknown>("/api/v1/settings/invoice", patch(payload)),
    annualGoal: () => rawRequest<unknown>("/api/v1/settings/annual-goal"),
    updateAnnualGoal: (payload: unknown) =>
      rawRequest<unknown>("/api/v1/settings/annual-goal", patch(payload)),
    templates: () =>
      rawRequest<unknown[]>("/api/v1/settings/contract-templates"),
    createTemplate: (payload: unknown) =>
      rawRequest<unknown>("/api/v1/settings/contract-templates", json(payload)),
    checklists: () =>
      rawRequest<unknown>("/api/v1/settings/pre-launch-checklists"),
    updateChecklists: (payload: unknown) =>
      rawRequest<unknown>(
        "/api/v1/settings/pre-launch-checklists",
        patch(payload),
      ),
  },
  publicSigning: {
    get: (token: string) =>
      rawRequest<{
        requestId: string;
        signerRole: string;
        signerName: string;
        contractStatus: string;
        expiresAt: string;
        alreadySigned: boolean;
        documentUrl?: string;
      }>(`/api/v1/public/contract-signing/${encodeURIComponent(token)}`),
    sign: (token: string, payload: unknown) =>
      rawRequest<unknown>(
        `/api/v1/public/contract-signing/${encodeURIComponent(token)}/sign`,
        json(payload),
      ),
    decline: (token: string, payload: unknown) =>
      rawRequest<void>(
        `/api/v1/public/contract-signing/${encodeURIComponent(token)}/decline`,
        json(payload),
      ),
  },
  publicEvents: {
    get: (token: string) =>
      rawRequest<PublicEventLanding>(`/api/v1/public/events/${encodeURIComponent(token)}`),
    register: (token: string, payload: unknown) =>
      rawRequest<PublicEventRegistrationResponse>(
        `/api/v1/public/events/${encodeURIComponent(token)}/registrations`,
        json(payload),
      ),
  },
  leadCaptureEvents: {
    list: () => rawRequest<LeadCaptureEventRecord[]>('/api/v1/lead-capture-events'),
    create: (payload: unknown) => rawRequest<LeadCaptureEventRecord>('/api/v1/lead-capture-events', json(payload)),
    update: (id: string, payload: unknown) => rawRequest<LeadCaptureEventRecord>(`/api/v1/lead-capture-events/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    activate: (id: string) => rawRequest<LeadCaptureEventRecord>(`/api/v1/lead-capture-events/${id}/activate`, json({})),
    deactivate: (id: string) => rawRequest<LeadCaptureEventRecord>(`/api/v1/lead-capture-events/${id}/deactivate`, json({})),
    regenerateLink: (id: string) => rawRequest<LeadCaptureEventRecord>(`/api/v1/lead-capture-events/${id}/regenerate-link`, json({})),
  },
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
