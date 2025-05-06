let annotatedDom: { id: string, x: number, y: number, width: number, height: number, type: string, content: string, interactivity: boolean }[] = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_TAB_ID') {
        sendResponse({ tabId: sender?.tab?.id });
    }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.commands.onCommand.addListener((command) => {
    if (command === "open_side_panel") {
      chrome.windows.getCurrent(w => {
        if (w.id) chrome.sidePanel.open({ windowId: w.id });
      });
    }
  });

  
export { };