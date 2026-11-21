import {
  jsonSchema,
  tool,
  toolSearch,
  type InferToolOutput,
  type ToolSet,
  type TypedToolResult,
} from "ai";
import type { CallToolResult, MCPClient } from "@ai-sdk/mcp";
import { z } from "zod";
import { closeMcpClient, discoverMcpServer, mcpErrorMessage, MCP_CALL_TIMEOUT } from "./client";
import { listMcpServers, readMcpServer, withMcpServerLock, type McpServer } from "./storage";
import { isBrowserOffline } from "@/lib/helper";

interface McpToolTarget {
  server: McpServer;
  name: string;
  client: MCPClient;
}

interface McpTurnOptions {
  onUnavailable?: (message: string) => void;
  onToolStart?: (label: string) => void;
}

export const getMcpProviders = tool({
  description:
    "List the names and endpoint URLs of enabled MCP servers in Waffy settings. Use this when asked which MCP servers or tools are available, or to find the provider for a service-specific task.",
  inputSchema: z.object({}),
  execute: async () => {
    const servers = await listMcpServers();
    return {
      providers: servers
        .filter((server) => server.enabled)
        // Match the endpoint displayed in Settings. Query parameters can contain credentials.
        .map(({ name, url }) => ({ name, url: url.split("?")[0] })),
    };
  },
});
const searchMcpTools = toolSearch();

function searchableName(name: string) {
  return /[a-z\d][A-Z]/.test(name) ? `${name} (${name.toLowerCase()})` : name;
}

async function toolAlias(server: McpServer, name: string) {
  const key = new TextEncoder().encode(JSON.stringify([server.id, name]));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", key));
  const suffix = Array.from(hash.slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
  return `mcp_${name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}_${suffix}`;
}

export async function openMcpTurn(
  signal: AbortSignal,
  { onUnavailable, onToolStart }: McpTurnOptions
) {
  signal.throwIfAborted();
  if (isBrowserOffline()) return;

  const catalog: ToolSet = {};
  const targets = new Map<string, McpToolTarget>();
  const clients: MCPClient[] = [];
  const close = () => Promise.all(clients.map(closeMcpClient));

  async function discoverTools(server: McpServer) {
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(8_000)]);
    let client: MCPClient | undefined;
    try {
      await withMcpServerLock(
        server.id,
        async () => {
          const current = await readMcpServer(server.id);
          if (!current?.enabled || current.revision !== server.revision) return;
          const { client: connected, definitions } = await discoverMcpServer(current, {
            signal: deadline,
          });
          client = connected;
          const serverLabel = searchableName(current.name);
          const entries = await Promise.all(
            definitions.map(async (definition) => ({
              alias: await toolAlias(current, definition.name),
              definition,
            }))
          );
          deadline.throwIfAborted();
          for (const { alias, definition } of entries) {
            if (targets.has(alias)) continue;
            catalog[alias] = {
              deferLoading: true,
              description: `${serverLabel}: ${searchableName(definition.name)}. ${definition.description ?? ""}`,
              inputSchema: jsonSchema(definition.inputSchema as Parameters<typeof jsonSchema>[0]),
            };
            targets.set(alias, { server: current, name: definition.name, client: connected });
          }
          clients.push(connected);
        },
        deadline
      );
    } catch (error) {
      if (client) await closeMcpClient(client);
      if (!signal.aborted) onUnavailable?.(`${server.name}: ${mcpErrorMessage(error)}`);
    }
  }

  try {
    const servers = await listMcpServers();
    await Promise.all(servers.filter((server) => server.enabled).map(discoverTools));
    signal.throwIfAborted();
  } catch (error) {
    await close();
    throw error;
  }

  return {
    tools: targets.size ? { search_mcp_tools: searchMcpTools, ...catalog } : undefined,
    rememberDiscoveredTools(results: TypedToolResult<ToolSet>[]) {
      // The SDK remembers discoveries for one streamText call. Browser and MCP tool calls can start another.
      for (const result of results) {
        if (result.toolName !== "search_mcp_tools" || result.providerExecuted) continue;
        const output = result.output as InferToolOutput<typeof searchMcpTools>;
        for (const { name } of output.tools) {
          if (Object.hasOwn(catalog, name)) catalog[name].deferLoading = false;
        }
      }
    },
    async call(name: string, args: unknown): Promise<string | undefined> {
      signal.throwIfAborted();
      const target = targets.get(name);
      if (!target) return undefined;
      if (args === null || typeof args !== "object" || Array.isArray(args)) {
        return "MCP tool arguments must be a JSON object.";
      }
      return executeMcpTool(target, args as Record<string, unknown>, signal, onToolStart);
    },
    close,
  };
}

function formatResult(result: CallToolResult) {
  const content: unknown[] = Array.isArray(result.content) ? result.content : [];
  const text = content.flatMap((entry) =>
    entry &&
      typeof entry === "object" &&
      "type" in entry &&
      entry.type === "text" &&
      "text" in entry &&
      typeof entry.text === "string"
      ? [entry.text]
      : []
  );
  if (!text.length && result.structuredContent) text.push(JSON.stringify(result.structuredContent));
  const resultText = text.join("\n") || "The tool returned no text.";
  const maxLength = 32_000;
  const bounded =
    resultText.length > maxLength
      ? resultText.slice(0, maxLength) + "\n[Result truncated]"
      : resultText;
  return result.isError ? `MCP tool error: ${bounded}` : bounded;
}

async function executeMcpTool(
  target: McpToolTarget,
  args: Record<string, unknown>,
  signal: AbortSignal,
  onToolStart: McpTurnOptions["onToolStart"]
) {
  try {
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(MCP_CALL_TIMEOUT)]);
    return await withMcpServerLock(
      target.server.id,
      async () => {
        const current = await readMcpServer(target.server.id);
        if (!current?.enabled || current.revision !== target.server.revision) {
          return "The MCP server was disabled or changed before this call.";
        }
        deadline.throwIfAborted();
        onToolStart?.(`Using ${target.server.name} tools...`);
        const result = await target.client.callTool({
          name: target.name,
          arguments: args,
          options: { signal: deadline },
        });
        return formatResult(result);
      },
      deadline
    );
  } catch (error) {
    signal.throwIfAborted();
    return mcpErrorMessage(error);
  }
}
