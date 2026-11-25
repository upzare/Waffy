import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { v4 as uuid4 } from "uuid";
import toast, { Toaster } from "react-hot-toast";
import Browser from "webextension-polyfill";
import { TriangleAlert } from "lucide-react";
import type { ModelMessage } from "ai";
import Header from "./components/header";
import ChatContainer from "./components/chat-container";
import InputContainer from "./components/input-container";
import { findSlashCommand, NO_SLASH_COMMAND, storedCommandOffset } from "./utils/slash-commands";
import {
  buildPageTaggedPrompt,
  displayToMarkup,
  fetchPageContent,
  readComposerText,
  parsePageMentionsFromMarkup,
  parsePageSources,
  selectedCommandOffset,
  selectedSkillMentions,
  rebindStoredPages,
  toWindowPages,
} from "./utils/page-mentions";
import { findTypedSkill } from "./utils/skill-mentions";
import { encodeLiteralText, maskLiteralControls } from "./utils/literal-text";
import { registerWritingMessages } from "./utils/writing";
import { fileHandler, fileFormatsToFiles } from "./utils/file-handler";
import {
  ACTIONS,
  base64ToBytes,
  getActiveTab,
  getCurrentWindowTabs,
  type RuntimeMessage,
  type CapturePayload,
} from "@/lib/helper";
import { getAppSettings, DEFAULT_PINNED_PROMPTS } from "@/lib/client";
import {
  PENDING_PANEL_ACTION_KEY,
  PENDING_PANEL_ACTION_TTL_MS,
  SUMMARIZE_PAGE_ACTION,
  type PendingPanelAction,
} from "@/lib/panel-actions";
import { DEFAULT_FEATURES, getFeatureFlags, isModeEnabled, MODE_LABELS } from "@/lib/features";
import {
  observeConversations,
  createConversation,
  updateConversationMessages,
  updateConversationTitle,
  deleteConversation,
} from "@/lib/db";
import { findSkillByName, observeSkills, readSelectedSkill } from "@/lib/skills/storage";
import { findMissingProvider, getStageConfig } from "@/lib/llm/model";
import { generateTitle } from "@/lib/llm/generate";
import {
  buildConversationMessages,
  buildExecutionMessages,
  buildTaskOutputMessages,
} from "@/lib/llm/messages";
import { extractAutomationPlan } from "@/lib/llm/prompts";
import { streamResponse } from "@/lib/llm/stream";
import type { StreamMode } from "@/lib/llm/modes";
import type { TaskStatus } from "@/lib/llm/tools/automate";
import { errorMessage, USER_INTERRUPTED_MESSAGE } from "@/lib/errors";
import { initAnalytics } from "@/lib/posthog";
import HistorySidebar from "./components/history-sidebar";
import WorkingDialog from "./components/working-dialog";
import Hero from "./components/hero";
import Particles from "./components/particles";
import Loader from "./components/loader";
import type {
  Message,
  MessageMode,
  Conversation,
  AppSettings,
  StreamingState,
  FileFormat,
  PageSource,
  SkillMention,
  SkillSummary,
  StoredSkill,
} from "../types";
import "@/stylesheets/globals.css";

type PanelView = "loading" | "home" | "chat";

const RESPONSE_DISPLAY = { status: "GENERATING", stream: "response" } as const;
const STAGE_DISPLAY = {
  base: RESPONSE_DISPLAY,
  search: RESPONSE_DISPLAY,
  research: RESPONSE_DISPLAY,
  t1: RESPONSE_DISPLAY,
  t2: { status: "EXECUTING", stream: "execution" },
  t3: { status: "FINALIZING", stream: "output" },
} satisfies Record<StreamMode, { status: string; stream: StreamingState }>;

