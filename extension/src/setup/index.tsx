import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Eye, EyeOff, Info, Pin } from "lucide-react";
import Browser from "webextension-polyfill";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@/stylesheets/globals.css";
import "./setup.css";
import { getAppSettings, saveAppSettings } from "@/lib/client";
import { DEFAULT_FEATURES } from "@/lib/features";
import {
  ensureBrowserAIModelReady,
  getBrowserAIModelLabel,
  getBrowserAIStatus,
  type BrowserAIStatus,
} from "@/lib/llm/browser-ai";
import { DEFAULT_MODELS, PROVIDER_MODELS } from "@/lib/llm/model";
import {
  BROWSER_AI_PROVIDER,
  CUSTOM_PROVIDER,
  PROVIDERS,
  getProviderMeta,
  type CloudProviderId,
} from "@/settings/providers";
import { Switch } from "@/components/ui/switch";
import type { ApiKeys, ModelConfig, ProviderId, Settings, StageId } from "@/types";
import FeatureStory from "./feature-story";

const STEPS = ["Welcome", "Provider", "Connect", "Model", "Finish"] as const;

const BROWSER_AI_STATUS_LABELS: Record<BrowserAIStatus, string> = {
  unsupported: "Unsupported",
  unavailable: "Unavailable",
  downloadable: "Ready to download",
  downloading: "Downloading",
  available: "Ready",
};

const PROVIDER_CHOICES: { id: ProviderId; label: string; description: string; badge?: string }[] = [
  {
    id: BROWSER_AI_PROVIDER.id,
    label: BROWSER_AI_PROVIDER.label,
    description: "Gemini Nano, Phi Mini, and other browser built-in models.",
    badge: "On-device",
  },
  ...PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
  })),
  {
    id: CUSTOM_PROVIDER.id,
    label: CUSTOM_PROVIDER.label,
    description: "An OpenAI-compatible endpoint.",
  },
];

const FEATURE_TOGGLES: {
  key: keyof typeof DEFAULT_FEATURES;
  label: string;
  description: string;
}[] = [
    {
      key: "featureSearch",
      label: "Search",
      description: "Search the web, read the best page, and answer from what it says.",
    },
    {
      key: "featureResearch",
      label: "Research",
      description: "Work across several sources and come back with a fuller answer.",
    },
    {
      key: "featureAutomation",
      label: "Automation",
      description: "Give a task. It clicks, types, and scrolls until the task is done.",
    },
    {
      key: "featureMemory",
      label: "Personalized Memory",
      description: "Remember useful facts from chats and use them in later conversations.",
    },
  ];

const pillPrimary =
  "inline-flex items-center justify-center rounded-full border border-[#00ff00] bg-[#00ff00] px-6 py-2.5 text-sm font-bold text-black transition-colors duration-300 hover:border-white hover:bg-white disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-white/10 disabled:text-white/35";

const pillSecondary =
  "inline-flex items-center justify-center rounded-full border border-white/15 bg-white/6 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-[18px] transition-colors duration-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

const fieldClass =
  "w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white outline-none transition-[border-color,box-shadow] placeholder:text-white/30 focus:border-[#00ff00]/70 focus:shadow-[0_0_0_3px_rgba(0,255,0,0.12)]";

function extensionOrigin(): string {
  try {
    return Browser.runtime.id;
  } catch {
    return "*";
  }
}

function assignStages(provider: ProviderId, model: string): Record<StageId, ModelConfig> {
  const stages = Object.keys(DEFAULT_MODELS) as StageId[];
  return Object.fromEntries(stages.map((stage) => [stage, { provider, model }])) as Record<
    StageId,
    ModelConfig
  >;
}

