import sanitizeHtml from "sanitize-html";

export const sanitize = (data: string) => {
  const sanitizedHtml = sanitizeHtml(data, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "button",
      "form",
      "img",
      "input",
      "select",
      "textarea"
    ]),
    allowedAttributes: false,
    parseStyleAttributes: false
  });
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizedHtml, "text/html");
  return doc;
};
