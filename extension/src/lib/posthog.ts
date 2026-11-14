import { PostHog } from "posthog-js/dist/module.no-external";

export const posthog = new PostHog();

let started = false;

export const startAnalytics = () => {
  if (started) return;
  started = true;
  if (import.meta.env.POSTHOG_PROJECT_TOKEN)
    posthog.init(import.meta.env.POSTHOG_PROJECT_TOKEN, {
      api_host: import.meta.env.POSTHOG_HOST,
      disable_external_dependency_loading: true,
      persistence: "localStorage",
      autocapture: false,
    });
};
