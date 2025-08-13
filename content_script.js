// Gemini DM Assistant - content_script.js (Refactored v8 - Advanced Cleaning)

console.log("Gemini DM Assistant: Content script loaded and listening for popup commands.");

/**
 * Performs an advanced cleaning of the given HTML element to optimize for token count
 * while preserving essential content and structure.
 * @param {HTMLElement} element - The HTML element to clean.
 * @returns {string} The cleaned inner HTML string.
 */
function getCleanedHtml(element) {
    const clonedElement = element.cloneNode(true);

    // --- Pass 1: Remove unwanted tags entirely ---
    const selectorsToRemove = ['script', 'style', 'svg', 'iframe', 'noscript', 'link', 'meta', 'button', 'input'];
    selectorsToRemove.forEach(selector => {
        clonedElement.querySelectorAll(selector).forEach(el => el.remove());
    });

    // --- Pass 2: Filter attributes, keeping only meaningful ones ---
    const allowedAttributes = ['alt', 'title', 'aria-label', 'datetime', 'href', 'src'];
    const allElements = clonedElement.querySelectorAll('*');
    allElements.forEach(el => {
        const attrsToRemove = [];
        for (const attr of el.attributes) {
            if (!allowedAttributes.includes(attr.name.toLowerCase())) {
                attrsToRemove.push(attr.name);
            }
        }
        attrsToRemove.forEach(attrName => el.removeAttribute(attrName));
    });

    // --- Pass 3: Simplify redundant nested structures ---
    // This is a complex task. A simple heuristic: unwrap divs that only contain another div.
    // We'll run this multiple times to collapse deeply nested wrappers.
    for (let i = 0; i < 5; i++) { // Run 5 passes to be safe
        clonedElement.querySelectorAll('div').forEach(div => {
            // Check if it has exactly one child element which is also a div, and no text nodes.
            if (div.children.length === 1 && div.children[0].tagName === 'DIV' && !Array.from(div.childNodes).some(node => node.nodeType === 3 && node.textContent.trim() !== '')) {
                // Replace the parent div with its child
                div.parentNode.replaceChild(div.children[0], div);
            }
        });
    }

    // --- Pass 4: Collapse whitespace ---
    // Use the final HTML string and replace multiple whitespace characters with a single space.
    // Also trim leading/trailing whitespace from each line.
    let finalHtml = clonedElement.innerHTML;
    finalHtml = finalHtml.split('\n').map(line => line.trim()).join('\n');
    finalHtml = finalHtml.replace(/\s{2,}/g, ' '); // Collapse spaces
    finalHtml = finalHtml.replace(/>\s+</g, '><'); // Remove space between tags

    return finalHtml;
}


/**
 * Heuristic to find the conversation container relative to a given element.
 * @param {HTMLElement} startElement - The element to start searching from (e.g., the active input).
 * @returns {string|null} The cleaned innerHTML of the container, or null if not found.
 */
function findConversationHtml(startElement) {
    if (!startElement) {
        console.error("No start element provided to find conversation.");
        return null;
    }

    let potentialContainer = startElement;
    for (let i = 0; i < 15; i++) {
        if (!potentialContainer) break;

        const style = window.getComputedStyle(potentialContainer);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && potentialContainer.clientHeight > 200) {
            console.log("Found potential conversation container:", potentialContainer);
            return getCleanedHtml(potentialContainer); // Use the advanced cleaner
        }
        potentialContainer = potentialContainer.parentElement;
    }
    console.error("Could not find conversation container via heuristic.");
    return null;
}

/**
 * Inserts text into the specified input element.
 * @param {HTMLElement} inputElement - The <textarea> or contenteditable <div>.
 * @param {string} text - The text to insert.
 */
function insertTextIntoInput(inputElement, text) {
    if (!inputElement) {
        console.error("No input element found to insert text.");
        return;
    }
    if (inputElement.tagName.toLowerCase() === 'textarea') {
        inputElement.value = text;
    } else {
        inputElement.innerText = text;
    }
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    console.log("Text inserted into:", inputElement);
}


// Listen for messages from the popup or other parts of the extension.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);

    if (request.type === 'getConversationHtml') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName.toLowerCase() === 'textarea' || activeElement.isContentEditable)) {
            const html = findConversationHtml(activeElement);
            sendResponse({ html: html });
        } else {
            sendResponse({ html: null, error: "No active text input field found on the page. Please click on the message input box first." });
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
});
