import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/errors";
import { mcpErrorMessage, mcpRedirectUrl, testMcpServer } from "@/lib/mcp/client";
import {
  isMcpServerKey,
  listMcpServers,
  readMcpServerForEdit,
  removeMcpServer,
  saveMcpServer,
  setMcpServerEnabled,
  type McpAuth,
  type McpServer,
  type McpServerInput,
} from "@/lib/mcp/storage";
import {
  alertError,
  dangerButton,
  fieldLabel,
  monoInput,
  panelSubtitle,
  primaryButton,
  revealButton,
  secondaryButton,
  selectInput,
  textInput,
  thinScroll,
} from "../styles";

type ServerDialog =
  | { view: "form"; server?: McpServer; bearer?: string }
  | { view: "manage" | "remove"; serverId: string };

type TestReport = Awaited<ReturnType<typeof testMcpServer>>;

const authLabels: Record<McpAuth, string> = {
  none: "None",
  bearer: "Bearer token",
  oauth: "OAuth",
};

const disabledStyle = "disabled:cursor-not-allowed disabled:opacity-50";
const primaryAction = `${primaryButton} ${disabledStyle}`;
const secondaryAction = `${secondaryButton} ${disabledStyle}`;
const dangerAction = `${dangerButton} ${disabledStyle}`;
const formField = `block space-y-2 ${fieldLabel}`;
const visibleEndpoint = (server: McpServer) => server.url.split("?")[0];
const toolCount = (count: number) => `${count} ${count === 1 ? "tool" : "tools"}`;
const normalizeEndpoint = (url: string) => (URL.canParse(url) ? new URL(url).href : undefined);

