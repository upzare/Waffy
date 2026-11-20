import type {
  OAuthAuthorizationServerInformation,
  OAuthClientInformation,
  OAuthTokens,
} from "@ai-sdk/mcp";
import { restrictLocalStorageAccess } from "@/lib/helper";

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

export async function listMcpServers(): Promise<McpServer[]> {
  const storage = chrome.storage.local;
  const keys = storage.getKeys ? (await storage.getKeys()).filter(isMcpServerKey) : null;
  const records = await storage.get<Record<string, McpServer>>(keys);
  return Object.keys(records)
    .filter(isMcpServerKey)
    .map((key) => records[key])
    .sort((a, b) => a.name.localeCompare(b.name));
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

export async function readMcpServerForEdit(id: string) {
  // Save writes the server and credentials together. Read both from the same snapshot.
  const serverStorageKey = serverKey(id);
  const credentialStorageKey = credentialKey(id);
  const snapshot = await chrome.storage.local.get([serverStorageKey, credentialStorageKey]);
  const server = snapshot[serverStorageKey] as McpServer | undefined;
  if (!server) throw new Error("This server has been removed.");

  const credentials = snapshot[credentialStorageKey] as McpCredentials | undefined;
  return { server, bearer: server.auth === "bearer" ? credentials?.bearer : undefined };
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

export async function saveMcpServer(input: McpServerInput, original?: McpServer) {
  const name = input.name.trim();
  if (!name) throw new Error("Enter a name for the server.");
  const url = validatedUrl(input.url.trim(), input.auth !== "oauth").href;
  const clientId = input.auth === "oauth" ? input.clientId?.trim() || undefined : undefined;
  const issuer = clientId ? input.issuer?.trim() : undefined;
  if (clientId && !issuer) throw new Error("Enter the issuer for the registered OAuth client.");
  if (issuer && validatedUrl(issuer).search)
    throw new Error("The OAuth issuer URL cannot contain a query.");
  // A root issuer can be advertised with or without its trailing slash. Keep the entered form.
  const id = original?.id ?? crypto.randomUUID();

  return withMcpServerLock(id, async () => {
    const current = await readMcpServer(id);
    if (
      original &&
      (!current || current.revision !== original.revision || current.name !== original.name)
    ) {
      throw new Error("This server changed in another window. Reopen it and try again.");
    }
    const sameConnection =
      current &&
      current.url === url &&
      current.auth === input.auth &&
      current.clientId === clientId &&
      current.issuer === issuer;
    const existing = sameConnection ? await readMcpCredentials(id) : {};
    const bearer = input.auth === "bearer" ? (input.bearer?.trim() ?? existing.bearer) : undefined;
    if (input.auth === "bearer" && (!bearer || /[\s\x00-\x1f\x7f]/.test(bearer))) {
      throw new Error("Enter a valid bearer token without spaces.");
    }

    const changed = !sameConnection || bearer !== existing.bearer;
    const server: McpServer = {
      id,
      revision: changed ? crypto.randomUUID() : current.revision,
      name,
      url,
      auth: input.auth,
      ...(clientId && { clientId, issuer }),
      enabled: current?.enabled ?? true,
    };
    await restrictLocalStorageAccess();
    await chrome.storage.local.set({
      [serverKey(id)]: server,
      ...(changed && { [credentialKey(id)]: bearer ? { bearer } : {} }),
    });
    return server;
  });
}

export async function markMcpIdentityChanged(server: McpServer) {
  // Called under the server lock when interactive OAuth changes the credentials.
  await chrome.storage.local.set({
    [serverKey(server.id)]: { ...server, revision: crypto.randomUUID() },
  });
}

export async function setMcpServerEnabled(server: McpServer, enabled: boolean) {
  await withMcpServerLock(server.id, async () => {
    const current = await readMcpServer(server.id);
    if (current?.revision !== server.revision) throw new Error("This server has changed.");
    await chrome.storage.local.set({ [serverKey(server.id)]: { ...current, enabled } });
  });
}

export async function removeMcpServer(server: McpServer) {
  await withMcpServerLock(server.id, async () => {
    if ((await readMcpServer(server.id))?.revision !== server.revision) {
      throw new Error("This server has changed.");
    }
    await chrome.storage.local.remove([serverKey(server.id), credentialKey(server.id)]);
  });
}
