import { useEffect, useState } from "react";
import Browser from "webextension-polyfill";
import { getCurrentWindowTabs } from "@/helper";
import { toWindowPages, type WindowPage } from "../utils/page-mentions";

export function useWindowTabs(): WindowPage[] {
  const [pages, setPages] = useState<WindowPage[]>([]);

  useEffect(() => {
    const refresh = async () => {
      try {
        const tabs = await getCurrentWindowTabs();
        setPages(toWindowPages(tabs));
      } catch {
        setPages([]);
      }
    };

    refresh();
    Browser.tabs.onUpdated.addListener(refresh);
    Browser.tabs.onRemoved.addListener(refresh);
    Browser.tabs.onMoved.addListener(refresh);
    Browser.tabs.onActivated.addListener(refresh);
    Browser.windows.onFocusChanged.addListener(refresh);
    return () => {
      Browser.tabs.onUpdated.removeListener(refresh);
      Browser.tabs.onRemoved.removeListener(refresh);
      Browser.tabs.onMoved.removeListener(refresh);
      Browser.tabs.onActivated.removeListener(refresh);
      Browser.windows.onFocusChanged.removeListener(refresh);
    };
  }, []);

  return pages;
}
