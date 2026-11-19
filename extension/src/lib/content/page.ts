const getPageSnapshot = () => ({
  url: window.location.href,
  title: document.title,
  html: document.documentElement.outerHTML,
});

export const getDevicePixelRatio = () =>
  Promise.resolve({ status: "success", value: window.devicePixelRatio });

export const getPageContent = () => Promise.resolve({ status: "success", ...getPageSnapshot() });
