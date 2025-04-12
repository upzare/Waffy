let annotatedDom: { id: string, x: number, y: number, width: number, height: number, type: string, content: string, interactivity: boolean }[] = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_TAB_ID') {
        sendResponse({ tabId: sender?.tab?.id });
    }
    if (request.action === 'SET_DOM') {
        annotatedDom = request.props;
    }
    if (request.action === 'GET_DOM') {
        sendResponse(annotatedDom);
    }
});

export { };