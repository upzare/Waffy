import Browser from "webextension-polyfill";

export const initClient = async () => {
    const localStorage = await Browser.storage.local.get();
    if (!localStorage.client) {
        Browser.storage.local.set({
            client: JSON.stringify({
                client_id: crypto.randomUUID(),
                package: chrome.runtime.getManifest().version_name,
                version: chrome.runtime.getManifest().version,
                os: navigator.platform,
                browser: navigator.userAgent,
            })
        });
    }
}

export const initSettings = async () => {
    const localStorage = await Browser.storage.local.get();
    if (!localStorage.data) {
        Browser.storage.local.set({
            data: JSON.stringify({
                waffyAPI: "",
                theme: "system",
                enableHistory: true,
                enableKeyboardShortcuts: true,
                enableNotifications: true,
                account: {
                    account_id: "6b674948-3fd0-48c8-af43-56b9a204d965",
                },
            })
        });
    }
}

export const getLocalStorage = async () => {
    const localStorage = await Browser.storage.local.get();
    localStorage.client = JSON.parse(localStorage.client as string);
    localStorage.data = JSON.parse(localStorage.data as string);
    return localStorage;
}