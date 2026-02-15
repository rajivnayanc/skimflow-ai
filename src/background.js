import contentScript from '../src/content.js?script';

// Background service worker
chrome.runtime.onInstalled.addListener(() => {
    console.log('Faster Reading Extension installed');
    chrome.contextMenus.create({
        id: "read-selection",
        title: "Read with SkimFlow",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "read-selection" && info.selectionText) {
        if (!tab.id) return;

        try {
            const sendMessage = async () => {
                const data = await chrome.storage.sync.get(['wpm', 'smartHighlight', 'theme']);
                const settings = {
                    wpm: data.wpm || 300,
                    smartHighlight: data.smartHighlight !== undefined ? data.smartHighlight : true,
                    theme: data.theme || 'light'
                };

                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: "start_rsvp",
                        text: info.selectionText,
                        settings: settings
                    });
                } catch (err) {
                    // If message fails, script likely not there. Inject and retry.
                    console.log("Reading script not active, injecting...", err);

                    await chrome.scripting.insertCSS({
                        target: { tabId: tab.id },
                        files: ['styles.css']
                    });

                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: [contentScript]
                    });

                    // Retry sending message
                    await chrome.tabs.sendMessage(tab.id, {
                        action: "start_rsvp",
                        text: info.selectionText,
                        settings: settings
                    });
                }
            };

            await sendMessage();

        } catch (err) {
            console.error("Context menu action failed:", err);
        }
    }
});
