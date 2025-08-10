// Gemini DM Assistant - content_script.js

/**
 * Finds a suitable text input area on the page.
 * This is a heuristic and may need to be improved.
 * @returns {HTMLElement|null} The found text area or input element.
 */
function findTextInputArea() {
    // Look for a <textarea> first.
    const textarea = document.querySelector('textarea');
    if (textarea) return textarea;

    // Fallback to looking for a div with role="textbox".
    const textbox = document.querySelector('div[role="textbox"]');
    if (textbox) return textbox;

    return null;
}

/**
 * When the generate button is clicked, this function finds the conversation
 * container, extracts its HTML, and sends it to the background script.
 */
function onGenerateButtonClick() {
    console.log('✨ Generate button clicked!');
    const button = document.getElementById('gemini-generate-button');
    const inputArea = findTextInputArea();
    if (!inputArea) {
        alert("テキスト入力エリアが見つかりませんでした。");
        return;
    }

    // Heuristic to find the conversation container
    let potentialContainer = inputArea;
    let containerFound = false;

    for (let i = 0; i < 15; i++) {
        if (!potentialContainer) break;

        const style = window.getComputedStyle(potentialContainer);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && potentialContainer.clientHeight > 200) {
            const conversationHtml = potentialContainer.innerHTML;
            console.log("Found potential conversation container. Sending HTML to background script.");

            // --- UI UPDATE: Show loading state ---
            const originalButtonText = button.textContent;
            button.textContent = '生成中...';
            button.disabled = true;

            // Send the HTML to the background script for processing
            chrome.runtime.sendMessage({
                type: 'generateReply',
                html: conversationHtml
            }, (response) => {
                // --- UI UPDATE: Restore button state ---
                button.textContent = originalButtonText;
                button.disabled = false;

                // --- RESPONSE HANDLING ---
                if (chrome.runtime.lastError) {
                    console.error('Error receiving response:', chrome.runtime.lastError.message);
                    alert(`拡張機能との通信にエラーが発生しました: ${chrome.runtime.lastError.message}`);
                    return;
                }

                if (response.error) {
                    console.error('Error from background script:', response.error.message);
                    alert(`返信の生成に失敗しました: ${response.error.message}`);
                    return;
                }

                if (response.reply) {
                    console.log('Received reply:', response.reply);
                    const currentInputArea = findTextInputArea();
                    if (currentInputArea) {
                        // Set the value for <textarea> or innerText for contenteditable <div>
                        if (currentInputArea.tagName.toLowerCase() === 'textarea') {
                            currentInputArea.value = response.reply;
                        } else {
                            currentInputArea.innerText = response.reply;
                        }
                        // Dispatch an 'input' event to let the host page's framework (e.g., React) know about the change.
                        currentInputArea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                        console.log('Reply inserted into text area.');
                    } else {
                        alert("生成された返信:\n\n" + response.reply);
                    }
                }
            });

            containerFound = true;
            break;
        }
        potentialContainer = potentialContainer.parentElement;
    }

    if (!containerFound && !button.disabled) { // Check disabled flag to avoid double alert
        console.error("Gemini DM Assistant: Could not find conversation container.");
        alert("会話履歴のコンテナを見つけることができませんでした。");
    }
}


/**
 * Adds the "Generate" button to the UI near the target element.
 * @param {HTMLElement} targetElement The element to anchor the button to.
 */
function addGenerateButton(targetElement) {
    const buttonId = 'gemini-generate-button';
    if (document.getElementById(buttonId)) {
        return;
    }

    const button = document.createElement('button');
    button.id = buttonId;
    button.textContent = '✨ 生成';

    // Styling
    button.style.marginLeft = '10px';
    button.style.padding = '6px 12px';
    button.style.border = '1px solid #ccc';
    button.style.borderRadius = '8px';
    button.style.cursor = 'pointer';
    button.style.backgroundColor = '#f5f5f5';
    button.style.fontSize = '14px';
    button.style.fontWeight = 'bold';
    button.style.color = '#333';
    button.style.zIndex = '9999';

    button.onclick = onGenerateButtonClick;

    const parentContainer = targetElement.parentElement;
    if (parentContainer) {
        if (window.getComputedStyle(parentContainer).display !== 'flex') {
             parentContainer.style.display = 'flex';
             parentContainer.style.alignItems = 'center';
        }
        targetElement.insertAdjacentElement('afterend', button);
        console.log('Gemini DM Assistant: "Generate" button added to the page.');
    }
}

// Use a MutationObserver to add the button when the text area appears in a SPA.
const observer = new MutationObserver((mutations, obs) => {
    const inputArea = findTextInputArea();
    if (inputArea) {
        addGenerateButton(inputArea);
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("Gemini DM Assistant: Content script loaded and observing DOM changes.");
