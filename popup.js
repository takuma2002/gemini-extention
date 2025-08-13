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
        copyBtn: document.getElementById('copy-btn'),
        errorDisplay: document.getElementById('error-display'),
        logDetails: document.getElementById('log-details'),
        logRequest: document.getElementById('log-request'),
        logResponse: document.getElementById('log-response'),
        charCounter: document.getElementById('char-counter'),
        reportIssueLink: document.getElementById('report-issue-link'),
        manualSelectBtn: document.getElementById('manual-select-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        translationWrapper: document.getElementById('translation-wrapper'),
        translationDisplay: document.getElementById('translation-display'),
        copyTranslationBtn: document.getElementById('copy-translation-btn'),
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
            inputFieldFound: !ui.insertBtn.classList.contains('hidden'),
        };
        await chrome.storage.session.set({ [storageKey]: state });
    };

    const restoreState = async () => {
        const data = await chrome.storage.session.get(storageKey);
        const state = data[storageKey];
        if (!state) {
            updateCharCounter();
            return;
        }
        ui.styleSelect.value = state.style || '丁寧な';
        ui.instructionsInput.value = state.instructions || '';
        document.querySelector(`input[name="last-speaker"][value="${state.lastSpeaker || '相手'}"]`).checked = true;
        if (state.isResultVisible) {
            ui.resultDisplay.textContent = state.resultText || '';
            ui.resultWrapper.classList.remove('hidden');
            if (state.inputFieldFound) {
                ui.insertBtn.classList.remove('hidden');
                ui.copyBtn.classList.add('hidden');
            } else {
                ui.insertBtn.classList.add('hidden');
                ui.copyBtn.classList.remove('hidden');
            }
        }
        if (state.isLogVisible) {
            ui.logRequest.textContent = state.logRequest || '';
            ui.logResponse.textContent = state.logResponse || '';
            ui.logDetails.classList.remove('hidden');
            ui.logDetails.open = true;
        }
        updateCharCounter();
    };

    const clearState = async () => {
        ui.styleSelect.value = '丁寧な';
        ui.instructionsInput.value = '';
        document.getElementById('last-speaker-other').checked = true;
        ui.resultWrapper.classList.add('hidden');
        ui.translationWrapper.classList.add('hidden');
        ui.logDetails.classList.add('hidden');
        ui.errorDisplay.textContent = '';
        ui.resultDisplay.textContent = '';
        ui.logRequest.textContent = '';
        ui.logResponse.textContent = '';
        updateCharCounter();
        await chrome.storage.session.remove(storageKey);
    };

    const updateCharCounter = () => {
        const maxLength = ui.instructionsInput.maxLength;
        const currentLength = ui.instructionsInput.value.length;
        ui.charCounter.textContent = `${currentLength} / ${maxLength}`;
    };

    // --- Event Listeners ---
    ui.styleSelect.addEventListener('change', saveState);
    ui.instructionsInput.addEventListener('input', () => {
        updateCharCounter();
        saveState();
    });
    ui.lastSpeakerRadios.forEach(radio => radio.addEventListener('change', saveState));
    ui.clearBtn.addEventListener('click', clearState);
    ui.reportIssueLink.addEventListener('click', async (event) => {
        event.preventDefault();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const pageUrl = tab ? tab.url : 'Unknown URL';
        const subject = encodeURIComponent(chrome.i18n.getMessage("report_subject"));
        const body = encodeURIComponent(chrome.i18n.getMessage("report_body", [pageUrl]));
        chrome.tabs.create({ url: `mailto:support@example.com?subject=${subject}&body=${body}` });
    });

    ui.manualSelectBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await chrome.tabs.sendMessage(tab.id, { type: 'enterSelectionMode' });
                window.close();
            }
        } catch (error) {
            ui.errorDisplay.textContent = chrome.i18n.getMessage("error_prefix", [error.message]);
        }
    });

    ui.settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // --- Main Generate Logic ---
    ui.generateBtn.addEventListener('click', async () => {
        ui.errorDisplay.textContent = '';
        ui.resultWrapper.classList.add('hidden');
        ui.translationWrapper.classList.add('hidden');
        ui.logDetails.classList.add('hidden');
        ui.generateBtn.disabled = true;
        ui.generateBtn.textContent = chrome.i18n.getMessage("popup_generateBtn_generating");
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error(chrome.i18n.getMessage("error_noActiveTab"));
            const htmlResponse = await chrome.tabs.sendMessage(tab.id, { type: 'getConversationHtml' });
            if (chrome.runtime.lastError || !htmlResponse) {
                throw new Error(chrome.i18n.getMessage("error_scriptConnection"));
            }
            if (htmlResponse.error || !htmlResponse.html) {
                throw new Error(htmlResponse.error || chrome.i18n.getMessage("error_noConversationContent"));
            }
            const responseFromBg = await chrome.runtime.sendMessage({
                type: 'generateReply',
                html: htmlResponse.html,
                style: ui.styleSelect.value,
                instructions: ui.instructionsInput.value,
                lastSpeaker: document.querySelector('input[name="last-speaker"]:checked').value,
            });
            if (responseFromBg.log) {
                ui.logRequest.textContent = JSON.stringify(responseFromBg.log.request, null, 2);
                ui.logResponse.textContent = JSON.stringify(responseFromBg.log.response, null, 2);
                ui.logDetails.classList.remove('hidden');
            }
            if (responseFromBg.error) throw new Error(responseFromBg.error.message);

            ui.resultDisplay.textContent = responseFromBg.reply;
            ui.resultWrapper.classList.remove('hidden');

            if (responseFromBg.translatedReply) {
                ui.translationDisplay.textContent = responseFromBg.translatedReply;
                ui.translationWrapper.classList.remove('hidden');
            }

            if (htmlResponse.inputFieldFound) {
                ui.insertBtn.classList.remove('hidden');
                ui.copyBtn.classList.add('hidden');
            } else {
                ui.insertBtn.classList.add('hidden');
                ui.copyBtn.classList.remove('hidden');
            }
            await saveState();
        } catch (error) {
            ui.errorDisplay.textContent = chrome.i18n.getMessage("error_prefix", [error.message]);
            await saveState();
        } finally {
            ui.generateBtn.disabled = false;
            ui.generateBtn.textContent = chrome.i18n.getMessage("popup_generateBtn");
        }
    });

    // --- Insert & Copy Button Logic ---
    ui.insertBtn.addEventListener('click', async () => {
        const textToInsert = ui.resultDisplay.textContent;
        if (!textToInsert) return;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error(chrome.i18n.getMessage("error_noActiveTab"));
            await chrome.tabs.sendMessage(tab.id, { type: 'insertText', text: textToInsert });
            window.close();
        } catch (error) {
            ui.errorDisplay.textContent = chrome.i18n.getMessage("error_insertPrefix", [error.message]);
        }
    });
    ui.copyBtn.addEventListener('click', () => {
        const textToCopy = ui.resultDisplay.textContent;
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy).then(() => {
            ui.copyBtn.textContent = chrome.i18n.getMessage("popup_copyBtn_copied");
            setTimeout(() => { ui.copyBtn.textContent = chrome.i18n.getMessage("popup_copyBtn"); }, 1500);
        }).catch(err => {
            ui.errorDisplay.textContent = chrome.i18n.getMessage("error_copyFailed");
        });
    });

    ui.copyTranslationBtn.addEventListener('click', () => {
        const textToCopy = ui.translationDisplay.textContent;
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy).then(() => {
            ui.copyTranslationBtn.textContent = chrome.i18n.getMessage("popup_copyBtn_copied");
            setTimeout(() => {
                ui.copyTranslationBtn.textContent = chrome.i18n.getMessage("popup_copyTranslationBtn");
            }, 1500);
        }).catch(err => {
            ui.errorDisplay.textContent = chrome.i18n.getMessage("error_copyFailed");
        });
    });

    // --- Initial Setup ---
    await restoreState();
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content_script.js'],
            });
        }
    } catch (e) {
        ui.errorDisplay.textContent = chrome.i18n.getMessage("error_cantConnectPrefix", [e.message]);
        ui.generateBtn.disabled = true;
    }
});