function isCloudProvider(provider: ProviderId): provider is CloudProviderId {
  return provider !== "browser-ai" && provider !== "custom";
}

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customKeyVisible, setCustomKeyVisible] = useState(false);
  const [model, setModel] = useState("");
  const [featureSearch, setFeatureSearch] = useState(DEFAULT_FEATURES.featureSearch);
  const [featureResearch, setFeatureResearch] = useState(DEFAULT_FEATURES.featureResearch);
  const [featureAutomation, setFeatureAutomation] = useState(DEFAULT_FEATURES.featureAutomation);
  const [featureMemory, setFeatureMemory] = useState(DEFAULT_FEATURES.featureMemory);
  const [browserStatus, setBrowserStatus] = useState<BrowserAIStatus | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (provider !== "browser-ai") return;
    let cancelled = false;
    getBrowserAIStatus()
      .then((status) => {
        if (!cancelled) setBrowserStatus(status);
      })
      .catch(() => {
        if (!cancelled) setBrowserStatus("unsupported");
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const chooseProvider = (id: ProviderId) => {
    if (provider !== id) setApiKey("");
    setProvider(id);
    setKeyVisible(false);
    if (id !== "browser-ai" && id !== "custom") {
      setModel(PROVIDER_MODELS[id][0] ?? "");
    }
  };

  const refreshBrowserStatus = async () => {
    try {
      const status = await getBrowserAIStatus();
      setBrowserStatus(status);
      return status;
    } catch {
      setBrowserStatus("unsupported");
      return "unsupported" as const;
    }
  };

  const downloadBrowserModel = async () => {
    setDownloading(true);
    setDownloadError(null);
    setDownloadProgress(0);
    try {
      await ensureBrowserAIModelReady((progress) => {
        setDownloadProgress(progress);
        setBrowserStatus("downloading");
      });
      await refreshBrowserStatus();
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Failed to download Browser AI.");
      await refreshBrowserStatus();
    } finally {
      setDownloading(false);
    }
  };

  const canContinue = (() => {
    if (step === 0) return true;
    if (step === 1) return provider !== null;
    if (!provider) return false;
    if (step === 2) {
      if (provider === "browser-ai") return browserStatus === "available";
      if (provider === "custom") return customBaseUrl.trim().length > 0;
      return apiKey.trim().length > 0;
    }
    if (step === 3) {
      if (provider === "browser-ai") return true;
      if (provider === "custom") return customModel.trim().length > 0;
      return model.trim().length > 0;
    }
    return true;
  })();

  const finish = async () => {
    if (!provider || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { settings, apiKeys } = await getAppSettings();
      const modelId =
        provider === "browser-ai" ? "default" : provider === "custom" ? customModel.trim() : model;
      const nextSettings: Settings = {
        ...settings,
        featureSearch,
        featureResearch,
        featureAutomation,
        featureMemory,
        models: assignStages(provider, modelId),
        customApi:
          provider === "custom"
            ? { baseUrl: customBaseUrl.trim(), model: customModel.trim() }
            : settings.customApi,
      };
      const nextKeys: ApiKeys = { ...apiKeys };
      if (provider === "custom") {
        const key = customKey.trim();
        if (key) nextKeys.custom = key;
      } else if (isCloudProvider(provider)) {
        nextKeys[provider] = apiKey.trim();
      }
      await saveAppSettings(nextSettings, nextKeys);
      setDone(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save setup.");
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (!canContinue) return;
    if (step === STEPS.length - 1) {
      void finish();
      return;
    }
    setStep((current) => current + 1);
  };

  const flags = { featureSearch, featureResearch, featureAutomation, featureMemory };
  const setFlag = (key: keyof typeof flags, value: boolean) => {
    if (key === "featureSearch") setFeatureSearch(value);
    if (key === "featureResearch") setFeatureResearch(value);
    if (key === "featureAutomation") setFeatureAutomation(value);
    if (key === "featureMemory") setFeatureMemory(value);
  };

  return (
    <div className="setup-root relative">
      <div className="relative mx-auto grid min-h-dvh max-w-[1500px] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <aside className="hidden h-dvh min-h-0 overflow-y-auto border-white/10 bg-[#070807] lg:block lg:border-r">
          <FeatureStory />
        </aside>

        <section className="flex h-dvh min-h-0 flex-col bg-black">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
            <div className="flex min-h-full flex-1 flex-col">
              {done ? (
                <DoneStep />
              ) : (
                <>
                  <div className="mb-8 flex gap-1.5" aria-hidden="true">
                    {STEPS.map((label, index) => (
                      <span
                        key={label}
                        className={`h-1 flex-1 rounded-full ${index <= step ? "bg-[#00ff00]" : "bg-white/10"}`}
                      />
                    ))}
                  </div>
                  <p className="sr-only">
                    Step {step + 1} of {STEPS.length}: {STEPS[step]}
                  </p>

                  {step === 0 ? <WelcomeStep /> : null}
                  {step === 1 ? (
                    <ProviderStep provider={provider} onChoose={chooseProvider} />
                  ) : null}
                  {step === 2 && provider ? (
                    <ConnectStep
                      provider={provider}
                      apiKey={apiKey}
                      keyVisible={keyVisible}
                      onKey={setApiKey}
                      onToggleKey={() => setKeyVisible((value) => !value)}
                      customBaseUrl={customBaseUrl}
                      customKey={customKey}
                      customKeyVisible={customKeyVisible}
                      onBaseUrl={setCustomBaseUrl}
                      onCustomKey={setCustomKey}
                      onToggleCustomKey={() => setCustomKeyVisible((value) => !value)}
                      browserStatus={browserStatus}
                      downloading={downloading}
                      downloadProgress={downloadProgress}
                      downloadError={downloadError}
                      onDownload={() => void downloadBrowserModel()}
                      onChooseOther={() => setStep(1)}
                    />
                  ) : null}
                  {step === 3 && provider ? (
                    <ModelStep
                      provider={provider}
                      model={model}
                      onModel={setModel}
                      customModel={customModel}
                      onCustomModel={setCustomModel}
                    />
                  ) : null}
                  {step === 4 && provider ? (
                    <FinishStep
                      provider={provider}
                      model={provider === "custom" ? customModel : model}
                      flags={flags}
                      onFlag={setFlag}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>

          {!done ? (
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#070807] px-5 py-4 sm:px-8 lg:px-12">
              {step > 0 ? (
                <button type="button" className={pillSecondary} onClick={() => setStep(step - 1)}>
                  Back
                </button>
              ) : (
                <span />
              )}
              <div className="flex flex-col items-end gap-2">
                {saveError ? <p className="text-xs text-[#ff5c5c]">{saveError}</p> : null}
                <button
                  type="button"
                  className={pillPrimary}
                  disabled={!canContinue || saving}
                  onClick={goNext}
                >
                  {saving
                    ? "Saving…"
                    : step === 0
                      ? "Set up your model"
                      : step === 4
                        ? "Finish setup"
                        : "Continue"}
                </button>
              </div>
            </footer>
          ) : null}
        </section>
      </div>
    </div>
  );
};

const WelcomeStep = () => (
  <div>
    <div className="lg:hidden">
      <FeatureStory />
    </div>
    <div className="hidden lg:block">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-[#00ff00]">
        01 · Welcome
      </p>
      <h2 className="mt-4 text-[clamp(2.25rem,4vw,3.5rem)] font-bold leading-[0.92] tracking-[-0.05em]">
        Bring a model.
      </h2>
      <p className="mt-5 text-base leading-relaxed text-white/55">
        Start with the model already in your browser, or connect one you already pay for. Keys stay
        on this device. You can change any of this later.
      </p>
    </div>
  </div>
);

const ProviderStep = ({
  provider,
  onChoose,
}: {
  provider: ProviderId | null;
  onChoose: (id: ProviderId) => void;
}) => (
  <div>
    <StepHeading
      eyebrow="02 · Provider"
      title="Choose who thinks."
      body="On-device models never need a key. Cloud keys stay in this browser."
    />
    <div className="mt-8 grid gap-3 sm:grid-cols-2" role="listbox" aria-label="Model provider">
      {PROVIDER_CHOICES.map((choice) => {
        const selected = provider === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChoose(choice.id)}
            className={`rounded-2xl border px-4 py-4 text-left backdrop-blur-[18px] transition-colors ${choice.id === "browser-ai" ? "sm:col-span-2" : ""
              } ${selected
                ? "border-[#00ff00] bg-[#00ff00]/15 shadow-[0_0_32px_rgba(0,255,0,0.12)]"
                : "border-white/12 bg-white/6 hover:border-white/25 hover:bg-white/10"
              }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-base font-bold tracking-[-0.02em]">{choice.label}</span>
              {choice.badge ? (
                <span className="rounded-full border border-[#00ff00]/40 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#00ff00]">
                  {choice.badge}
                </span>
              ) : null}
            </span>
            <span className="mt-1.5 block text-sm leading-snug text-white/45">
              {choice.description}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

const ConnectStep = ({
  provider,
  apiKey,
  keyVisible,
  onKey,
  onToggleKey,
  customBaseUrl,
  customKey,
  customKeyVisible,
  onBaseUrl,
  onCustomKey,
  onToggleCustomKey,
  browserStatus,
  downloading,
  downloadProgress,
  downloadError,
  onDownload,
  onChooseOther,
}: {
  provider: ProviderId;
  apiKey: string;
  keyVisible: boolean;
  onKey: (value: string) => void;
  onToggleKey: () => void;
  customBaseUrl: string;
  customKey: string;
  customKeyVisible: boolean;
  onBaseUrl: (value: string) => void;
  onCustomKey: (value: string) => void;
  onToggleCustomKey: () => void;
  browserStatus: BrowserAIStatus | null;
  downloading: boolean;
  downloadProgress: number;
  downloadError: string | null;
  onDownload: () => void;
  onChooseOther: () => void;
}) => {
  if (provider === "browser-ai") {
    return (
      <BrowserAiConnect
        status={browserStatus}
        downloading={downloading}
        progress={downloadProgress}
        error={downloadError}
        onDownload={onDownload}
        onChooseOther={onChooseOther}
      />
    );
  }

  if (provider === "custom") {
    return (
      <div>
        <StepHeading
          eyebrow="03 · Connect"
          title="Point at your server."
          body="Any OpenAI-compatible endpoint. The API key is optional for local servers."
        />
        <div className="mt-6 flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/60">
          <Info size={16} className="mt-0.5 shrink-0 text-[#00ff00]" />
          <p>
            Local servers like Ollama block extension requests unless you allow this origin. Set{" "}
            <strong className="font-semibold text-white">OLLAMA_ORIGINS</strong> to{" "}
            <code className="font-mono text-white">chrome-extension://*</code> or{" "}
            <code className="font-mono text-white">chrome-extension://{extensionOrigin()}</code>{" "}
            then restart the server.
          </p>
        </div>
        <label className="mt-6 flex flex-col gap-2">
          <span className="text-sm font-medium text-white/70">Base URL</span>
          <input
            className={`${fieldClass} font-mono`}
            type="url"
            placeholder="http://localhost:11434/v1"
            value={customBaseUrl}
            onChange={(event) => onBaseUrl(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-medium text-white/70">
            API key <span className="font-normal text-white/35">(optional)</span>
          </span>
          <KeyField
            value={customKey}
            visible={customKeyVisible}
            placeholder={CUSTOM_PROVIDER.placeholder}
            onChange={onCustomKey}
            onToggle={onToggleCustomKey}
          />
        </label>
      </div>
    );
  }

  const meta = getProviderMeta(provider);
  return (
    <div>
      <StepHeading
        eyebrow="03 · Connect"
        title={`Add your ${meta.shortLabel} key.`}
        body="The key stays in extension storage on this device."
      />
      <label className="mt-8 flex flex-col gap-2">
        <span className="flex items-center justify-between gap-3 text-sm font-medium text-white/70">
          API key
          {meta.docsUrl ? (
            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#00ff00] hover:text-white"
            >
              Get a key
            </a>
          ) : null}
        </span>
        <KeyField
          value={apiKey}
          visible={keyVisible}
          placeholder={meta.placeholder}
          onChange={onKey}
          onToggle={onToggleKey}
        />
      </label>
    </div>
  );
};

const BrowserAiConnect = ({
  status,
  downloading,
  progress,
  error,
  onDownload,
  onChooseOther,
}: {
  status: BrowserAIStatus | null;
  downloading: boolean;
  progress: number;
  error: string | null;
  onDownload: () => void;
  onChooseOther: () => void;
}) => {
  const percent = Math.round(progress * 100);
  const label = getBrowserAIModelLabel();

  return (
    <div>
      <StepHeading
        eyebrow="03 · Connect"
        title="Use the model in this browser."
        body="Install the built-in model if your browser has not already done so."
      />
      <div className="mt-8 rounded-2xl border border-white/12 bg-white/6 px-5 py-5 backdrop-blur-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold">Browser AI</p>
            <p className="mt-1 text-sm text-white/45">
              {status === "unsupported" || status === "unavailable"
                ? "This device cannot run the built-in model right now."
                : `Detected model: ${label}`}
            </p>
          </div>
          <span className="rounded-full border border-[#00ff00]/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#00ff00]">
            {status === null ? "Checking" : BROWSER_AI_STATUS_LABELS[status]}
          </span>
        </div>

        {status === "unsupported" ? (
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            This browser does not support the built-in Prompt API. Chrome with Gemini Nano, Edge
            with Phi Mini, or another supported browser can. Pick a different provider to continue.
          </p>
        ) : null}
        {status === "unavailable" ? (
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            Browser AI is supported, but the on-device model is unavailable. Check storage and
            system requirements, or pick another provider.
          </p>
        ) : null}
        {status === "available" ? (
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            {label} is ready. Use it as much as you want. It is free and stays on this machine.
          </p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}

        {status === "downloadable" || status === "downloading" || downloading ? (
          <button
            type="button"
            className={`${pillSecondary} mt-5`}
            onClick={onDownload}
            disabled={downloading}
          >
            {downloading ? "Downloading…" : "Download model"}
          </button>
        ) : null}

        {downloading || status === "downloading" ? (
          <div className="mt-4">
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Model download progress"
              className="h-1.5 overflow-hidden rounded-full bg-white/10"
            >
              <div className="h-full rounded-full bg-[#00ff00]" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 font-mono text-[11px] text-white/40">{percent}% complete</p>
          </div>
        ) : null}

        {status === "unsupported" || status === "unavailable" ? (
          <button type="button" className={`${pillSecondary} mt-5`} onClick={onChooseOther}>
            Choose another provider
          </button>
        ) : null}
      </div>
    </div>
  );
};

const ModelStep = ({
  provider,
  model,
  onModel,
  customModel,
  onCustomModel,
}: {
  provider: ProviderId;
  model: string;
  onModel: (value: string) => void;
  customModel: string;
  onCustomModel: (value: string) => void;
}) => {
  if (provider === "browser-ai") {
    return (
      <div>
        <StepHeading
          eyebrow="04 · Model"
          title={getBrowserAIModelLabel()}
          body="Setup will continue with this model."
        />
      </div>
    );
  }

  if (provider === "custom") {
    return (
      <div>
        <StepHeading
          eyebrow="04 · Model"
          title="Name the model."
          body="This is the model id your server expects, such as llama3.1."
        />
        <label className="mt-8 flex flex-col gap-2">
          <span className="text-sm font-medium text-white/70">Model ID</span>
          <input
            className={`${fieldClass} font-mono`}
            type="text"
            placeholder="llama3.1"
            value={customModel}
            onChange={(event) => onCustomModel(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>
    );
  }

  const models = PROVIDER_MODELS[provider];
  return (
    <div>
      <StepHeading
        eyebrow="04 · Model"
        title="Pick the model."
        body="Waffy will use this model for all stages. You can change it later in settings."
      />
      <div
        className="mt-8 flex max-h-[min(24rem,52vh)] flex-col gap-2 overflow-y-auto pr-1"
        role="listbox"
        aria-label="Model"
      >
        {models.map((id) => {
          const selected = model === id;
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onModel(id)}
              className={`rounded-xl border px-4 py-3 text-left font-mono text-sm transition-colors ${selected
                ? "border-[#00ff00] bg-[#00ff00]/15 text-white"
                : "border-white/10 bg-white/4 text-white/70 hover:border-white/25 hover:text-white"
                }`}
            >
              {id}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FinishStep = ({
  provider,
  model,
  flags,
  onFlag,
}: {
  provider: ProviderId;
  model: string;
  flags: typeof DEFAULT_FEATURES;
  onFlag: (key: keyof typeof DEFAULT_FEATURES, value: boolean) => void;
}) => {
  const meta = getProviderMeta(provider);
  const modelLabel = provider === "browser-ai" ? getBrowserAIModelLabel() : model;

  return (
    <div>
      <StepHeading
        eyebrow="05 · Finish"
        title="Turn on what you need."
        body="Pick the features you want Waffy to use. You can change them anytime in settings."
      />
      <div className="mt-8 flex flex-col divide-y divide-white/10 rounded-2xl border border-white/12 bg-white/6">
        {FEATURE_TOGGLES.map((toggle) => (
          <label
            key={toggle.key}
            className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4"
          >
            <span>
              <span className="block text-sm font-bold">{toggle.label}</span>
              <span className="mt-1 block text-sm leading-snug text-white/45">
                {toggle.description}
              </span>
            </span>
            <Switch
              checked={flags[toggle.key]}
              onCheckedChange={(checked) => onFlag(toggle.key, checked)}
              className="data-checked:bg-[#00ff00]"
            />
          </label>
        ))}
      </div>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[#00ff00]">
        {meta.label} · {modelLabel}
      </p>
    </div>
  );
};

const Keycap = ({ children }: { children: React.ReactNode }) => (
  <kbd className="mx-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-white/15 bg-white/8 px-1.5 align-middle font-mono text-[11px] font-semibold text-white">
    {children}
  </kbd>
);

const Shortcut = ({ keys }: { keys: string[] }) => (
  <span className="inline-flex items-center gap-1 align-middle">
    {keys.map((key, index) => (
      <React.Fragment key={`${key}-${index}`}>
        {index > 0 ? <span className="text-xs text-white/30">+</span> : null}
        <Keycap>{key}</Keycap>
      </React.Fragment>
    ))}
  </span>
);

const DoneStep = () => (
  <div className="flex flex-1 flex-col justify-center">
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-[#00ff00]">
      You’re set
    </p>
    <h2 className="mt-4 text-[clamp(2.75rem,6vw,4.5rem)] font-bold leading-[0.9] tracking-[-0.06em]">
      SETUP IS
      <br />
      <span className="bg-linear-to-tr from-[#00ff00] to-white bg-clip-text text-transparent">
        COMPLETE.
      </span>
    </h2>
    <ul className="mt-5 max-w-md list-disc space-y-2.5 pl-5 text-base leading-relaxed text-white/55 marker:text-[#00ff00]">
      <li>Pin the Waffy extension to the toolbar.</li>
      <li>
        Open the side panel with <Shortcut keys={["Ctrl", "I"]} /> or <Shortcut keys={["⌘", "I"]} />
        .
      </li>
      <li>You can change models anytime in settings.</li>
    </ul>
    <div className="mt-8 flex flex-wrap gap-3">
      <button type="button" className={pillSecondary} onClick={() => window.close()}>
        Close
      </button>
      <button
        type="button"
        className={pillPrimary}
        onClick={() => {
          void Browser.windows
            .getCurrent()
            .then((current) => {
              if (current.id === undefined) return;
              return chrome.sidePanel.open({ windowId: current.id });
            })
            .catch((error) => {
              console.error("Failed to open side panel:", error);
            });
        }}
      >
        Open Waffy
      </button>
    </div>
  </div>
);

const StepHeading = ({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) => (
  <div>
    <p className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-[#00ff00] lg:mt-0">
      {eyebrow}
    </p>
    <h2 className="mt-3 text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[0.95] tracking-[-0.05em]">
      {title}
    </h2>
    <p className="mt-4 text-base leading-relaxed text-white/50">{body}</p>
  </div>
);

const KeyField = ({
  value,
  visible,
  placeholder,
  onChange,
  onToggle,
}: {
  value: string;
  visible: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) => (
  <div className="relative">
    <input
      className={`${fieldClass} pr-12 font-mono`}
      type={visible ? "text" : "password"}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
      spellCheck={false}
    />
    <button
      type="button"
      className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
      onClick={onToggle}
      aria-label={visible ? "Hide API key" : "Show API key"}
    >
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Onboarding />
  </React.StrictMode>
);
