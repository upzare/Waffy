import { PostHog } from "posthog-js/dist/module.no-external";
import { getAppSettings } from "./client";
import { LanguageModelUsage } from "ai";

const TOKEN = import.meta.env.POSTHOG_PROJECT_TOKEN;
const HOST = import.meta.env.POSTHOG_HOST;

const validate = async () => {
  const analytics = (await getAppSettings()).settings.analytics;
  return analytics && TOKEN ? true : false;
}

export const posthog = new PostHog();

let started = false;

export const initAnalytics = async () => {
  if (started) return;
  if (await validate()) {
    started = true;
    posthog.init(TOKEN!, {
      api_host: HOST,
      disable_external_dependency_loading: true,
      persistence: "localStorage",
      autocapture: false,
    });
  }
};

export const aiObservability = async (
  { modelId,
    provider,
    usage
  }: {
    modelId: string;
    provider: string;
    usage: LanguageModelUsage;
  }) => {
  if (!started) return;
  if (await validate()) {
    posthog.capture("$ai_generation", {
      "$ai_provider": provider,
      "$ai_model": modelId,
      "$ai_input_tokens": usage.inputTokens,
      "$ai_output_tokens": usage.outputTokens,
    })
  }
}