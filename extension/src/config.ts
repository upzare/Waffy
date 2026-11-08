import Browser from "webextension-polyfill";

const assetUrl = (path: string) => {
  try {
    return Browser.runtime.getURL(path);
  } catch {
    return "";
  }
};

export const LOGO_URL = assetUrl("assets/logo.svg");
export const CURSOR_URL = assetUrl("shared/cursor.png");

export const WEBSITE_URL = "https://waffy.io";
export const TERMS_URL = "https://waffy.io/terms";
export const PRIVACY_URL = "https://waffy.io/privacy";
export const GITHUB_URL = "https://github.com/upzare/Waffy";
export const GITHUB_ISSUES_URL = "https://github.com/upzare/Waffy/issues/new";
export const WEBSTORE_URL = "https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm";
export const DISCORD_URL = "https://dsc.gg/waffy";
export const SUPPORT_EMAIL = "support@waffy.io";
export const X_VERSION_URL = "https://x-version.waffy.io";
export const FOUNDER_URL = "https://x.com/aravindmanoj_";
