import { useEffect, useRef, useState, type SetStateAction } from "react";
import toast from "react-hot-toast";
import Browser from "webextension-polyfill";
import { DEFAULT_SETTINGS, parseAppSettings, updateAppSettings } from "@/lib/client";
import { errorMessage } from "@/lib/errors";
import { ACTIONS } from "@/lib/helper";
import {
  applyMcpServerChange,
  isMcpServerKey,
  mergeMcpServerMetadata,
  parseMcpServerConfigs,
  sameMcpConnection,
  type McpServerChange,
  type McpServerConfig,
  type McpServerDraft,
} from "@/lib/mcp/storage";
import {
  applySkillChanges,
  matchesSkill,
  observeSkills,
  rebaseSkillChange,
  type SkillChange,
} from "@/lib/skills/storage";
import { equalJson } from "@/lib/utils";
import type { ApiKeys, AppSettings, Settings, StoredSkill } from "@/types";

interface SettingsDraft {
  saved: AppSettings;
  draft: AppSettings;
  servers: Map<string, McpServerConfig>;
  pendingServers: Map<string, McpServerChange>;
  skills?: Map<string, StoredSkill>;
  pendingSkills: Map<string, SkillChange>;
}

const defaults: AppSettings = { settings: DEFAULT_SETTINGS, apiKeys: {} };

function normalizePrompts(prompts: string[]) {
  return prompts.map((prompt) => prompt.trim()).filter(Boolean);
}

function normalizeApiKeys(keys: ApiKeys): ApiKeys {
  return Object.values(keys).includes("")
    ? Object.fromEntries(Object.entries(keys).filter(([, key]) => key !== ""))
    : keys;
}

function toPayload({ settings, apiKeys }: AppSettings): AppSettings {
  return {
    settings: {
      ...settings,
      pinnedPrompts: normalizePrompts(settings.pinnedPrompts),
    },
    apiKeys: normalizeApiKeys(apiKeys),
  };
}

function mergeEdits<T extends object>(saved: T, draft: T, latest: T): T {
  if (saved === draft) return latest;
  const merged = { ...latest };
  for (const key of Object.keys({ ...saved, ...draft }) as (keyof T)[]) {
    if (equalJson(saved[key], draft[key])) continue;
    if (Object.hasOwn(draft, key)) merged[key] = draft[key];
    else delete merged[key];
  }
  return merged;
}

function rebaseAppDraft(saved: AppSettings, draft: AppSettings, latest: AppSettings): AppSettings {
  if (saved === draft) return latest;
  const settings = mergeEdits(saved.settings, draft.settings, latest.settings);
  const savedPrompts = saved.settings.pinnedPrompts;
  const latestPrompts = latest.settings.pinnedPrompts;
  const promptsFollowStorage =
    !equalJson(savedPrompts, latestPrompts) &&
    equalJson(normalizePrompts(savedPrompts), normalizePrompts(draft.settings.pinnedPrompts));
  return {
    settings: {
      ...settings,
      pinnedPrompts: promptsFollowStorage ? latestPrompts : settings.pinnedPrompts,
      models: mergeEdits(saved.settings.models, draft.settings.models, latest.settings.models),
      customApi: mergeEdits(
        saved.settings.customApi,
        draft.settings.customApi,
        latest.settings.customApi
      ),
    },
    apiKeys: mergeEdits(
      normalizeApiKeys(saved.apiKeys),
      normalizeApiKeys(draft.apiKeys),
      latest.apiKeys
    ),
  };
}

function matchesServer(saved?: McpServerConfig, draft?: McpServerDraft) {
  if (!saved || !draft) return saved === draft;
  return (
    !draft.oauth &&
    saved.server.name === draft.server.name &&
    saved.server.enabled === draft.server.enabled &&
    saved.bearer === draft.bearer &&
    sameMcpConnection(saved.server, draft.server)
  );
}

function rebaseServerChange(change: McpServerChange, saved?: McpServerConfig): McpServerChange {
  const { original, draft } = change;
  if (!original || !draft || !saved || original.server.revision !== saved.server.revision) {
    return change;
  }
  const server = mergeMcpServerMetadata(original.server, draft.server, saved.server);
  // Keep the original name when both tabs renamed the server differently.
  const originalName = server.name === saved.server.name ? saved.server.name : original.server.name;
  return {
    original: { ...saved, server: { ...saved.server, name: originalName } },
    draft: { ...draft, server },
  };
}

