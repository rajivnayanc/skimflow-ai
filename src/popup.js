import contentScript from '../src/content.js?script';

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

    // Feature guide toggle
    const guideToggle = document.getElementById('guideToggle');
    const guideList = document.getElementById('guideList');
    const guideChevron = document.getElementById('guideChevron');

    chrome.storage.sync.get(['guideCollapsed'], (data) => {
        if (data.guideCollapsed) {
            guideList.classList.add('collapsed');
            guideChevron.classList.add('collapsed');
        }
    });

    guideToggle.addEventListener('click', () => {
        const isCollapsed = guideList.classList.toggle('collapsed');
        guideChevron.classList.toggle('collapsed', isCollapsed);
        chrome.storage.sync.set({ guideCollapsed: isCollapsed });
    });

    startBtn.addEventListener('click', async () => {
        const wpm = parseInt(wpmInput.value, 10);
        const smartHighlight = smartHighlightInput.checked;
        const theme = themeSelect.value;

        chrome.storage.sync.set({ wpm: wpm, smartHighlight: smartHighlight, theme: theme });

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) return;

        // Determine if it's a PDF
        const isPdf = tab.url && tab.url.toLowerCase().includes('.pdf');

        try {
            // Inject CSS first
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['styles.css']
            });

            // Inject Content Script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: [contentScript]
            });

            if (isPdf) {
                chrome.tabs.sendMessage(tab.id, {
                    action: "start_rsvp_pdf",
                    url: tab.url,
                    tabId: tab.id,
                    settings: { wpm: wpm, smartHighlight: smartHighlight, theme: theme }
                });
                window.close();
            } else {
                chrome.tabs.sendMessage(tab.id, {
                    action: "start_rsvp",
                    settings: { wpm: wpm, smartHighlight: smartHighlight, theme: theme }
                }, () => { window.close(); });
            }
        } catch (err) {
            console.error("Failed to inject scripts", err);
            // This usually happens on chrome:// pages or if permission is missing
            alert("Cannot run on this page. Try a normal web page.");
        }
    });
});
