// DM Assistant - content_script.js (Refactored v10 - Manual Selection)

console.log("DM Assistant: Content script loaded.");

// --- HTML Cleaning Logic ---
function getCleanedHtml(element) {
    // (Implementation is the same as before)
    const clonedElement = element.cloneNode(true);
    const selectorsToRemove = ['script', 'style', 'svg', 'iframe', 'noscript', 'link', 'meta', 'button', 'input'];
    selectorsToRemove.forEach(selector => clonedElement.querySelectorAll(selector).forEach(el => el.remove()));
    const allowedAttributes = ['alt', 'title', 'aria-label', 'datetime', 'href', 'src'];
    const allElements = clonedElement.querySelectorAll('*');
    allElements.forEach(el => {
        const attrsToRemove = [];
        for (const attr of el.attributes) {
            if (!allowedAttributes.includes(attr.name.toLowerCase())) attrsToRemove.push(attr.name);
        }
        attrsToRemove.forEach(attrName => el.removeAttribute(attrName));
    });
    for (let i = 0; i < 5; i++) {
        clonedElement.querySelectorAll('div').forEach(div => {
            if (div.children.length === 1 && div.children[0].tagName === 'DIV' && !Array.from(div.childNodes).some(node => node.nodeType === 3 && node.textContent.trim() !== '')) {
                div.parentNode.replaceChild(div.children[0], div);
            }
        });
    }
    let finalHtml = clonedElement.innerHTML;
    finalHtml = finalHtml.split('\n').map(line => line.trim()).join('\n').replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><');
    return finalHtml;
}

// --- Site-Specific Adapters & Dispatcher ---
function findConversationHtmlGeneric(startElement) {
    // (Implementation is the same as before)
    let potentialContainer = startElement;
    for (let i = 0; i < 15; i++) {
        if (!potentialContainer) break;
        const style = window.getComputedStyle(potentialContainer);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && potentialContainer.clientHeight > 200) {
            return getCleanedHtml(potentialContainer);
        }
        potentialContainer = potentialContainer.parentElement;
    }
    return null;
}

function findConversationHtmlTwitter() {
    // (Implementation is the same as before)
    const conversationContainer = document.querySelector('[data-testid="conversation"]');
    if (conversationContainer) return getCleanedHtml(conversationContainer);
    return null;
}

function getConversationHtmlForPage(activeElement) {
    // (Implementation is the same as before)
    const hostname = window.location.hostname;
    let html = null;
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        html = findConversationHtmlTwitter();
    }
    if (!html) {
        html = findConversationHtmlGeneric(activeElement);
    }
    return html;
}

// --- Text Insertion Logic ---
function insertTextIntoInput(inputElement, text) {
    // (Implementation is the same as before)
    if (!inputElement) return;
    if (inputElement.tagName.toLowerCase() === 'textarea') {
        inputElement.value = text;
    } else {
        inputElement.innerText = text;
    }
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}


// --- NEW: Manual Selection Mode Logic ---
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
    highlighter.style.pointerEvents = 'none'; // IMPORTANT
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
    console.log("Manual selection made:", selectedElement);
    const html = getCleanedHtml(selectedElement);

    // Save the selected HTML to session storage and notify the user.
    chrome.storage.session.set({ 'manualSelectionHtml': html }, () => {
        alert("会話エリアが選択されました。もう一度拡張機能アイコンをクリックして、返信を生成してください。");
    });

    // Clean up
    exitSelectionMode();
};

function enterSelectionMode() {
    if (selectionModeActive) return;
    selectionModeActive = true;
    console.log("Entering manual selection mode.");
    createHighlighter();
    document.addEventListener('mouseover', mouseoverHandler);
    document.addEventListener('click', clickHandler, true); // Use capture phase
}

function exitSelectionMode() {
    if (!selectionModeActive) return;
    selectionModeActive = false;
    console.log("Exiting manual selection mode.");
    document.removeEventListener('mouseover', mouseoverHandler);
    document.removeEventListener('click', clickHandler, true);
    if (highlighter) {
        highlighter.remove();
        highlighter = null;
    }
}


// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);

    if (request.type === 'getConversationHtml') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName.toLowerCase() === 'textarea' || activeElement.isContentEditable)) {
            const html = getConversationHtmlForPage(activeElement);
            sendResponse({ html: html });
        } else {
            sendResponse({ html: null, error: "No active text input field found on the page." });
        }
        return true;
    }

    if (request.type === 'insertText') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName.toLowerCase() === 'textarea' || activeElement.isContentEditable)) {
            insertTextIntoInput(activeElement, request.text);
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
