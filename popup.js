document.addEventListener('DOMContentLoaded', async () => {
    // Get references to all UI elements from popup.html
    const styleSelect = document.getElementById('reply-style');
    const instructionsInput = document.getElementById('instructions');
    const generateBtn = document.getElementById('generate-btn');
    const resultWrapper = document.getElementById('result-wrapper');
    const resultDisplay = document.getElementById('result-display');
    const insertBtn = document.getElementById('insert-btn');
    const errorDisplay = document.getElementById('error-display');

    // --- Inject content script on popup open for robust communication ---
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content_script.js'],
            });
        } else {
            throw new Error("アクティブなタブが見つかりません。");
        }
    } catch (e) {
        console.error("Failed to inject content script:", e);
        errorDisplay.textContent = `このページには接続できません: ${e.message}`;
        generateBtn.disabled = true; // Disable functionality if connection fails
    }


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
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error("アクティブなタブが見つかりません。");

            // --- 2. Request conversation HTML from the (now guaranteed) content script ---
            const htmlResponse = await chrome.tabs.sendMessage(tab.id, { type: 'getConversationHtml' });

            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            if (htmlResponse.error) throw new Error(htmlResponse.error);
            if (!htmlResponse.html) throw new Error("ページから会話を取得できませんでした。入力欄をクリックしてから再度お試しください。");

            // --- 3. Get user inputs from the popup form ---
            const style = styleSelect.value;
            const instructions = instructionsInput.value;
            const lastSpeaker = document.querySelector('input[name="last-speaker"]:checked').value;

            // --- 4. Send all data to the background script for API call ---
            const replyResponse = await chrome.runtime.sendMessage({
                type: 'generateReply',
                html: htmlResponse.html,
                style: style,
                instructions: instructions,
                lastSpeaker: lastSpeaker
            });

            if (replyResponse.error) throw new Error(replyResponse.error.message);

            // --- 5. Success: Display the result in the popup ---
            resultDisplay.textContent = replyResponse.reply;
            resultWrapper.classList.remove('hidden');

        } catch (error) {
            console.error("Error during generation process:", error);
            errorDisplay.textContent = `エラー: ${error.message}`;
        } finally {
            // --- 6. Reset button state regardless of success or failure ---
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
            if (!tab) throw new Error("アクティブなタブが見つかりません。");

            // Send message to content script to insert the text
            await chrome.tabs.sendMessage(tab.id, { type: 'insertText', text: textToInsert });
            window.close(); // Close the popup after successful insertion
        } catch (error) {
            console.error("Error during insertion:", error);
            errorDisplay.textContent = `挿入エラー: ${error.message}`;
        }
    });
});