const App = () => {
  const [messages, renderMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages);
  const [panelView, setPanelView] = useState<PanelView>("loading");
  const [showWorkingDialog, setShowWorkingDialog] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [toolActivityText, setToolActivityText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const isGenerating = streamingMessageId !== null;
  const [missingApiKeys, setMissingApiKeys] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);

  const features = appSettings ? getFeatureFlags(appSettings.settings) : DEFAULT_FEATURES;
  const pinnedPrompts = appSettings?.settings.pinnedPrompts ?? DEFAULT_PINNED_PROMPTS;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentTitle, setCurrentTitle] = useState("New Chat");
  const [inputResetKey, setInputResetKey] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController>(null);
  const generationLockRef = useRef(false);
  const conversationIdRef = useRef<string>(null);
  const messageIdRef = useRef<string>(null);
  const lastPanelActionRef = useRef<number>(null);

  const checkAppSettings = async () => {
    const data = await getAppSettings();
    const flags = getFeatureFlags(data.settings);
    const missingStage = await findMissingProvider(
      data.settings.models,
      data.apiKeys,
      flags,
      data.settings.customApi
    );
    return { data, missingApiKeys: missingStage !== null };
  };

  const consumePendingAction = async (): Promise<boolean> => {
    const stored = await chrome.storage.session.get(PENDING_PANEL_ACTION_KEY);
    const action = stored[PENDING_PANEL_ACTION_KEY] as PendingPanelAction | undefined;
    if (!action || action.type !== SUMMARIZE_PAGE_ACTION) return false;

    if (Date.now() - action.createdAt > PENDING_PANEL_ACTION_TTL_MS) {
      await chrome.storage.session.remove(PENDING_PANEL_ACTION_KEY);
      return false;
    }
    const current = await Browser.windows.getCurrent();
    if (action.windowId !== current.id || lastPanelActionRef.current === action.createdAt) {
      return false;
    }

    lastPanelActionRef.current = action.createdAt;
    await chrome.storage.session.remove(PENDING_PANEL_ACTION_KEY);
    await handleSummarizePage(action.tabId);
    return true;
  };

  const attachCapture = (incoming: RuntimeMessage<CapturePayload>) => {
    const shot = incoming.payload;
    if (!shot?.content || !shot.mimeType) return;

    const file = new File([base64ToBytes(shot.content)], shot.name || "page-capture.jpg", {
      type: shot.mimeType,
    });
    setFiles((current) => [...current, file]);
  };

  useEffect(() => {
    const conversationSubscription = observeConversations().subscribe({
      next: setConversations,
    });
    const skillSubscription = observeSkills().subscribe({
      next: (storedSkills) =>
        setSkills(
          storedSkills.filter((skill) => skill.enabled).map(({ instructions, ...summary }) => summary)
        ),
      error: () => setSkills([]),
    });

    const init = async () => {
      const { data, missingApiKeys } = await checkAppSettings();
      setAppSettings(data);
      setMissingApiKeys(missingApiKeys);
    };

    init();

    const onMessage = (request: unknown) => {
      const message = (request ?? {}) as RuntimeMessage<CapturePayload>;
      switch (message.action) {
        case ACTIONS.reloadPanel:
          window.location.reload();
          return;
        case ACTIONS.attachCapture:
          void (async () => {
            const panelWindow = await Browser.windows.getCurrent();
            if (message.windowId == null || message.windowId !== panelWindow.id) return;
            attachCapture(message);
          })();
          return;
        default:
          return undefined;
      }
    };
    Browser.runtime.onMessage.addListener(onMessage);
    const stopWritingMessages = registerWritingMessages((text) => {
      const captured = encodeLiteralText(text.replace(/\r\n?/g, "\n"));
      setMessage((current) => (current ? `${current}\n\n${captured}` : captured));
      setInputResetKey((key) => key + 1);
    });

    return () => {
      abortControllerRef.current?.abort();
      conversationSubscription.unsubscribe();
      skillSubscription.unsubscribe();
      Browser.runtime.onMessage.removeListener(onMessage);
      stopWritingMessages();
    };
  }, []);

  useEffect(() => {
    void initAnalytics();
  }, []);

  const onStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName === "session" && changes[PENDING_PANEL_ACTION_KEY]?.newValue) {
      void consumePendingAction();
    }
  };

  useEffect(() => {
    if (!appSettings) return;

    chrome.storage.onChanged.addListener(onStorageChanged);
    void consumePendingAction().then((handled) => {
      if (!handled) {
        setPanelView((current) => (current === "loading" ? "home" : current));
      }
    });

    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [appSettings]);

  const replaceMessages = (next: Message[]) => {
    messagesRef.current = next;
    renderMessages(next);
  };

  const generateConversationTitle = async (id: string, prompt: string, settings: AppSettings) => {
    const title = await generateTitle(prompt, settings);
    await updateConversationTitle(id, title);
    if (conversationIdRef.current === id) setCurrentTitle(title);
  };

  const persistMessages = async () => {
    const id = conversationIdRef.current;
    if (id) await updateConversationMessages(id, messagesRef.current);
  };

  const updateAssistantMessage = (patch: (msg: Message) => Message, persist = false) => {
    const messageId = messageIdRef.current;
    if (!messageId) return;
    const assistantId = `assistant-${messageId}`;
    replaceMessages(messagesRef.current.map((msg) => (msg.id === assistantId ? patch(msg) : msg)));
    if (persist) return persistMessages();
  };

  const isAborted = () => Boolean(abortControllerRef.current?.signal.aborted);

  const assertNotAborted = () => {
    if (isAborted()) throw USER_INTERRUPTED_MESSAGE;
  };

  const showError = (error?: unknown) => setErrorText(errorMessage(error));

  const generateResponse = async (
    mode: StreamMode,
    messages: ModelMessage[],
    settings: AppSettings,
    options?: { toolsContext?: Record<string, object>; skill?: StoredSkill }
  ) => {
    const abortSignal = abortControllerRef.current!.signal;
    abortSignal.throwIfAborted();
    const { status, stream } = STAGE_DISPLAY[mode];
    setStatusText(status);
    setStreaming(stream);

    let text = "";
    let finalText = "";
    try {
      for await (const event of streamResponse({
        mode,
        messages,
        settings,
        abortSignal,
        ...options,
        onToolActivity: setToolActivityText,
        onMcpUnavailable: (message) => toast.error(message),
      })) {
        switch (event.type) {
          case "text.stream": {
            if (stream === "execution") break;
            text += event.text;
            const response = text;
            updateAssistantMessage((msg) => ({
              ...msg,
              content: { ...msg.content, text: { ...msg.content.text, [stream]: response } },
            }));
            break;
          }
          case "execution.step":
            updateAssistantMessage((msg) => {
              const execution = [...(msg.content.text?.execution ?? []), event.label];
              return {
                ...msg,
                content: { ...msg.content, text: { ...msg.content.text, execution } },
              };
            });
            break;
          case "response.completed":
            finalText = event.finalText;
            await persistMessages();
            break;
          case "tools.pending":
            await persistMessages();
            break;
        }
      }
      abortSignal.throwIfAborted();
      return finalText;
    } finally {
      setToolActivityText(null);
      setStreaming(null);
    }
  };

  const executeBrowserTask = async (
    tabId: number,
    task: string,
    promptFiles: FileFormat[],
    conversationMessages: Message[],
    settings: AppSettings,
    skill?: StoredSkill
  ) =>
    navigator.locks.request("waffy-browser-automation", { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error("Another Waffy window is running browser automation.");
      assertNotAborted();
      setStatusText("EXECUTING");
      try {
        const session = (await Browser.runtime.sendMessage({
          action: ACTIONS.startSession,
          tabId,
        })) as { status: string; value?: string };
        if (session?.status !== "success")
          throw new Error(session?.value ?? "Could not start browser automation.");
        assertNotAborted();
        await updateAssistantMessage(
          (msg) => ({
            ...msg,
            content: {
              ...msg.content,
              text: { ...msg.content.text, execution: ["Initializing"] },
            },
          }),
          true
        );
        return await generateResponse(
          "t2",
          buildExecutionMessages(task, promptFiles, conversationMessages),
          settings,
          { skill }
        );
      } finally {
        await Browser.runtime.sendMessage({ action: ACTIONS.stopSession });
      }
    });

  const automateRequest = async (
    promptText: string,
    promptFiles: FileFormat[],
    conversationMessages: Message[],
    settings: AppSettings,
    skill?: StoredSkill
  ) => {
    assertNotAborted();
    setStatusText("GENERATING");

    const tab = await getActiveTab();
    const finalText = await generateResponse(
      "t1",
      buildConversationMessages(promptText, promptFiles, conversationMessages),
      settings,
      { skill }
    );
    const task = extractAutomationPlan(finalText);
    if (!task) return;
    if (tab?.id == null) throw new Error("No active tab found for automation.");
    await updateAssistantMessage((msg) => ({ ...msg, content: { ...msg.content, task } }), true);
    assertNotAborted();

    const executionResponse = await executeBrowserTask(
      tab.id,
      task,
      promptFiles,
      conversationMessages,
      settings,
      skill
    );
    await generateResponse("t3", buildTaskOutputMessages(task, executionResponse), settings, {
      skill,
      toolsContext: {
        reportStatus: {
          onTaskStatus: (taskStatus: TaskStatus) => {
            updateAssistantMessage((msg) => ({
              ...msg,
              content: { ...msg.content, taskStatus },
            }));
          },
        },
      },
    });
  };

  const ensureProvidersConfigured = async (mode: MessageMode, appSettings: AppSettings) => {
    const missingStage = await findMissingProvider(
      appSettings.settings.models,
      appSettings.apiKeys,
      getFeatureFlags(appSettings.settings),
      appSettings.settings.customApi,
      mode === "automate" ? ["t1", "t2", "t3"] : [mode]
    );
    if (!missingStage) return true;

    const provider = getStageConfig(appSettings.settings.models, missingStage).provider;
    if (provider === "browser-ai") {
      toast.error("Download Browser AI in extension settings.");
    } else if (provider === "custom") {
      toast.error("Configure Custom API in extension settings.");
    } else {
      toast.error("Configure API keys in extension settings.");
    }
    Browser.runtime.openOptionsPage();
    return false;
  };

  const sendMessage = async ({
    promptText,
    promptFiles,
    mode,
    skill,
    messageId,
    conversationContext,
    prepareMessages,
    clearInput,
  }: {
    promptText: string;
    promptFiles: FileFormat[];
    mode: MessageMode;
    skill?: SkillMention;
    messageId: string;
    conversationContext: Message[];
    prepareMessages: (settings: AppSettings) => void | Promise<void>;
    clearInput?: string;
  }) => {
    let activeSkill: StoredSkill | undefined;
    if (skill) {
      try {
        activeSkill = await readSelectedSkill(skill);
      } catch (error) {
        toast.error(errorMessage(error));
        return;
      }
    }

    const settings = await getAppSettings();
    if (!isModeEnabled(mode, getFeatureFlags(settings.settings))) {
      toast.error(`Enable ${MODE_LABELS[mode] ?? mode} in extension settings.`);
      return;
    }
    if (!(await ensureProvidersConfigured(mode, settings))) return;

    messageIdRef.current = messageId;
    setStreamingMessageId(`assistant-${messageId}`);
    setStatusText("INITIALIZING");
    setErrorText("");
    abortControllerRef.current = new AbortController();

    try {
      await prepareMessages(settings);
      assertNotAborted();
      if (clearInput !== undefined) {
        setMessage((current) => {
          if (current === clearInput) return "";
          // A Draft & Rewrite handoff can append a new draft while this send starts.
          const sentPrefix = `${clearInput}\n\n`;
          return current.startsWith(sentPrefix) ? current.slice(sentPrefix.length) : current;
        });
        setFiles([]);
        setInputResetKey((key) => key + 1);
      }

      if (mode === "automate") {
        await automateRequest(promptText, promptFiles, conversationContext, settings, activeSkill);
      } else {
        await generateResponse(
          mode,
          buildConversationMessages(promptText, promptFiles, conversationContext),
          settings,
          { skill: activeSkill }
        );
      }
    } catch (error) {
      showError(isAborted() ? USER_INTERRUPTED_MESSAGE : error);
      await updateAssistantMessage((msg) => ({ ...msg, aborted: true }), true);
    } finally {
      setStreaming(null);
      setStreamingMessageId(null);
      setStatusText("");
      setToolActivityText(null);
      if (clearInput === undefined) textareaRef.current?.focus();
      messageIdRef.current = null;
      abortControllerRef.current = null;
    }
  };

  const sendUserPrompt = async ({
    text,
    promptFilesInput,
    conversationContextOverride,
    onPrepared,
  }: {
    text: string;
    promptFilesInput: File[];
    conversationContextOverride?: Message[];
    onPrepared?: (prepared: boolean) => void;
  }) => {
    if (generationLockRef.current) {
      onPrepared?.(false);
      return;
    }

    generationLockRef.current = true;
    let wasPrepared = false;
    try {
      const { text: displayPrompt, literalOffsets } = readComposerText(text);
      const promptControlsText = maskLiteralControls(displayPrompt, literalOffsets);
      const pageMentions = parsePageMentionsFromMarkup(text);
      const command = findSlashCommand(promptControlsText, selectedCommandOffset(text));
      const commandOffset = command?.start ?? (literalOffsets.length ? NO_SLASH_COMMAND : undefined);
      const mode = command?.value ?? "base";

      if (!displayPrompt.trim() && promptFilesInput.length === 0) return;

      const selectedSkills = selectedSkillMentions(text);
      if (selectedSkills.length > 1) {
        toast.error("Select one skill per message.");
        return;
      }
      let skill: SkillMention | undefined = selectedSkills[0];
      if (!skill) {
        const typedSkill = findTypedSkill(promptControlsText, command);
        if (typedSkill) {
          const found = await findSkillByName(typedSkill.name);
          if (found) skill = { ...typedSkill, id: found.id, revision: found.revision };
        }
      }

      const muted = pageMentions.find((page) => page.muted || page.tabId == null);
      if (muted) {
        toast.error(`${muted.label} is no longer open`);
        return;
      }

      let pageSources: PageSource[] = [];
      if (pageMentions.length > 0) {
        const openPages = toWindowPages(await getCurrentWindowTabs());
        const missing = pageMentions.find(
          (page) => page.tabId == null || !openPages.some((open) => open.tabId === page.tabId)
        );
        if (missing) {
          toast.error(`${missing.label} is no longer open`);
          setMessage(
            displayToMarkup(
              displayPrompt,
              rebindStoredPages(
                pageMentions.map((page) => ({
                  mention: page.mention,
                  title: page.label,
                  url: page.url ?? "",
                  tabId: page.tabId ?? -1,
                  content: "",
                })),
                openPages
              ),
              commandOffset,
              skill,
              literalOffsets
            )
          );
          setInputResetKey((key) => key + 1);
          return;
        }

        const unique: typeof pageMentions = [];
        const seen = new Set<number>();
        for (const page of pageMentions) {
          if (page.tabId == null || seen.has(page.tabId)) continue;
          seen.add(page.tabId);
          unique.push(page);
        }

        const fetched = await Promise.all(
          unique.map(async (page) => {
            const result = await fetchPageContent(page.tabId as number);
            return { page, result };
          })
        );

        const failed = fetched.find((item) => !item.result.ok);
        if (failed && !failed.result.ok) {
          toast.error(`Couldn't read ${failed.page.label}`);
          return;
        }

        pageSources = fetched.flatMap(({ page, result }) => {
          if (!result.ok || page.tabId == null) return [];
          const open = openPages.find((item) => item.tabId === page.tabId);
          return [
            {
              mention: page.mention,
              title: page.label,
              url: open?.url ?? page.url ?? "",
              tabId: page.tabId,
              content: result.content,
            },
          ];
        });
      }

      const promptFiles = await fileHandler(promptFilesInput);
      const modelPrompt = buildPageTaggedPrompt(displayPrompt, pageSources, commandOffset, skill);
      if (!modelPrompt.trim() && promptFiles.length === 0) {
        const promptControls = [skill && `$${skill.name}`, command && `/${command.value}`];
        const promptControl = promptControls.find(Boolean);
        toast.error(promptControl ? `Add a message after ${promptControl}` : "Message cannot be empty");
        return;
      }

      const messageId = uuid4();
      const conversationContext = conversationContextOverride ?? messagesRef.current;
      const isFirstMessage = conversationContext.length === 0;

      await sendMessage({
        promptText: modelPrompt,
        promptFiles,
        mode,
        skill,
        messageId,
        conversationContext,
        clearInput: text,
        prepareMessages: async (settings) => {
          if (!conversationIdRef.current) {
            const id = uuid4();
            await createConversation(id);
            conversationIdRef.current = id;
          }
          replaceMessages([
            ...conversationContext,
            {
              id: `user-${messageId}`,
              content: {
                text: { prompt: displayPrompt },
                files: promptFiles,
                ...(commandOffset !== undefined && { commandOffset }),
                ...(literalOffsets.length > 0 && { literalOffsets }),
                ...(skill && { skill }),
                ...(pageSources.length > 0 && { pageSources: JSON.stringify(pageSources) }),
              },
            },
            { id: `assistant-${messageId}`, content: {}, mode },
          ]);
          await persistMessages();

          setPanelView("chat");
          wasPrepared = true;
          onPrepared?.(true);

          if (isFirstMessage) {
            void generateConversationTitle(
              conversationIdRef.current,
              displayPrompt,
              settings
            ).catch(() => { });
          }
        },
      });
    } catch (error) {
      showError(error);
    } finally {
      generationLockRef.current = false;
      if (!wasPrepared) onPrepared?.(false);
    }
  };

  const handleSendMessage = async () => {
    await sendUserPrompt({
      text: message,
      promptFilesInput: files,
    });
  };

  const handlePromptClick = (prompt: string) => {
    setMessage(prompt);
    sendUserPrompt({
      text: prompt,
      promptFilesInput: [],
    });
  };

  const handleRetryMessage = async (assistantMessageId: string) => {
    if (generationLockRef.current || !assistantMessageId.startsWith("assistant-")) return;

    const history = messagesRef.current;
    const assistantIndex = history.findIndex((msg) => msg.id === assistantMessageId);
    if (assistantIndex < 1) return;

    const userMsg = history[assistantIndex - 1];
    const assistantMsg = history[assistantIndex];
    if (!userMsg?.id.startsWith("user-") || !assistantMsg) return;

    const promptText = userMsg.content.text?.prompt ?? "";
    const promptFiles = userMsg.content.files ?? [];
    if (!promptText && promptFiles.length === 0) {
      toast.error("Cannot retry an empty message");
      return;
    }

    const commandOffset = storedCommandOffset(userMsg, assistantMsg);
    const mode = findSlashCommand(promptText, commandOffset)?.value ?? "base";
    const skill = userMsg.content.skill;
    const modelPrompt = buildPageTaggedPrompt(
      promptText,
      parsePageSources(userMsg.content.pageSources),
      commandOffset,
      skill
    );

    generationLockRef.current = true;
    try {
      await sendMessage({
        promptText: modelPrompt,
        promptFiles,
        mode,
        skill,
        messageId: assistantMessageId.slice("assistant-".length),
        conversationContext: history.slice(0, assistantIndex - 1),
        prepareMessages: () =>
          updateAssistantMessage((msg) => ({ ...msg, aborted: false, content: {}, mode }), true),
      });
    } catch (error) {
      showError(error);
    } finally {
      generationLockRef.current = false;
    }
  };

  const handleRevertMessage = async (userMessageId: string) => {
    if (generationLockRef.current || !userMessageId.startsWith("user-")) return;

    const history = messagesRef.current;
    const userIndex = history.findIndex((msg) => msg.id === userMessageId);
    if (userIndex < 0) return;

    const userMsg = history[userIndex];
    const promptText = userMsg.content.text?.prompt ?? "";
    const promptFiles = userMsg.content.files ?? [];
    const storedPages = parsePageSources(userMsg.content.pageSources);
    try {
      const tabs = storedPages.length ? await getCurrentWindowTabs() : [];
      if (generationLockRef.current || messagesRef.current !== history) return;
      const rebound = rebindStoredPages(storedPages, toWindowPages(tabs));
      const restoredFiles = fileFormatsToFiles(promptFiles);
      replaceMessages(history.slice(0, userIndex));
      setMessage(
        displayToMarkup(
          promptText,
          rebound,
          storedCommandOffset(userMsg, history[userIndex + 1]),
          userMsg.content.skill,
          userMsg.content.literalOffsets
        )
      );
      setFiles(restoredFiles);
      setErrorText("");
      setInputResetKey((key) => key + 1);
      textareaRef.current?.focus();
      await persistMessages();
    } catch (error) {
      showError(error);
    }
  };

  const handleStopGeneration = () => {
    if (!abortControllerRef.current) return;
    abortControllerRef.current.abort();

    setToolActivityText(null);
    showError(USER_INTERRUPTED_MESSAGE);

    updateAssistantMessage((msg) => ({ ...msg, aborted: true }));
  };

  const resetConversation = () => {
    replaceMessages([]);
    conversationIdRef.current = null;
    setCurrentTitle("New Chat");
    setStatusText("");
    setToolActivityText(null);
    setErrorText("");
    setMessage("");
    setFiles([]);
    setInputResetKey((key) => key + 1);
  };

  const handleNewChat = () => {
    if (generationLockRef.current) {
      setShowWorkingDialog(true);
      return;
    }
    resetConversation();
    setPanelView("home");
  };

  const handleSelectConversation = (id: string) => {
    if (id === conversationIdRef.current) return;
    if (generationLockRef.current) {
      setShowWorkingDialog(true);
      return;
    }
    const conversation = conversations.find((c) => c.id === id);
    if (conversation) {
      replaceMessages(conversation.messages);
      conversationIdRef.current = id;
      setMessage("");
      setFiles([]);
      setErrorText("");
      setCurrentTitle(conversation.title);
      setPanelView("chat");
      setInputResetKey((key) => key + 1);
    }
  };

  const handleItemRemove = async (id: string) => {
    if (conversationIdRef.current === id && generationLockRef.current) {
      setShowWorkingDialog(true);
      return;
    }
    const conversation = conversations.find((c) => c.id === id);
    if (conversation) {
      await deleteConversation(id);
      if (conversationIdRef.current === id) {
        handleNewChat();
      }
      toast.success("Deleted Successfully", { duration: 1500 });
      textareaRef.current?.focus();
    }
  };

  const handleSummarizePage = async (tabId: number) => {
    const page = toWindowPages(await getCurrentWindowTabs()).find((item) => item.tabId === tabId);
    if (generationLockRef.current) {
      setShowWorkingDialog(true);
      return;
    }
    if (!page) {
      toast.error("This page can't be summarized");
      return;
    }
    setPanelView("loading");
    resetConversation();
    await sendUserPrompt({
      text: `Summarize this page @[${page.label}](tab:${tabId})`,
      promptFilesInput: [],
      conversationContextOverride: [],
      onPrepared: (prepared) => setPanelView(prepared ? "chat" : "home"),
    });
  };

  if (panelView === "loading") {
    return <Loader />;
  }

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <Particles quantity={100} />
      <WorkingDialog open={showWorkingDialog} onClose={() => setShowWorkingDialog(false)} />
      <HistorySidebar
        currentConversationId={conversationIdRef.current}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onRemoveConversation={handleItemRemove}
        locked={showWorkingDialog}
      />
      <div className="w-full h-screen flex flex-col relative overflow-hidden">
        <Header
          currentConversationId={conversationIdRef.current}
          currentTitle={currentTitle}
          onNewChat={handleNewChat}
        />
        {missingApiKeys && (
          <div className="bg-[#3d2a00] px-4 py-2 text-center text-[13px] text-[#f5c542]">
            <button
              className="inline-flex items-center gap-1.5 cursor-pointer"
              onClick={() => {
                void Browser.tabs.create({ url: Browser.runtime.getURL("settings.html#models") });
                window.close();
              }}
            >
              <TriangleAlert size={14} />
              Models not configured correctly.
            </button>
          </div>
        )}
        <Hero
          hidden={panelView !== "home"}
          pinnedPrompts={pinnedPrompts}
          onPromptClick={handlePromptClick}
        />
        <ChatContainer
          hidden={panelView !== "chat"}
          conversationId={conversationIdRef.current}
          messages={messages}
          streaming={streaming}
          streamingMessageId={streamingMessageId}
          isGenerating={isGenerating}
          statusText={statusText}
          toolActivityText={toolActivityText}
          errorText={errorText}
          setErrorText={setErrorText}
          onRetryMessage={handleRetryMessage}
          onRevertMessage={handleRevertMessage}
        />
        <InputContainer
          isGenerating={isGenerating}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          message={message}
          files={files}
          inputResetKey={inputResetKey}
          features={features}
          skills={skills}
          setMessage={setMessage}
          setFiles={setFiles}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
        />
      </div>
    </>
  );
};

ReactDOM.createRoot(document.getElementById("_app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
