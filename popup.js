document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startData');
    const wpmInput = document.getElementById('wpm');
    const themeSelect = document.getElementById('theme');
    const smartHighlightInput = document.getElementById('smartHighlight');

    // Load saved settings
    chrome.storage.sync.get(['wpm', 'smartHighlight', 'theme'], (data) => {
        if (data.wpm) wpmInput.value = data.wpm;
        if (data.smartHighlight !== undefined) smartHighlightInput.checked = data.smartHighlight;
        if (data.theme) themeSelect.value = data.theme;
    });

    startBtn.addEventListener('click', async () => {
        const wpm = parseInt(wpmInput.value, 10);
        const smartHighlight = smartHighlightInput.checked;
        const theme = themeSelect.value;

        chrome.storage.sync.set({ wpm: wpm, smartHighlight: smartHighlight, theme: theme });

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Send message directly since content.js is loaded via manifest
        chrome.tabs.sendMessage(tab.id, {
            action: "start_rsvp",
            settings: { wpm: wpm, smartHighlight: smartHighlight, theme: theme }
        }, (response) => {
            if (chrome.runtime.lastError) {
                // If message fails, script might not be loaded (e.g. restricted page)
                // We could try to inject it here as a fallback, but for now just showing error or ignoring.
                // Given the error user saw, the script WAS there. 
                console.error("FasterReading: Could not send message to content script.", chrome.runtime.lastError);
                // Optional: Alert user if on a restricted page like chrome://
            } else {
                window.close();
            }
        });
    });
});
