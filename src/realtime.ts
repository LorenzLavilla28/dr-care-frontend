import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import { session } from "./api";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8080";

export interface RealtimeEvent {
  eventId: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  leadId?: string | null;
  organizationId: string;
  occurredAt: string;
  requestPath: string;
}

let connection: HubConnection | null = null;
let startPromise: Promise<void> | null = null;
const subscribers = new Set<(event: RealtimeEvent) => void>();
const seenEventIds = new Map<string, number>();
const joinedLeadIds = new Set<string>();

function publish(event: RealtimeEvent) {
  // A lead detail subscriber can receive the same write through both the
  // organization and lead groups. Refresh once per event instead of issuing
  // duplicate API requests.
  if (event.eventId) {
    const now = Date.now();
    for (const [id, expiresAt] of seenEventIds) {
      if (expiresAt <= now) seenEventIds.delete(id);
    }
    if (seenEventIds.has(event.eventId)) return;
    seenEventIds.set(event.eventId, now + 30_000);
  }
  subscribers.forEach((subscriber) => subscriber(event));
}

export async function startRealtime() {
  if (!session.token) return;
  if (connection?.state === HubConnectionState.Connected) return;
  if (startPromise) return startPromise;

  connection = new HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/operations`, {
      accessTokenFactory: () => session.token ?? "",
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error)
    .build();

  connection.on("dataChanged", (event: RealtimeEvent) => {
    publish(event);
  });
  connection.onreconnected(() => {
    for (const leadId of joinedLeadIds)
      void connection?.invoke("JoinLead", leadId).catch(() => undefined);
    publish({
      eventId: `reconnected-${Date.now()}`,
      eventType: "RealtimeReconnected",
      entityType: "Connection",
      entityId: null,
      leadId: null,
      organizationId: session.user?.organizationId ?? "",
      occurredAt: new Date().toISOString(),
      requestPath: "",
    });
  });
  connection.onclose(() => {
    connection = null;
  });

  startPromise = connection
    .start()
    .catch((error) => {
      connection = null;
      throw error;
    })
    .finally(() => {
      startPromise = null;
    });
  return startPromise;
}

export async function stopRealtime() {
  const current = connection;
  connection = null;
  startPromise = null;
  if (current && current.state !== HubConnectionState.Disconnected)
    await current.stop();
}

export function subscribeRealtime(subscriber: (event: RealtimeEvent) => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export async function joinRealtimeLead(leadId: string) {
  if (connection?.state === HubConnectionState.Connected) {
    await connection.invoke("JoinLead", leadId);
    joinedLeadIds.add(leadId);
  }
}

export async function leaveRealtimeLead(leadId: string) {
  joinedLeadIds.delete(leadId);
  if (connection?.state === HubConnectionState.Connected)
    await connection.invoke("LeaveLead", leadId);
}
