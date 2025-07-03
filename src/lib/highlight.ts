export const highlight = (coords: any[]) => {
    coords.forEach((coord: Record<string, any>) => {
        // const { x, y, width, height, type } = coord;
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || !tabs[0]?.id) {
                return;
            }
            await chrome.debugger.sendCommand({ tabId: tabs[0].id }, "Overlay.highlightRect", {
                x: Math.floor(coord.x / 2),
                y: Math.floor(coord.y / 2) ,
                width: Math.floor(coord.width / 2),
                height: Math.floor(coord.height / 2),
                // color: "rgba(255, 0, 0, 0.5)",
                color: {
                    r: 255,
                    g: 0,
                    b: 0,
                    a: 0.5
                },
            });
        });
    });
}