// options.js

/**
 * Saves the API key to chrome.storage.local.
 */
function saveOptions() {
    const apiKeyInput = document.getElementById('api-key');
    const apiKey = apiKeyInput.value;
    const displayLanguage = document.getElementById('display-language').value;
    const status = document.getElementById('status');

    // API Key is still mandatory
    if (!apiKey) {
        status.textContent = chrome.i18n.getMessage("options_status_apiKeyMissing");
        status.style.color = '#dc3545'; // Red for error
        setTimeout(() => { status.textContent = ''; }, 2000);
        return;
    }

    chrome.storage.local.set({
        apiKey: apiKey,
        displayLanguage: displayLanguage
    }, () => {
        // Update status to let user know options were saved.
        status.textContent = chrome.i18n.getMessage("options_status_apiKeySaved");
        status.style.color = '#28a745'; // Green for success
        setTimeout(() => {
            status.textContent = '';
        }, 2000);
    });
}

/**
 * Restores the API key input box state using the preferences
 * stored in chrome.storage.
 */
function restoreOptions() {
    // Use default values if the keys aren't found.
    chrome.storage.local.get({
        apiKey: '',
        displayLanguage: 'auto' // Default to 'auto'
    }, (items) => {
        document.getElementById('api-key').value = items.apiKey;
        document.getElementById('display-language').value = items.displayLanguage;
    });
}

// Add event listeners once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
