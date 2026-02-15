// Save settings
const saveBtn = document.getElementById('save');
const status = document.getElementById('status');

function saveOptions() {
    const wpm = document.getElementById('wpm').value;
    const theme = document.getElementById('theme').value;
    const smartHighlight = document.getElementById('smartHighlight').checked;

    chrome.storage.sync.set({
        wpm: parseInt(wpm, 10),
        theme: theme,
        smartHighlight: smartHighlight
    }, () => {
        // Update status to let user know options were saved.
        status.textContent = 'Options saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 2000);
    });
}

// Restore select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    chrome.storage.sync.get({
        wpm: 300,
        theme: 'light',
        smartHighlight: true
    }, (items) => {
        document.getElementById('wpm').value = items.wpm;
        document.getElementById('theme').value = items.theme;
        document.getElementById('smartHighlight').checked = items.smartHighlight;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
