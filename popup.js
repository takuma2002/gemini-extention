document.addEventListener('DOMContentLoaded', async () => {
    // --- Get references to all UI elements ---
    const ui = {
        styleSelect: document.getElementById('reply-style'),
        instructionsInput: document.getElementById('instructions'),
        lastSpeakerRadios: document.querySelectorAll('input[name="last-speaker"]'),
        generateBtn: document.getElementById('generate-btn'),
        clearBtn: document.getElementById('clear-btn'),
        resultWrapper: document.getElementById('result-wrapper'),
        resultDisplay: document.getElementById('result-display'),
        insertBtn: document.getElementById('insert-btn'),
        errorDisplay: document.getElementById('error-display'),
        logDetails: document.getElementById('log-details'),
        logRequest: document.getElementById('log-request'),
        logResponse: document.getElementById('log-response'),
    };

    const storageKey = 'popupState';

    // --- State Management ---

    const saveState = async () => {
        const state = {
            style: ui.styleSelect.value,
            instructions: ui.instructionsInput.value,
            lastSpeaker: document.querySelector('input[name="last-speaker"]:checked').value,
            resultText: ui.resultDisplay.textContent,
            isResultVisible: !ui.resultWrapper.classList.contains('hidden'),
            logRequest: ui.logRequest.textContent,
            logResponse: ui.logResponse.textContent,
            isLogVisible: !ui.logDetails.classList.contains('hidden'),
        };
        await chrome.storage.session.set({ [storageKey]: state });
    };

    const restoreState = async () => {
        const data = await chrome.storage.session.get(storageKey);
        const state = data[storageKey];
        if (!state) return;

        ui.styleSelect.value = state.style || '丁寧な';
        ui.instructionsInput.value = state.instructions || '';
        document.querySelector(`input[name="last-speaker"][value="${state.lastSpeaker || '相手'}"]`).checked = true;

        if (state.isResultVisible) {
            ui.resultDisplay.textContent = state.resultText || '';
            ui.resultWrapper.classList.remove('hidden');
        }
        if (state.isLogVisible) {
            ui.logRequest.textContent = state.logRequest || '';
            ui.logResponse.textContent = state.logResponse || '';
            ui.logDetails.classList.remove('hidden');
            ui.logDetails.open = true;
        }
    };

    const clearState = async () => {
        ui.styleSelect.value = '丁寧な';
        ui.instructionsInput.value = '';
        document.getElementById('last-speaker-other').checked = true;
        ui.resultWrapper.classList.add('hidden');
        ui.logDetails.classList.add('hidden');
        ui.errorDisplay.textContent = '';
        ui.resultDisplay.textContent = '';
        ui.logRequest.textContent = '';
        ui.logResponse.textContent = '';
        await chrome.storage.session.remove(storageKey);
    };

    // --- Event Listeners ---

    // Save state on any input change
    ui.styleSelect.addEventListener('change', saveState);
    ui.instructionsInput.addEventListener('input', saveState);
    ui.lastSpeakerRadios.forEach(radio => radio.addEventListener('change', saveState));

    // Clear button logic
    ui.clearBtn.addEventListener('click', clearState);

    // Generate button logic
    ui.generateBtn.addEventListener('click', async () => {
        ui.errorDisplay.textContent = '';
        ui.resultWrapper.classList.add('hidden');
        ui.logDetails.classList.add('hidden');
        ui.generateBtn.disabled = true;
        ui.generateBtn.textContent = '生成中...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error("アクティブなタブが見つかりません。");

            const htmlResponse = await chrome.tabs.sendMessage(tab.id, { type: 'getConversationHtml' });

            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            if (htmlResponse.error) throw new Error(htmlResponse.error);
            if (!htmlResponse.html) throw new Error("ページから会話を取得できませんでした。入力欄をクリックしてから再度お試しください。");

            const responseFromBg = await chrome.runtime.sendMessage({
                type: 'generateReply',
                html: htmlResponse.html,
                style: ui.styleSelect.value,
                instructions: ui.instructionsInput.value,
                lastSpeaker: document.querySelector('input[name="last-speaker"]:checked').value
            });

            if (responseFromBg.log) {
                ui.logRequest.textContent = JSON.stringify(responseFromBg.log.request, null, 2);
                ui.logResponse.textContent = JSON.stringify(responseFromBg.log.response, null, 2);
                ui.logDetails.classList.remove('hidden');
            }

            if (responseFromBg.error) {
                throw new Error(responseFromBg.error.message);
            }

            ui.resultDisplay.textContent = responseFromBg.reply;
            ui.resultWrapper.classList.remove('hidden');

            await saveState(); // Save the successful result

        } catch (error) {
            console.error("Error during generation process:", error);
            ui.errorDisplay.textContent = `エラー: ${error.message}`;
            await saveState(); // Save state even on error to show logs
        } finally {
            ui.generateBtn.disabled = false;
            ui.generateBtn.textContent = '返信を生成';
        }
    });

    // Insert button logic
    ui.insertBtn.addEventListener('click', async () => {
        const textToInsert = ui.resultDisplay.textContent;
        if (!textToInsert) return;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error("アクティブなタブが見つかりません。");
            await chrome.tabs.sendMessage(tab.id, { type: 'insertText', text: textToInsert });
            window.close();
        } catch (error) {
            ui.errorDisplay.textContent = `挿入エラー: ${error.message}`;
        }
    });

    // --- Initial Setup ---

    // Restore state first
    await restoreState();

    // Then inject content script
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content_script.js'],
            });
        }
    } catch (e) {
        ui.errorDisplay.textContent = `このページには接続できません: ${e.message}`;
        ui.generateBtn.disabled = true;
    }
});