export function useSettingsDraft() {
  const [state, setState] = useState<SettingsDraft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [skillLoadError, setSkillLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);

  useEffect(() => {
    if (saving) return;
    let revision = 0;
    let loadedSkills: SettingsDraft["skills"];
    const storage = chrome.storage.local;

    function load() {
      revision += 1;
      const request = revision;
      void storage
        .get(null)
        .then((records) => {
          if (request !== revision || savePending.current) return;
          const saved = parseAppSettings(records);
          const servers = parseMcpServerConfigs(records);
          setState((current) => {
            const pendingServers = new Map(current?.pendingServers);
            for (const entry of pendingServers) {
              const [id, change] = entry;
              const savedServer = servers.get(id);
              const rebased = rebaseServerChange(change, savedServer);
              if (matchesServer(savedServer, rebased.draft)) pendingServers.delete(id);
              else pendingServers.set(id, rebased);
            }
            return {
              saved,
              draft: current ? rebaseAppDraft(current.saved, current.draft, saved) : saved,
              servers,
              pendingServers,
              skills: current?.skills ?? loadedSkills,
              pendingSkills: current?.pendingSkills ?? new Map(),
            };
          });
          setLoadError("");
        })
        .catch((error) => {
          if (request !== revision) return;
          console.error("Error loading settings:", error);
          setLoadError("Failed to load settings.");
        });
    }

    function onChange(changes: Record<string, chrome.storage.StorageChange>) {
      if (changes.settings || changes.apiKeys || Object.keys(changes).some(isMcpServerKey)) {
        load();
      }
    }

    const skillSubscription = observeSkills().subscribe({
      next: (storedSkills) => {
        if (savePending.current) return;
        const skills = new Map(storedSkills.map((skill) => [skill.name, skill]));
        loadedSkills = skills;
        setState((current) => {
          if (!current) return current;
          const pendingSkills = new Map<string, SkillChange>();
          for (const [name, change] of current.pendingSkills) {
            const saved = skills.get(name);
            const rebased = rebaseSkillChange(change, saved);
            if (!matchesSkill(saved, rebased.draft)) pendingSkills.set(name, rebased);
          }
          return { ...current, skills, pendingSkills };
        });
        setSkillLoadError("");
      },
      error: (error) => {
        console.error("Error loading skills:", error);
        setSkillLoadError("Couldn't load installed skills.");
      },
    });
    storage.onChanged.addListener(onChange);
    load();
    return () => {
      revision += 1;
      storage.onChanged.removeListener(onChange);
      skillSubscription.unsubscribe();
    };
  }, [saving]);

  const hasAppEdits = state && state.draft !== state.saved;
  const base = hasAppEdits ? toPayload(state.saved) : null;
  const payload = hasAppEdits ? toPayload(state.draft) : null;
  const appChanged = !equalJson(base, payload);
  const hasChanges = appChanged || !!state?.pendingServers.size || !!state?.pendingSkills.size;

  const setDraft = <Key extends keyof AppSettings>(
    key: Key,
    update: SetStateAction<AppSettings[Key]>
  ) => {
    setState((current) => {
      if (!current) return current;
      const value = typeof update === "function" ? update(current.draft[key]) : update;
      return { ...current, draft: { ...current.draft, [key]: value } };
    });
  };

  const stageServer = (previous?: McpServerDraft, draft?: McpServerDraft) => {
    const id = (draft ?? previous)?.server.id;
    if (!id || savePending.current) return;
    setState((current) => {
      if (!current) return current;
      const pendingServers = new Map(current.pendingServers);
      const change = pendingServers.get(id);
      const saved = current.servers.get(id);
      const original = change ? change.original : previous;
      const latestDraft = change?.draft ?? saved;
      const edited =
        draft && previous && latestDraft
          ? {
              ...draft,
              server: mergeMcpServerMetadata(previous.server, draft.server, latestDraft.server),
            }
          : draft;
      const rebased = rebaseServerChange({ original, draft: edited }, saved);
      if (matchesServer(rebased.original, rebased.draft) || matchesServer(saved, rebased.draft)) {
        pendingServers.delete(id);
      } else {
        pendingServers.set(id, rebased);
      }
      return { ...current, pendingServers };
    });
  };

  const stageSkill = (previous?: StoredSkill, draft?: StoredSkill) => {
    const name = (draft ?? previous)?.name;
    if (!name || savePending.current) return;
    setState((current) => {
      if (!current?.skills) return current;
      const pendingSkills = new Map(current.pendingSkills);
      const change = pendingSkills.get(name);
      const original = change ? change.original : previous;
      const saved = current.skills.get(name);
      const rebased = rebaseSkillChange({ original, draft }, saved);
      if (matchesSkill(rebased.original, rebased.draft) || matchesSkill(saved, rebased.draft)) {
        pendingSkills.delete(name);
      } else {
        pendingSkills.set(name, rebased);
      }
      return { ...current, pendingSkills };
    });
  };

  const save = async () => {
    if (!state || !hasChanges || savePending.current) return;
    savePending.current = true;
    setSaving(true);

    const appSave =
      appChanged && base && payload
        ? updateAppSettings((latest) => {
          const edited = rebaseAppDraft(base, payload, latest);
          const updates: Partial<AppSettings> = {};
          if (!equalJson(latest.settings, edited.settings)) updates.settings = edited.settings;
          if (!equalJson(latest.apiKeys, edited.apiKeys)) updates.apiKeys = edited.apiKeys;
          return updates;
        })
        : undefined;
    const skillSave = state.pendingSkills.size ? applySkillChanges(state.pendingSkills) : undefined;
    const [app, skillsResult, ...serverResults] = await Promise.allSettled([
      appSave,
      skillSave,
      ...[...state.pendingServers].map(async ([id, change]) => ({
        id,
        config: await applyMcpServerChange(id, change),
      })),
    ]);
    const saved = app.status === "fulfilled" ? app.value : undefined;
    const committedSkills = skillsResult.status === "fulfilled" ? skillsResult.value : undefined;
    setState((current) => {
      if (!current) return current;
      const servers = new Map(current.servers);
      const pendingServers = new Map(current.pendingServers);
      for (const result of serverResults) {
        if (result.status === "rejected") continue;
        const { id, config } = result.value;
        if (config) servers.set(id, config);
        else servers.delete(id);
        pendingServers.delete(id);
      }
      return {
        saved: saved ?? current.saved,
        draft: saved ? rebaseAppDraft(state.draft, current.draft, saved) : current.draft,
        servers,
        pendingServers,
        skills: committedSkills
          ? new Map(committedSkills.map((skill) => [skill.name, skill]))
          : current.skills,
        pendingSkills: committedSkills ? new Map() : current.pendingSkills,
      };
    });
    savePending.current = false;
    setSaving(false);

    if (app.status === "rejected") {
      console.error("Error saving settings:", app.reason);
      toast.error("Failed to save settings");
    } else if (saved) {
      void Browser.runtime.sendMessage({ action: ACTIONS.reloadPanel }).catch(() => { });
    }
    const serverError = serverResults.find((result) => result.status === "rejected");
    if (serverError) toast.error(errorMessage(serverError.reason, "Failed to save MCP servers"));
    if (skillsResult.status === "rejected") {
      toast.error(errorMessage(skillsResult.reason, "Failed to save skills"));
    }
    if (app.status === "fulfilled" && skillsResult.status === "fulfilled" && !serverError) {
      toast.success("Changes saved");
    }
  };

  const visibleServers = new Map<string, McpServerDraft>(state?.servers);
  for (const entry of state?.pendingServers ?? []) {
    const [id, { draft }] = entry;
    if (draft) visibleServers.set(id, draft);
    else visibleServers.delete(id);
  }
  const visibleSkills = state?.skills ? new Map(state.skills) : undefined;
  if (state && visibleSkills) {
    for (const [name, { draft }] of state.pendingSkills) {
      if (draft) visibleSkills.set(name, draft);
      else visibleSkills.delete(name);
    }
  }

  return {
    draft: state?.draft,
    loadError,
    hasChanges,
    saving,
    savedMemoryEnabled: state?.saved.settings.featureMemory ?? false,
    servers: [...visibleServers.values()].sort((a, b) =>
      a.server.name.localeCompare(b.server.name)
    ),
    skills: visibleSkills && [...visibleSkills.values()].sort((a, b) => a.name.localeCompare(b.name)),
    skillLoadError,
    setSettings: (update: SetStateAction<Settings>) => setDraft("settings", update),
    setApiKeys: (update: SetStateAction<ApiKeys>) => setDraft("apiKeys", update),
    stageServer,
    stageSkill,
    save,
    cancel: () =>
      setState(
        (current) =>
          current && {
            ...current,
            draft: current.saved,
            pendingServers: new Map(),
            pendingSkills: new Map(),
          }
      ),
    resetDefaults: () => setState((current) => current && { ...current, draft: defaults }),
  };
}
