import {
  auth,
  createMCPClient,
  MCPClientError,
  UnauthorizedError,
  type ListToolsResult,
  type MCPClient,
  type OAuthClientProvider,
} from "@ai-sdk/mcp";
import { equalJson } from "@/lib/utils";
import {
  readMcpCredentials,
  readMcpServer,
  sameMcpConnection,
  withMcpServerLock,
  writeMcpCredentials,
  type McpCredentials,
  type McpServer,
  type McpServerDraft,
} from "./storage";

const DISCOVERY_TIMEOUT = 8_000;
const AUTH_TIMEOUT = 20_000;
export const MCP_CALL_TIMEOUT = 30_000;
export const mcpRedirectUrl = () => chrome.identity.getRedirectURL("mcp");
const timeoutSignal = (timeout: number, signal?: AbortSignal) =>
  signal ? AbortSignal.any([AbortSignal.timeout(timeout), signal]) : AbortSignal.timeout(timeout);

class McpConnectionError extends Error {}

export function mcpErrorMessage(error: unknown) {
  if (error instanceof McpConnectionError) return error.message;
  if (error instanceof UnauthorizedError) return "Sign in again to use this server.";
  if (MCPClientError.isInstance(error)) {
    if (error.statusCode === 401) return "The server rejected the credentials.";
    if (error.statusCode === 403) return "The server denied access.";
    if (error.statusCode === 404) return "The MCP endpoint was not found.";
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "The MCP server took too long to respond.";
  }
  return "The MCP server could not complete the request.";
}

