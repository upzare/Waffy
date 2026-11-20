import { jsonSchema, type ToolSet } from "ai";
import type { CallToolResult, MCPClient } from "@ai-sdk/mcp";
import type { ToolCall } from "@/types";
import { closeMcpClient, discoverMcpServer, mcpErrorMessage, MCP_CALL_TIMEOUT } from "./client";
import { listMcpServers, readMcpServer, withMcpServerLock, type McpServer } from "./storage";

interface McpToolTarget {
  server: McpServer;
  name: string;
  client: MCPClient;
}

interface McpTurnOptions {
  onUnavailable: (message: string) => void;
  onToolStart: (label: string) => void;
}

const MAX_CALLS_PER_SESSION = 10;

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
  const tools: ToolSet = {};
  const targets = new Map<string, McpToolTarget>();
  const clients: MCPClient[] = [];
  let callCount = 0;
  const close = () => Promise.all(clients.map(closeMcpClient));
  try {
    const servers = await listMcpServers();
    await Promise.all(
      servers
        .filter((server) => server.enabled)
        .map(async (server) => {
          let client: MCPClient | undefined;
          try {
            await withMcpServerLock(
              server.id,
              async () => {
                const current = await readMcpServer(server.id);
                if (!current?.enabled || current.revision !== server.revision) return;
                const { client: connected, definitions } = await discoverMcpServer(server, {
                  signal,
                });
                client = connected;
                const entries = await Promise.all(
                  definitions.map(async (definition) => {
                    const alias = await toolAlias(server, definition.name);
                    return { alias, definition };
                  })
                );
                for (const { alias, definition } of entries) {
                  if (targets.has(alias)) continue;
                  tools[alias] = {
                    description: `${server.name}: ${definition.name}. ${definition.description ?? ""}`,
                    inputSchema: jsonSchema(
                      definition.inputSchema as Parameters<typeof jsonSchema>[0]
                    ),
                  };
                  targets.set(alias, { server, name: definition.name, client: connected });
                }
                clients.push(connected);
              },
              AbortSignal.any([signal, AbortSignal.timeout(8_000)])
            );
          } catch (error) {
            if (client) await closeMcpClient(client);
            if (!signal.aborted) onUnavailable(`${server.name}: ${mcpErrorMessage(error)}`);
          }
        })
    );
    signal.throwIfAborted();
    return {
      get tools() {
        return callCount < MAX_CALLS_PER_SESSION ? tools : undefined;
      },
      hasTool: (name: string) => targets.has(name),
      async call(toolCall: ToolCall): Promise<string | undefined> {
        const target = targets.get(toolCall.name);
        if (!target) return undefined;
        signal.throwIfAborted();
        if (callCount >= MAX_CALLS_PER_SESSION)
          return "The MCP call limit was reached for this stage.";
        callCount += 1;

        const args: unknown = JSON.parse(toolCall.arguments);
        if (args === null || typeof args !== "object" || Array.isArray(args)) {
          return "MCP tool arguments must be a JSON object.";
        }

        return executeMcpTool(target, args as Record<string, unknown>, signal, onToolStart);
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
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
        onToolStart(`Using ${target.server.name} tools...`);
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
