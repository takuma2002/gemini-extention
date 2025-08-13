// DM Assistant - content_script.js (Refactored v12 - Optimized)

console.log("DM Assistant: Content script loaded.");

// --- Optimized HTML Cleaning Logic ---
function getCleanedHtml(element) {
    const clonedElement = element.cloneNode(true);
    const selectorsToRemove = ['script', 'style', 'svg', 'iframe', 'noscript', 'link', 'meta', 'button', 'input'];
    const allowedAttributes = ['alt', 'title', 'aria-label', 'datetime', 'href', 'src'];

    const allElements = clonedElement.querySelectorAll('*');

    // --- Single Pass for Cleaning ---
    allElements.forEach(el => {
        // Pass 1: Remove unwanted tags
        if (selectorsToRemove.includes(el.tagName.toLowerCase())) {
            el.remove();
            return; // No need to process attributes if the element is removed
        }

        // Pass 2: Filter attributes
        const attrsToRemove = [];
        for (const attr of el.attributes) {
            if (!allowedAttributes.includes(attr.name.toLowerCase())) {
                attrsToRemove.push(attr.name);
            }
        }
        attrsToRemove.forEach(attrName => el.removeAttribute(attrName));
    });

    // --- Pass 3: Simplify redundant nested structures (unchanged) ---
    for (let i = 0; i < 5; i++) {
        clonedElement.querySelectorAll('div').forEach(div => {
            if (div.children.length === 1 && div.children[0].tagName === 'DIV' && !Array.from(div.childNodes).some(node => node.nodeType === 3 && node.textContent.trim() !== '')) {
                div.parentNode.replaceChild(div.children[0], div);
            }
        });
    }

    // --- Pass 4: Collapse whitespace (unchanged) ---
    let finalHtml = clonedElement.innerHTML;
    finalHtml = finalHtml.split('\n').map(line => line.trim()).join('\n').replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><');

    return finalHtml;
}

// --- Site-Specific Adapters & Dispatcher (unchanged) ---
function findConversationHtmlGeneric() {
    let bestCandidate = null;
    let maxContentLength = -1;
    document.querySelectorAll('div, main, section').forEach(el => {
        try {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.clientHeight > 200) {
                const textLength = el.textContent.length;
                if (textLength > maxContentLength) {
                    maxContentLength = textLength;
                    bestCandidate = el;
                }
            }
        } catch (e) { /* ignore elements that can't have computed styles */ }
    });
    if (bestCandidate) return getCleanedHtml(bestCandidate);
    return null;
}

function findConversationHtmlTwitter() {
    const conversationContainer = document.querySelector('[data-testid="conversation"]');
    if (conversationContainer) return getCleanedHtml(conversationContainer);
    return null;
}

function getConversationHtmlForPage() {
    const hostname = window.location.hostname;
    let html = null;
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        html = findConversationHtmlTwitter();
    }
    if (!html) {
        html = findConversationHtmlGeneric();
    }
    return html;
}

// --- Text Insertion & State Checking ---
function insertTextIntoInput(inputElement, text) {
    if (!inputElement) return;
    if (inputElement.tagName.toLowerCase() === 'textarea') {
        inputElement.value = text;
    } else {
        inputElement.innerText = text;
    }
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

function getActiveInputField() {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName.toLowerCase() === 'textarea' || activeElement.isContentEditable)) {
        return activeElement;
    }
    return null;
}

// --- Manual Selection Mode Logic ---
let selectionModeActive = false;
let highlighter = null;

function createHighlighter() {
    if (highlighter) return;
    highlighter = document.createElement('div');
    highlighter.style.position = 'absolute';
    highlighter.style.backgroundColor = 'rgba(42, 104, 255, 0.4)';
    highlighter.style.border = '2px solid rgba(42, 104, 255, 0.8)';
    highlighter.style.borderRadius = '4px';
    highlighter.style.zIndex = '99999';
    highlighter.style.pointerEvents = 'none';
    document.body.appendChild(highlighter);
}

const mouseoverHandler = (event) => {
    const rect = event.target.getBoundingClientRect();
    highlighter.style.left = `${rect.left + window.scrollX}px`;
    highlighter.style.top = `${rect.top + window.scrollY}px`;
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.height = `${rect.height}px`;
};

const clickHandler = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const selectedElement = event.target;
    const html = getCleanedHtml(selectedElement);
    chrome.storage.session.set({ 'manualSelectionHtml': html }, () => {
        alert("会話エリアが選択されました。もう一度拡張機能アイコンをクリックして、返信を生成してください。");
    });
    exitSelectionMode();
};

function enterSelectionMode() {
    if (selectionModeActive) return;
    selectionModeActive = true;
    createHighlighter();
    document.addEventListener('mouseover', mouseoverHandler);
    document.addEventListener('click', clickHandler, true);
}

function exitSelectionMode() {
    if (!selectionModeActive) return;
    selectionModeActive = false;
    document.removeEventListener('mouseover', mouseoverHandler);
    document.removeEventListener('click', clickHandler, true);
    if (highlighter) {
        highlighter.remove();
        highlighter = null;
    }
}

// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getConversationHtml') {
        const html = getConversationHtmlForPage();
        const inputField = getActiveInputField();
        sendResponse({ html: html, inputFieldFound: !!inputField });
        return true;
    }

    if (request.type === 'insertText') {
        const inputField = getActiveInputField();
        if (inputField) {
            insertTextIntoInput(inputField, request.text);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: "No active text input found to insert the reply." });
        }
        return true;
    }

    if (request.type === 'enterSelectionMode') {
        enterSelectionMode();
        sendResponse({ success: true });
        return true;
    }
});