function ServerForm({
  server,
  savedBearer,
  busy,
  onSave,
  onCancel,
}: {
  server?: McpServer;
  savedBearer?: string;
  busy: boolean;
  onSave: (input: McpServerInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<McpServerInput>(server ?? { name: "", url: "", auth: "none" });
  const [bearerVisible, setBearerVisible] = useState(false);
  const endpoint = normalizeEndpoint(draft.url.trim());
  const bearer = draft.bearer ?? (endpoint === server?.url ? savedBearer : undefined) ?? "";

  const updateDraft = (changes: Partial<McpServerInput>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const updateEndpoint = (url: string) => {
    if (server && normalizeEndpoint(url.trim()) !== endpoint) {
      setBearerVisible(false);
      updateDraft({ url, bearer: undefined });
    } else {
      updateDraft({ url });
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <label className={formField}>
          <span>Server name</span>
          <input
            className={textInput}
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            required
          />
        </label>
        <label className={formField}>
          <span>Streamable HTTP endpoint</span>
          <input
            type="url"
            className={monoInput}
            placeholder="https://example.com/mcp"
            value={draft.url}
            onChange={(e) => updateEndpoint(e.target.value)}
            required
          />
        </label>
        <label className={formField}>
          <span>Authentication</span>
          <select
            className={selectInput}
            value={draft.auth}
            onChange={(e) => {
              setBearerVisible(false);
              updateDraft({ auth: e.target.value as McpAuth, bearer: undefined });
            }}
          >
            {Object.entries(authLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {draft.auth === "bearer" && (
          <div className={formField}>
            <label htmlFor="mcp-bearer-token" className="block">
              Bearer token
            </label>
            <div className="relative flex items-center">
              <input
                id="mcp-bearer-token"
                type={bearerVisible ? "text" : "password"}
                className={`${monoInput} pr-10`}
                autoComplete="off"
                spellCheck={false}
                value={bearer}
                onChange={(e) => updateDraft({ bearer: e.target.value })}
                required
              />
              <button
                type="button"
                className={`${revealButton} ${disabledStyle}`}
                disabled={!bearer}
                aria-label={bearerVisible ? "Hide bearer token" : "Show bearer token"}
                onClick={() => setBearerVisible((visible) => !visible)}
              >
                {bearerVisible ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
              </button>
            </div>
          </div>
        )}
        {draft.auth === "oauth" && (
          <>
            <label className={formField}>
              <span>Public OAuth client ID (optional)</span>
              <input
                className={monoInput}
                value={draft.clientId ?? ""}
                onChange={(e) => updateDraft({ clientId: e.target.value })}
              />
              <span className={panelSubtitle}>
                Leave blank if the server supports dynamic client registration.
              </span>
            </label>
            {!!draft.clientId?.trim() && (
              <label className={formField}>
                <span>Expected OAuth issuer</span>
                <input
                  type="url"
                  className={monoInput}
                  value={draft.issuer ?? ""}
                  onChange={(e) => updateDraft({ issuer: e.target.value })}
                  required
                />
              </label>
            )}
            <label className={formField}>
              <span>OAuth callback URL</span>
              <input
                readOnly
                className={monoInput}
                value={mcpRedirectUrl()}
                onFocus={(e) => e.target.select()}
              />
            </label>
          </>
        )}
      </fieldset>
      <DialogFooter>
        <button type="button" className={secondaryAction} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={primaryAction} disabled={busy}>
          {server ? "Save changes" : "Add server"}
        </button>
      </DialogFooter>
    </form>
  );
}

export default function McpServersSection() {
  const [servers, setServers] = useState<McpServer[] | null>(null);
  const [dialog, setDialog] = useState<ServerDialog | null>(null);
  const [tests, setTests] = useState<Partial<Record<string, TestReport>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const operationPending = useRef(false);
  const refreshQueue = useRef(Promise.resolve(true));
  const trigger = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  const refreshServers = useCallback(() => {
    const refresh = refreshQueue.current.then(async () => {
      try {
        setServers(await listMcpServers());
        setLoadError("");
        return true;
      } catch {
        setLoadError("Could not load MCP servers.");
        return false;
      }
    });
    refreshQueue.current = refresh;
    return refresh;
  }, []);

  useEffect(() => {
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (Object.keys(changes).some(isMcpServerKey)) void refreshServers();
    };
    chrome.storage.local.onChanged.addListener(onChange);
    void refreshServers();
    return () => {
      chrome.storage.local.onChanged.removeListener(onChange);
    };
  }, [refreshServers]);

  const show = (next: ServerDialog | null) => {
    setDialogError("");
    setDialog(next);
  };

  const open = (event: MouseEvent<HTMLButtonElement>, next: ServerDialog) => {
    trigger.current = event.currentTarget;
    show(next);
  };

  const perform = async (
    pending: string,
    operation: () => Promise<void>,
    describeError: (error: unknown) => string = errorMessage
  ) => {
    if (operationPending.current) return;
    operationPending.current = true;
    setDialogError("");
    setBusy(pending);
    try {
      await operation();
    } catch (error) {
      setDialogError(describeError(error));
    } finally {
      operationPending.current = false;
      setBusy(null);
    }
  };

  const manage = (serverId: string) => show({ view: "manage", serverId });

  const edit = (serverId: string) =>
    perform("Loading server…", async () => {
      const saved = await readMcpServerForEdit(serverId);
      show({ view: "form", ...saved });
    });

  const save = (input: McpServerInput, original?: McpServer) =>
    perform("Saving server…", async () => {
      const saved = await saveMcpServer(input, original);
      if (await refreshServers()) manage(saved.id);
      else show(null);
    });

  const test = (server: McpServer, signIn = false) =>
    perform(
      signIn ? "Waiting for OAuth sign-in…" : "Testing connection…",
      async () => {
        setTests((previous) => ({ ...previous, [server.id]: undefined }));
        const results = await testMcpServer(server, signIn);
        if (results.revision !== server.revision) await refreshServers();
        setTests((previous) => ({ ...previous, [server.id]: results }));
      },
      mcpErrorMessage
    );

  const remove = (server: McpServer) =>
    perform("Removing server…", async () => {
      await removeMcpServer(server);
      await refreshServers();
      show(null);
    });

  const toggleEnabled = (server: McpServer, enabled: boolean) =>
    perform("Updating server…", async () => {
      await setMcpServerEnabled(server, enabled);
      await refreshServers();
    });

  const server =
    dialog?.view === "form" ? dialog.server : servers?.find(({ id }) => id === dialog?.serverId);
  const lastTest =
    server && tests[server.id]?.revision === server.revision ? tests[server.id] : null;

  const dialogTitle =
    dialog?.view === "form"
      ? server
        ? "Edit MCP server"
        : "Add MCP server"
      : !server
        ? "MCP server unavailable"
        : dialog?.view === "remove"
          ? "Remove MCP server"
          : server.name;

  return (
    <Dialog
      open={!!dialog}
      onOpenChange={(isOpen, details) => {
        if (isOpen) return;
        if (operationPending.current) details.cancel();
        else show(null);
      }}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className={`${panelSubtitle} max-w-xl md:flex-1`}>
            Waffy automatically uses tools from enabled servers when needed.
          </p>
          <button
            ref={addButton}
            type="button"
            aria-haspopup="dialog"
            className={`${primaryAction} gap-2`}
            onClick={(event) => open(event, { view: "form" })}
          >
            <Plus size={16} aria-hidden />
            Add server
          </button>
        </div>

        {loadError && (
          <p role="alert" className={alertError}>
            {loadError}
          </p>
        )}
        {!servers && !loadError && (
          <p role="status" className={panelSubtitle}>
            Loading servers…
          </p>
        )}
        {servers?.length === 0 && (
          <p className={`rounded-xl border border-border px-4 py-6 text-center ${panelSubtitle}`}>
            No MCP servers added.
          </p>
        )}
        {!!servers?.length && (
          <ul className="divide-y divide-border rounded-xl border border-border bg-white/5">
            {servers.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={item.name}>
                    {item.name}
                  </p>
                  <p className={`${panelSubtitle} truncate`} title={visibleEndpoint(item)}>
                    {visibleEndpoint(item)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${item.enabled ? "bg-green-dim text-green" : "bg-white/8 text-white/65"}`}
                  >
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
                    {item.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Manage ${item.name}`}
                    className={secondaryAction}
                    onClick={(event) => open(event, { view: "manage", serverId: item.id })}
                  >
                    Manage
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <DialogContent
          className={`max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-2xl ${thinScroll}`}
          finalFocus={() => (trigger.current?.isConnected ? trigger.current : addButton.current)}
        >
          <DialogHeader className="pr-7">
            <DialogTitle className="wrap-anywhere">{dialogTitle}</DialogTitle>
            {dialog.view === "remove" && server ? (
              <DialogDescription className="wrap-anywhere">
                Remove {server.name} and its saved credentials?
              </DialogDescription>
            ) : (
              dialog.view !== "form" && (
                <DialogDescription className="wrap-anywhere">
                  {server
                    ? visibleEndpoint(server)
                    : "This connection may have been removed in another window."}
                </DialogDescription>
              )
            )}
          </DialogHeader>

          {dialogError && (
            <p role="alert" className={alertError}>
              {dialogError}
            </p>
          )}
          {busy && (
            <p role="status" className={panelSubtitle}>
              {busy}
            </p>
          )}

          {dialog.view === "form" ? (
            <ServerForm
              key={dialog.server?.id ?? "new-server"}
              server={dialog.server}
              savedBearer={dialog.bearer}
              busy={!!busy}
              onSave={(input) => void save(input, dialog.server)}
              onCancel={() => (dialog.server ? manage(dialog.server.id) : show(null))}
            />
          ) : !server ? (
            <DialogFooter>
              <DialogClose className={secondaryAction}>Close</DialogClose>
            </DialogFooter>
          ) : dialog.view === "manage" ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className="text-sm font-medium">Enable this MCP server</span>
                <Switch
                  checked={server.enabled}
                  disabled={!!busy}
                  aria-label="Enable this MCP server"
                  onCheckedChange={(enabled) => void toggleEnabled(server, enabled)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryAction}
                  onClick={() => void edit(server.id)}
                  disabled={!!busy}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={secondaryAction}
                  onClick={() => void test(server)}
                  disabled={!!busy}
                >
                  Test
                </button>
                {server.auth === "oauth" && (
                  <button
                    type="button"
                    className={secondaryAction}
                    onClick={() => void test(server, true)}
                    disabled={!!busy}
                  >
                    Sign in or Reconnect
                  </button>
                )}
                <button
                  type="button"
                  className={dangerAction}
                  onClick={() => show({ view: "remove", serverId: server.id })}
                  disabled={!!busy}
                >
                  Remove
                </button>
              </div>
              {lastTest && (
                <div
                  aria-live="polite"
                  className="space-y-3 rounded-xl border border-green-border bg-green-dim p-4"
                >
                  <p className="text-sm font-semibold">
                    Connection OK · {toolCount(lastTest.tools.length)}
                  </p>
                  {lastTest.tools.length > 0 && (
                    <ul
                      className={`max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-white/65 ${thinScroll}`}
                    >
                      {lastTest.tools.map((name, index) => (
                        <li className="break-all" key={`${name}-${index}`}>
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          ) : (
            <DialogFooter>
              <button
                type="button"
                className={secondaryAction}
                onClick={() => manage(server.id)}
                disabled={!!busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={dangerAction}
                onClick={() => void remove(server)}
                disabled={!!busy}
              >
                Remove server
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