function createOAuthProvider(
  server: McpServer,
  credentials: McpCredentials,
  interactive: boolean,
  saveCredentials?: (value: McpCredentials) => Promise<void>
) {
  let expectedState = "";
  let verifier = "";
  let authorizationUrl: URL | undefined;

  const update = async (patch: Partial<McpCredentials>) => {
    credentials = { ...credentials, ...patch };
    await saveCredentials?.(credentials);
  };
  const provider: OAuthClientProvider = {
    redirectUrl: mcpRedirectUrl(),
    clientMetadata: {
      client_name: "Waffy",
      redirect_uris: [mcpRedirectUrl()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    state: () => crypto.randomUUID(),
    saveState: (state) => {
      expectedState = state;
    },
    storedState: () => expectedState,
    saveCodeVerifier: (value) => {
      verifier = value;
    },
    codeVerifier: () => verifier,
    tokens: () => (interactive ? undefined : credentials.tokens),
    saveTokens: async (tokens) => {
      await update({ tokens });
      interactive = false;
    },
    clientInformation: () =>
      server.clientId ? { client_id: server.clientId, issuer: server.issuer } : credentials.client,
    saveClientInformation: (client) => update({ client }),
    isClientInformationDynamicallyRegistered: () => !server.clientId && !!credentials.client,
    authorizationServerInformation: () => credentials.authorizationServer,
    saveAuthorizationServerInformation: (authorizationServer) => update({ authorizationServer }),
    validateAuthorizationServerURL: (_serverUrl, url) => {
      if (server.issuer && new URL(url).href !== new URL(server.issuer).href) {
        throw new McpConnectionError("The server advertised a different OAuth issuer.");
      }
    },
    invalidateCredentials: async (scope) => {
      if (scope === "all" || scope === "verifier") verifier = "";
      if (scope === "verifier") return;
      credentials = scope === "all" ? {} : { ...credentials };
      if (scope === "tokens") delete credentials.tokens;
      if (scope === "client") {
        delete credentials.client;
        delete credentials.authorizationServer;
      }
      await saveCredentials?.(credentials);
    },
    redirectToAuthorization: (url) => {
      authorizationUrl = url;
    },
  };
  return {
    provider,
    getAuthorizationUrl: () => authorizationUrl,
    getCredentials: () => credentials,
  };
}

type Fetcher = typeof globalThis.fetch;

async function completeSignIn(
  server: McpServer,
  provider: OAuthClientProvider,
  authorizationUrl: URL,
  fetchFn: Fetcher,
  resourceMetadataUrl?: URL
) {
  let result: string | undefined;
  try {
    result = await chrome.identity.launchWebAuthFlow({
      url: authorizationUrl.href,
      interactive: true,
    });
  } catch {
    throw new McpConnectionError("OAuth sign-in did not complete.");
  }
  if (!result) throw new McpConnectionError("OAuth sign-in did not complete.");

  const redirect = new URL(result);
  const expected = new URL(provider.redirectUrl);
  const code = redirect.searchParams.get("code");
  const state = redirect.searchParams.get("state");
  if (
    redirect.origin !== expected.origin ||
    redirect.pathname !== expected.pathname ||
    !code ||
    !state ||
    state !== (await provider.storedState?.())
  ) {
    throw new McpConnectionError("OAuth returned an invalid callback.");
  }
  await auth(provider, {
    serverUrl: server.url,
    authorizationCode: code,
    callbackState: state,
    callbackIssuer: redirect.searchParams.get("iss") ?? undefined,
    resourceMetadataUrl,
    fetchFn,
  });
}

// Callers hold the server lock while initializing and during tool calls. This keeps
// token refreshes and config edits from racing across extension windows.
export async function discoverMcpServer(
  server: McpServer,
  {
    signal,
    draft,
  }: {
    signal?: AbortSignal;
    draft?: { credentials: McpCredentials; interactive: boolean };
  } = {}
) {
  const interactive = draft?.interactive ?? false;
  const credentials = draft?.credentials ?? (await readMcpCredentials(server.id));
  if (server.auth === "oauth" && !interactive && !credentials.tokens) {
    throw new McpConnectionError("Sign in to use this server.");
  }
  const oauth =
    server.auth === "oauth"
      ? createOAuthProvider(
          server,
          credentials,
          interactive,
          draft ? undefined : (value) => writeMcpCredentials(server.id, value)
        )
      : undefined;
  let setupSignal: AbortSignal | undefined;
  let resourceMetadataUrl: URL | undefined;
  const fetchFn: Fetcher = async (input, init) => {
    const signals = [init?.signal, setupSignal].filter((value): value is AbortSignal => !!value);
    const requestSignal = signals.length ? AbortSignal.any(signals) : AbortSignal.timeout(2_000);
    const response = await fetch(input, {
      ...init,
      signal: requestSignal,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });

    if (response.status === 401 && oauth && response.url === server.url) {
      // The SDK can replay an HTTP request after OAuth recovery. Limit recovery
      // to connection and discovery, since tool calls can have side effects.
      if (typeof init?.body === "string" && JSON.parse(init.body).method === "tools/call") {
        throw new McpConnectionError("The server requires sign-in. Reconnect it in Settings.");
      }
      const header = response.headers.get("www-authenticate");
      const metadata = header?.match(/(?:^|[,\s])resource_metadata="([^"]*)"/i)?.[1];
      if (
        metadata &&
        URL.canParse(metadata) &&
        new URL(metadata).origin === new URL(server.url).origin
      ) {
        resourceMetadataUrl = new URL(metadata);
      }
    }
    return response;
  };

  const open = async () => {
    setupSignal = timeoutSignal(interactive ? AUTH_TIMEOUT : DISCOVERY_TIMEOUT, signal);
    let client: MCPClient | undefined;
    try {
      client = await createMCPClient({
        clientName: "Waffy",
        transport: {
          type: "http",
          url: server.url,
          headers: credentials.bearer
            ? { Authorization: `Bearer ${credentials.bearer}` }
            : undefined,
          authProvider: oauth?.provider,
          redirect: "error",
          fetch: fetchFn,
        },
        maxRetries: 0,
        initializationOptions: { signal: setupSignal },
      });
      const definitions = await listMcpTools(client, setupSignal);
      return { client, definitions };
    } catch (error) {
      setupSignal = undefined;
      if (client) await closeMcpClient(client);
      throw error;
    } finally {
      setupSignal = undefined;
    }
  };

  let connection;
  let signedIn = false;
  try {
    connection = await open();
  } catch (error) {
    const url = oauth?.getAuthorizationUrl();
    if (!oauth || !url) throw error;
    if (!interactive) throw new McpConnectionError("Sign in again to use this server.");
    // The user can take longer than a network timeout to finish signing in.
    const exchangeFetch: Fetcher = (input, init) =>
      fetchFn(input, {
        ...init,
        signal: timeoutSignal(AUTH_TIMEOUT, init?.signal ?? signal),
      });
    await completeSignIn(server, oauth.provider, url, exchangeFetch, resourceMetadataUrl);
    connection = await open();
    signedIn = true;
  }
  return { ...connection, signedIn, credentials: oauth?.getCredentials() ?? credentials };
}

async function listMcpTools(client: MCPClient, signal: AbortSignal) {
  const tools: ListToolsResult["tools"] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    if (cursor) seen.add(cursor);
    const page = await client.listTools({ params: { cursor }, options: { signal } });
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor && !seen.has(cursor));
  return tools;
}

export async function testMcpServer(
  { server, bearer, oauth }: McpServerDraft,
  interactive = false
) {
  return withMcpServerLock(server.id, async () => {
    const current = server.auth === "oauth" ? await readMcpServer(server.id) : undefined;
    const saved =
      current && sameMcpConnection(current, server)
        ? await readMcpCredentials(server.id)
        : undefined;
    const initial = oauth?.value ?? saved ?? (bearer ? { bearer } : {});
    const { client, definitions, credentials, signedIn } = await discoverMcpServer(server, {
      draft: { credentials: initial, interactive },
    });
    try {
      const changed = signedIn || !equalJson(credentials, initial);
      return {
        revision: signedIn ? crypto.randomUUID() : server.revision,
        tools: definitions.map((tool) => tool.name),
        oauth: changed ? { saved: oauth ? oauth.saved : saved, value: credentials } : undefined,
      };
    } finally {
      await closeMcpClient(client);
    }
  });
}

export async function closeMcpClient(client: MCPClient) {
  // A remote session may already be closed or the server may be unreachable.
  await client.close().catch(() => {});
}
