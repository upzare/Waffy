import type {
  OAuthAuthorizationServerInformation,
  OAuthClientInformation,
  OAuthTokens,
} from "@ai-sdk/mcp";
import { restrictLocalStorageAccess } from "@/lib/helper";
import { equalJson } from "@/lib/utils";

export type McpAuth = "none" | "bearer" | "oauth";

export interface McpServer {
  id: string;
  revision: string;
  name: string;
  url: string;
  auth: McpAuth;
  clientId?: string;
  issuer?: string;
  enabled: boolean;
}

export interface McpCredentials {
  bearer?: string;
  tokens?: OAuthTokens;
  client?: OAuthClientInformation;
  authorizationServer?: OAuthAuthorizationServerInformation;
}

export type McpServerInput = Pick<McpServer, "name" | "url" | "auth" | "clientId" | "issuer"> & {
  bearer?: string;
};

export interface McpServerConfig {
  server: McpServer;
  bearer?: string;
}

export interface McpServerDraft extends McpServerConfig {
  oauth?: { saved?: McpCredentials; value: McpCredentials };
}

export interface McpServerChange {
  original?: McpServerConfig;
  draft?: McpServerDraft;
}

const SERVER_PREFIX = "mcp.server.";
export const isMcpServerKey = (key: string) => key.startsWith(SERVER_PREFIX);
const serverKey = (id: string) => SERVER_PREFIX + id;
const credentialKey = (id: string) => "mcp.credentials." + id;

export function withMcpServerLock<T>(
  id: string,
  operation: () => Promise<T>,
  signal?: AbortSignal
) {
  return navigator.locks.request(serverKey(id), { signal }, operation);
}

function serversFromRecords(records: Record<string, unknown>): McpServer[] {
  return Object.keys(records)
    .filter(isMcpServerKey)
    .flatMap((key) => {
      const server = records[key] as McpServer | undefined;
      return typeof server?.id === "string" &&
        typeof server.name === "string" &&
        typeof server.url === "string"
        ? [server]
        : [];
    });
}

export async function listMcpServers(): Promise<McpServer[]> {
  const storage = chrome.storage.local;
  const keys = storage.getKeys ? (await storage.getKeys()).filter(isMcpServerKey) : null;
  return serversFromRecords(await storage.get(keys)).sort((a, b) => a.name.localeCompare(b.name));
}

export function parseMcpServerConfigs(records: Record<string, unknown>) {
  return new Map<string, McpServerConfig>(
    serversFromRecords(records).map((server) => {
      const credentials = records[credentialKey(server.id)] as McpCredentials | undefined;
      return [
        server.id,
        { server, bearer: server.auth === "bearer" ? credentials?.bearer : undefined },
      ];
    })
  );
}

export async function readMcpServer(id: string): Promise<McpServer | undefined> {
  return (await chrome.storage.local.get<Record<string, McpServer>>(serverKey(id)))[serverKey(id)];
}

export async function readMcpCredentials(id: string): Promise<McpCredentials> {
  return (
    (await chrome.storage.local.get<Record<string, McpCredentials>>(credentialKey(id)))[
      credentialKey(id)
    ] ?? {}
  );
}

export async function writeMcpCredentials(id: string, credentials: McpCredentials) {
  await restrictLocalStorageAccess();
  await chrome.storage.local.set({ [credentialKey(id)]: credentials });
}

function validatedUrl(value: string, allowLoopback = false): URL {
  if (!URL.canParse(value)) throw new Error("Enter a valid URL.");
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(allowLoopback && loopback && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error(
      "Enter a valid HTTPS URL. HTTP is supported for local connections without OAuth."
    );
  }
  return url;
}

export function sameMcpConnection(a: McpServer, b: McpServer) {
  return a.url === b.url && a.auth === b.auth && a.clientId === b.clientId && a.issuer === b.issuer;
}

export function mergeMcpServerMetadata(original: McpServer, draft: McpServer, latest: McpServer) {
  return {
    ...draft,
    name: draft.name === original.name ? latest.name : draft.name,
    enabled: draft.enabled === original.enabled ? latest.enabled : draft.enabled,
  };
}

export function prepareMcpServer(input: McpServerInput, previous?: McpServerDraft): McpServerDraft {
  const name = input.name.trim();
  if (!name) throw new Error("Enter a name for the server.");
  const url = validatedUrl(input.url.trim(), input.auth !== "oauth").href;
  const clientId = input.auth === "oauth" ? input.clientId?.trim() || undefined : undefined;
  const issuer = clientId ? input.issuer?.trim() : undefined;
  if (clientId && !issuer) throw new Error("Enter the issuer for the registered OAuth client.");
  if (issuer && validatedUrl(issuer).search)
    throw new Error("The OAuth issuer URL cannot contain a query.");
  // A root issuer can be advertised with or without its trailing slash. Keep the entered form.
  const server: McpServer = {
    id: previous?.server.id ?? crypto.randomUUID(),
    revision: previous?.server.revision ?? crypto.randomUUID(),
    name,
    url,
    auth: input.auth,
    ...(clientId && { clientId, issuer }),
    enabled: previous?.server.enabled ?? true,
  };
  const sameConnection = previous && sameMcpConnection(previous.server, server);
  const bearer =
    input.auth === "bearer"
      ? (input.bearer?.trim() ?? (sameConnection ? previous.bearer : undefined))
      : undefined;
  if (input.auth === "bearer" && (!bearer || /[\s\x00-\x1f\x7f]/.test(bearer))) {
    throw new Error("Enter a valid bearer token without spaces.");
  }
  if (previous && (!sameConnection || bearer !== previous.bearer)) {
    server.revision = crypto.randomUUID();
  }
  return { server, bearer, oauth: sameConnection ? previous.oauth : undefined };
}

export async function applyMcpServerChange(
  id: string,
  { original, draft }: McpServerChange
): Promise<McpServerConfig | undefined> {
  return withMcpServerLock(id, async () => {
    const configKey = serverKey(id);
    const authKey = credentialKey(id);
    const records = await chrome.storage.local.get([configKey, authKey]);
    const current = records[configKey] as McpServer | undefined;
    const conflict = () =>
      new Error(
        `“${original?.server.name ?? draft?.server.name}” changed in another window. Cancel the pending changes and try again.`
      );

    if (!draft && !current) return undefined;
    if (current?.revision !== original?.server.revision) throw conflict();
    if (!draft) {
      await chrome.storage.local.remove([configKey, authKey]);
      return undefined;
    }

    const existing = (records[authKey] as McpCredentials | undefined) ?? {};
    const connectionChanged =
      !current || !sameMcpConnection(current, draft.server) || draft.bearer !== existing.bearer;
    const { oauth } = draft;
    if (oauth && !connectionChanged && !equalJson(oauth.saved ?? {}, existing)) {
      throw conflict();
    }
    const nextServer = {
      ...draft.server,
      revision: connectionChanged || oauth ? draft.server.revision : current.revision,
    };
    if (
      current &&
      original &&
      nextServer.name !== original.server.name &&
      current.name !== original.server.name &&
      current.name !== nextServer.name
    ) {
      throw conflict();
    }
    const server =
      current && original
        ? mergeMcpServerMetadata(original.server, nextServer, current)
        : nextServer;
    const updates: Record<string, McpServer | McpCredentials> = { [configKey]: server };
    if (connectionChanged || oauth) {
      await restrictLocalStorageAccess();
      updates[authKey] = oauth?.value ?? (draft.bearer ? { bearer: draft.bearer } : {});
    }
    await chrome.storage.local.set(updates);
    return { server, bearer: draft.bearer };
  });
}
