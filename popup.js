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

        if (!tab.id) return;

        try {
            // Inject CSS first
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['styles.css']
            });

            // Inject Content Script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Send start message
            chrome.tabs.sendMessage(tab.id, {
                action: "start_rsvp",
                settings: { wpm: wpm, smartHighlight: smartHighlight, theme: theme }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("FasterReading: Could not send message to content script.", chrome.runtime.lastError);
                    // Maybe alert the user? 
                    // alert("Could not start reading. Refresh the page and try again.");
                } else {
                    window.close();
                }
            });
        } catch (err) {
            console.error("Failed to inject scripts", err);
            // This usually happens on chrome:// pages or if permission is missing
            alert("Cannot run on this page. Try a normal web page.");
        }
    });
});
