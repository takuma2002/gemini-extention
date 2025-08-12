document.addEventListener('DOMContentLoaded', async () => {
    // Get references to all UI elements from popup.html
    const styleSelect = document.getElementById('reply-style');
    const instructionsInput = document.getElementById('instructions');
    const generateBtn = document.getElementById('generate-btn');
    const resultWrapper = document.getElementById('result-wrapper');
    const resultDisplay = document.getElementById('result-display');
    const insertBtn = document.getElementById('insert-btn');
    const errorDisplay = document.getElementById('error-display');
    // New elements for logging
    const logDetails = document.getElementById('log-details');
    const logRequest = document.getElementById('log-request');
    const logResponse = document.getElementById('log-response');

    // --- Inject content script on popup open ---
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
        errorDisplay.textContent = `このページには接続できません: ${e.message}`;
        generateBtn.disabled = true;
    }

    /**
     * Handles the main logic when the 'Generate' button is clicked.
     */
    generateBtn.addEventListener('click', async () => {
        // --- 1. Reset UI state ---
        errorDisplay.textContent = '';
        resultWrapper.classList.add('hidden');
        logDetails.classList.add('hidden'); // Hide logs initially
        logRequest.textContent = '';
        logResponse.textContent = '';
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error("アクティブなタブが見つかりません。");

            const htmlResponse = await chrome.tabs.sendMessage(tab.id, { type: 'getConversationHtml' });

            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            if (htmlResponse.error) throw new Error(htmlResponse.error);
            if (!htmlResponse.html) throw new Error("ページから会話を取得できませんでした。入力欄をクリックしてから再度お試しください。");

            const style = styleSelect.value;
            const instructions = instructionsInput.value;
            const lastSpeaker = document.querySelector('input[name="last-speaker"]:checked').value;

            // --- 2. Send data to background and get response ---
            const responseFromBg = await chrome.runtime.sendMessage({
                type: 'generateReply',
                html: htmlResponse.html,
                style: style,
                instructions: instructions,
                lastSpeaker: lastSpeaker
            });

            // --- 3. Display logs regardless of success or failure ---
            if (responseFromBg.log) {
                logRequest.textContent = JSON.stringify(responseFromBg.log.request, null, 2);
                logResponse.textContent = JSON.stringify(responseFromBg.log.response, null, 2);
                logDetails.classList.remove('hidden');
            }

            // --- 4. Handle error or success ---
            if (responseFromBg.error) {
                throw new Error(responseFromBg.error.message);
            }

            resultDisplay.textContent = responseFromBg.reply;
            resultWrapper.classList.remove('hidden');

        } catch (error) {
            console.error("Error during generation process:", error);
            errorDisplay.textContent = `エラー: ${error.message}`;
        } finally {
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

            await chrome.tabs.sendMessage(tab.id, { type: 'insertText', text: textToInsert });
            window.close();
        } catch (error) {
            console.error("Error during insertion:", error);
            errorDisplay.textContent = `挿入エラー: ${error.message}`;
        }
    });
});
