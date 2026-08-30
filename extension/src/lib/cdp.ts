const PROTOCOL_VERSION = "1.3";

/** Thin wrappers over chrome.debugger. Each feature builds its own attach/detach on top,
 *  since they need different domains and teardown. */

export const isAttached = (tabId: number): Promise<boolean> =>
  new Promise((resolve) => {
    chrome.debugger.getTargets((targets) => {
      resolve(targets.some((target) => target.tabId === tabId && target.attached));
    });
  });

export const sendCommand = (tabId: number, method: string, params?: { [key: string]: unknown }) =>
  chrome.debugger.sendCommand({ tabId }, method, params);

export const attachTab = async (tabId: number) => {
  if (await isAttached(tabId)) return;

  await new Promise<void>((resolve, reject) => {
    chrome.debugger.attach({ tabId }, PROTOCOL_VERSION, () => {
      const error = chrome.runtime.lastError?.message;
      // A parallel attach may have won the race, which is fine.
      if (error && !/already attached/i.test(error)) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
};

export const detachTab = (tabId: number) =>
  new Promise<void>((resolve) => {
    chrome.debugger.detach({ tabId }, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });

export const enableDomains = async (tabId: number, domains: string[]) => {
  for (const domain of domains) await sendCommand(tabId, `${domain}.enable`);
};

export const disableDomains = async (tabId: number, domains: string[]) => {
  for (const domain of domains) {
    try {
      await sendCommand(tabId, `${domain}.disable`);
    } catch (_) { }
  }
};
