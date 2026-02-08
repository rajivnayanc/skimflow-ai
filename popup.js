document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const wpmInput = document.getElementById('wpm');
    const smartHighlightInput = document.getElementById('smartHighlight');
    const statusMsg = document.getElementById('statusMsg');

    // Load saved settings
    chrome.storage.sync.get(['wpm', 'smartHighlight'], (result) => {
        if (result.wpm) {
            wpmInput.value = result.wpm;
        }
        if (result.smartHighlight !== undefined) {
            smartHighlightInput.checked = result.smartHighlight;
        }
    });

    startBtn.addEventListener('click', async () => {
        const wpm = parseInt(wpmInput.value, 10);
        const smartHighlight = smartHighlightInput.checked;

        // Save settings
        chrome.storage.sync.set({ wpm: wpm, smartHighlight: smartHighlight });

        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab) {
            // Send start message to content script
            chrome.tabs.sendMessage(tab.id, {
                action: "start_rsvp",
                settings: { wpm: wpm, smartHighlight: smartHighlight }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    statusMsg.textContent = "Error: Refresh the page first.";
                } else {
                    statusMsg.textContent = "Reading started...";
                    window.close(); // Close popup when started
                }
            });
        }
    });
});
