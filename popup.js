document.addEventListener('DOMContentLoaded', async () => {
    // Get references to all UI elements from popup.html
    const styleSelect = document.getElementById('reply-style');
    const instructionsInput = document.getElementById('instructions');
    const generateBtn = document.getElementById('generate-btn');
    const resultWrapper = document.getElementById('result-wrapper');
    const resultDisplay = document.getElementById('result-display');
    const insertBtn = document.getElementById('insert-btn');
    const errorDisplay = document.getElementById('error-display');
    const modelRadios = document.querySelectorAll('input[name="model"]');

    // --- Settings Persistence ---

    // Saves the currently selected model to local storage.
    const saveModelSelection = () => {
        const selectedModel = document.querySelector('input[name="model"]:checked').value;
        chrome.storage.local.set({ selectedModel: selectedModel });
        console.log('Model selection saved:', selectedModel);
    };

    // Restores the model selection from local storage.
    const restoreModelSelection = async () => {
        // Default to flash-lite if no value is stored.
        const { selectedModel } = await chrome.storage.local.get({ selectedModel: 'gemini-2.5-flash-lite' });
        const radioToSelect = document.querySelector(`input[name="model"][value="${selectedModel}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    };

    // Add event listeners to radio buttons to save the selection when it changes.
    modelRadios.forEach(radio => radio.addEventListener('change', saveModelSelection));

    // Restore saved settings when the popup loads.
    await restoreModelSelection();


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
        generateBtn.disabled = true;
    }


    /**
     * Handles the main logic when the 'Generate' button is clicked.
     */
    generateBtn.addEventListener('click', async () => {
        errorDisplay.textContent = '';
        resultWrapper.classList.add('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error("アクティブなタブが見つかりません。");

            const htmlResponse = await chrome.tabs.sendMessage(tab.id, { type: 'getConversationHtml' });

            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            if (htmlResponse.error) throw new Error(htmlResponse.error);
            if (!htmlResponse.html) throw new Error("ページから会話を取得できませんでした。入力欄をクリックしてから再度お試しください。");

            // Get all user inputs from the popup form, including the new model selection.
            const style = styleSelect.value;
            const instructions = instructionsInput.value;
            const lastSpeaker = document.querySelector('input[name="last-speaker"]:checked').value;
            const selectedModel = document.querySelector('input[name="model"]:checked').value;

            // Send all data to the background script.
            const replyResponse = await chrome.runtime.sendMessage({
                type: 'generateReply',
                html: htmlResponse.html,
                style: style,
                instructions: instructions,
                lastSpeaker: lastSpeaker,
                model: selectedModel // Pass the selected model
            });

            if (replyResponse.error) throw new Error(replyResponse.error.message);

            resultDisplay.textContent = replyResponse.reply;
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
