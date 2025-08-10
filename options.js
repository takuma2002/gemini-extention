// options.js

/**
 * Saves the API key to chrome.storage.local.
 */
function saveOptions() {
    const apiKeyInput = document.getElementById('api-key');
    const apiKey = apiKeyInput.value;
    const status = document.getElementById('status');

    if (!apiKey) {
        status.textContent = 'APIキーが入力されていません。';
        status.style.color = '#dc3545'; // Red for error
        setTimeout(() => { status.textContent = ''; }, 2000);
        return;
    }

    chrome.storage.local.set({
        apiKey: apiKey
    }, () => {
        // Update status to let user know options were saved.
        status.textContent = 'APIキーを保存しました。';
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
    // Use a default value of '' if the key isn't found.
    chrome.storage.local.get({ apiKey: '' }, (items) => {
        document.getElementById('api-key').value = items.apiKey;
    });
}

// Add event listeners once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
