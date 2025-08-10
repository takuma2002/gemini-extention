// Gemini DM Assistant - content_script.js (Refactored)

console.log("Gemini DM Assistant: Content script loaded and listening for popup commands.");

/**
 * Heuristic to find the conversation container relative to a given element.
 * @param {HTMLElement} startElement - The element to start searching from (e.g., the active input).
 * @returns {string|null} The innerHTML of the container, or null if not found.
 */
function findConversationHtml(startElement) {
    if (!startElement) {
        console.error("No start element provided to find conversation.");
        return null;
    }

    let potentialContainer = startElement;
    for (let i = 0; i < 15; i++) { // Search up to 15 levels up the DOM tree
        if (!potentialContainer) break;

        const style = window.getComputedStyle(potentialContainer);
        // Look for a scrollable element with a reasonable height.
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && potentialContainer.clientHeight > 200) {
            console.log("Found conversation container:", potentialContainer);
            return potentialContainer.innerHTML;
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
    // Dispatch an 'input' event to notify the host page's framework (e.g., React).
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    console.log("Text inserted into:", inputElement);
}


// Listen for messages from the popup or other parts of the extension.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);

    if (request.type === 'getConversationHtml') {
        // Find the element that has focus on the page.
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName.toLowerCase() === 'textarea' || activeElement.isContentEditable)) {
            const html = findConversationHtml(activeElement);
            sendResponse({ html: html });
        } else {
            sendResponse({ html: null, error: "No active text input field found on the page. Please click on the message input box first." });
        }
        // Return true to indicate we will respond asynchronously (although it's quick).
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
