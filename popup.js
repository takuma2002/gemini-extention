document.addEventListener('DOMContentLoaded', () => {
    // Get references to all UI elements from popup.html
    const styleSelect = document.getElementById('reply-style');
    const instructionsInput = document.getElementById('instructions');
    const generateBtn = document.getElementById('generate-btn');
    const resultWrapper = document.getElementById('result-wrapper');
    const resultDisplay = document.getElementById('result-display');
    const insertBtn = document.getElementById('insert-btn');
    const errorDisplay = document.getElementById('error-display');

    /**
     * Handles the main logic when the 'Generate' button is clicked.
     */
    generateBtn.addEventListener('click', async () => {
        // --- 1. Set UI to loading state ---
        errorDisplay.textContent = '';
        resultWrapper.classList.add('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';

        try {
            // --- 2. Get the active tab to communicate with its content script ---
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error("アクティブなタブが見つかりません。");
            }

            // --- 3. Request conversation HTML from the content script ---
            const htmlResponse = await chrome.tabs.sendMessage(tab.id, { type: 'getConversationHtml' });

            // Handle errors from content script (e.g., no active input)
            if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
            }
            if (htmlResponse.error || !htmlResponse.html) {
                throw new Error(htmlResponse.error || "ページから会話を取得できませんでした。入力欄をクリックしてから再度お試しください。");
            }

            // --- 4. Get user inputs from the popup form ---
            const style = styleSelect.value;
            const instructions = instructionsInput.value;
            const lastSpeaker = document.querySelector('input[name="last-speaker"]:checked').value;

            // --- 5. Send all data to the background script for API call ---
            const replyResponse = await chrome.runtime.sendMessage({
                type: 'generateReply',
                html: htmlResponse.html,
                style: style,
                instructions: instructions,
                lastSpeaker: lastSpeaker
            });

            if (replyResponse.error) {
                throw new Error(replyResponse.error.message);
            }

            // --- 6. Success: Display the result in the popup ---
            resultDisplay.textContent = replyResponse.reply;
            resultWrapper.classList.remove('hidden');

        } catch (error) {
            console.error("Error during generation process:", error);
            errorDisplay.textContent = `エラー: ${error.message}`;
        } finally {
            // --- 7. Reset button state regardless of success or failure ---
            generateBtn.disabled = false;
            generateBtn.textContent = '返信を生成';
        }
    });

    /**
     * Handles the logic when the 'Insert' button is clicked.
     */
    insertBtn.addEventListener('click', async () => {
        const textToInsert = resultDisplay.textContent;
        if (!textToInsert) return;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error("アクティブなタブが見つかりません。");
            }

            // Send message to content script to insert the text
            await chrome.tabs.sendMessage(tab.id, { type: 'insertText', text: textToInsert });
            window.close(); // Close the popup after successful insertion
        } catch (error) {
            console.error("Error during insertion:", error);
            errorDisplay.textContent = `挿入エラー: ${error.message}`;
        }
    });
});
