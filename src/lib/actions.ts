export const simplifyDOM = (element: Node) => {
    let uniqueIdCounter = 1;
    const selectorMap = new Map<number, string>();
    const fragment = document.createDocumentFragment();

    function cssSelector(el: Element): string {
        const path: string[] = [];
        while (el.parentElement) {
            const index = Array.from(el.parentElement.children).indexOf(el) + 1;
            const selector = `${el.tagName.toLowerCase()}:nth-child(${index})`;
            path.unshift(selector);
            el = el.parentElement;
        }
        return path.join(' > ');
    }

    function processNode(node: Node, parentContainer: Node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            parentContainer.appendChild(document.createTextNode(node.textContent + ' '));
            return;
        }
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;

        const unwantedTags = [
            // SVG Tags
            'SVG',
            'CIRCLE',
            'ELLIPSE',
            'RECT',
            'LINE',
            'POLYGON',
            'POLYLINE',
            'PATH',
            'LINEARGRADIENT',
            'RADIALGRADIENT',
            'DEFS',
            'MASK',
            'CLIPPATH',
            'FILTER',
            'PATTERN',
            'USE',
            'SYMBOL',

            // Media Tags
            'IMG',
            'OBJECT',
            'EMBED',
            'CANVAS',
            'PICTURE',
            'VIDEO',
            'AUDIO',
            'SOURCE',
            'IFRAME',

            // Other Tags
            'SCRIPT',
            'STYLE',
            'NOSCRIPT',
            'META',
            'LINK',
            'IFRAME'
        ];
        if (unwantedTags.includes(node.tagName)) return;

        const isVisible =
            window.getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().height > 0;
        const children = Array.from(node.childNodes);
        const isInteractive =
            node.hasAttribute('role') ||
            node.hasAttribute('aria-label') ||
            node.hasAttribute('name') ||
            ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName);
        const includeNode = isVisible || isInteractive || children.length > 0;
        if (!includeNode) return;

        const simplifiedElement = document.createElement(node.tagName);
        simplifiedElement.textContent = '';
        const uniqueId = uniqueIdCounter++;
        simplifiedElement.setAttribute('data-id', String(uniqueId));
        const selector = cssSelector(node);
        selectorMap.set(uniqueId, selector);
        const allowedAttributes = ['aria-label', 'role', 'type', 'placeholder', 'name', 'value', 'title'];
        for (const attr of allowedAttributes) {
            if (node.hasAttribute(attr)) {
                simplifiedElement.setAttribute(attr, node.getAttribute(attr) as string);
            }
        }
        parentContainer.appendChild(simplifiedElement);
        children.forEach((child) => processNode(child, simplifiedElement));
    }
    processNode(element, fragment);
    return { dom: fragment, selectorMap };
}

export const getSelector = (id: number, selectorMap: Map<number, string>): string | null => {
    return selectorMap.get(id) || null;
}
