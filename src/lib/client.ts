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
            settings: JSON.stringify({
                theme: "system",
                enableHistory: true,
                enableKeyboardShortcuts: true,
                enableNotifications: true,
            }),
            data: JSON.stringify({
                waffyAPI: "1234",
                signed: true,
                account: {
                    account_id: "c9c20661-a918-4ef5-b805-d7273ccb79f6",
                    email: "",
                    name: "",
                    phone_number: "",
                },
                subscription: {
                    plan: "",
                    created_at: 0,
                    expires_at: 0,
                    active: false,
                },
                credits: {
                    total_credits: 0,
                    used_credits: 0,
                    total_tokens: 0,
                    used_tokens: 0,
                },
            })
        });
    }
}

export const getLocalStorage = async () => {
    const localStorage = await Browser.storage.local.get();
    localStorage.client = JSON.parse(localStorage.client as string);
    localStorage.settings = JSON.parse(localStorage.settings as string);
    localStorage.data = JSON.parse(localStorage.data as string);
    return localStorage;
}