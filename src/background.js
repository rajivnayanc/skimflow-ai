import contentScript from '../src/content.js?script';

/**
 * Message with retry to handle race conditions during content script injection,
 * especially in development mode with HMR/loaders.
 */
async function sendMessageWithRetry(tabId, message, maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (err) {
            const isConnectionError = err.message && (
                err.message.includes("Could not establish connection") ||
                err.message.includes("Receiving end does not exist")
            );

            if (isConnectionError && i < maxRetries - 1) {
                console.log(`[SkimFlow] Message listener not ready, retrying... (${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms between retries
                continue;
            }
            throw err;
        }
    }
}


chrome.runtime.onInstalled.addListener((details) => {
    console.log('Faster Reading Extension installed');
    chrome.contextMenus.create({
        id: "read-selection",
        title: "Read with SkimFlow",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "summarize-normal",
        title: "Summarize with SkimFlow",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "summarize-advanced-parent",
        title: "Advanced Summary",
        contexts: ["selection"]
    });

    const summaryTypes = {
        'key-points': 'Key Points',
        'tldr': 'TL;DR',
        'teaser': 'Teaser',
        'headline': 'Headline'
    };

    const summaryLengths = {
        'short': 'Short',
        'medium': 'Medium',
        'long': 'Long'
    };

    for (const [typeId, typeLabel] of Object.entries(summaryTypes)) {
        chrome.contextMenus.create({
            id: `summarize-type-${typeId}`,
            parentId: "summarize-advanced-parent",
            title: typeLabel,
            contexts: ["selection"]
        });

        for (const [lengthId, lengthLabel] of Object.entries(summaryLengths)) {
            chrome.contextMenus.create({
                id: `summarize-${typeId}-${lengthId}`,
                parentId: `summarize-type-${typeId}`,
                title: lengthLabel,
                contexts: ["selection"]
            });
        }
    }

    if (details.reason === 'install') {
        chrome.runtime.openOptionsPage();
    } else if (details.reason === 'update') {
        chrome.runtime.openOptionsPage();
    }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || !tab.id) return;
    const tabId = tab.id;

    if (info.menuItemId === "read-selection" && info.selectionText) {
        try {
            const data = await chrome.storage.sync.get(['wpm', 'smartHighlight', 'theme']);
            const settings = {
                wpm: data.wpm || 300,
                smartHighlight: data.smartHighlight !== undefined ? data.smartHighlight : true,
                theme: data.theme || 'light'
            };

            try {
                await sendMessageWithRetry(tabId, {
                    action: "start_rsvp",
                    text: info.selectionText,
                    settings: settings
                });
            } catch (err) {
                console.log("Reading script not active, injecting...", err);

                await chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['styles.css']
                });

                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: [contentScript]
                });

                // Even after injection, we use retry because the loader/import is async
                await sendMessageWithRetry(tabId, {
                    action: "start_rsvp",
                    text: info.selectionText,
                    settings: settings
                });
            }
        } catch (err) {
            console.error("Context menu reading action failed:", err);
        }
    } else if ((info.menuItemId === "summarize-normal" || info.menuItemId.startsWith("summarize-")) && info.selectionText) {
        // Ignore clicks on parent menus
        if (info.menuItemId === "summarize-advanced-parent" || info.menuItemId.startsWith("summarize-type-")) {
            return;
        }

        let type = "tldr";
        let length = "long";

        if (info.menuItemId !== "summarize-normal") {
            // Extract type and length from ID (e.g., summarize-key-points-short -> type: key-points, length: short)
            const parts = info.menuItemId.replace("summarize-", "").split("-");
            length = parts.pop();
            type = parts.join("-");
        }

        try {
            const data = await chrome.storage.sync.get(['theme']);
            const settings = {
                theme: data.theme || 'light'
            };

            try {
                await sendMessageWithRetry(tabId, {
                    action: "summarize_text",
                    text: info.selectionText,
                    settings: settings,
                    summaryType: type,
                    summaryLength: length
                });
            } catch (err) {
                console.log("Reading script not active, injecting for summarizer...", err);

                await chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['styles.css']
                });

                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: [contentScript]
                });

                await sendMessageWithRetry(tabId, {
                    action: "summarize_text",
                    text: info.selectionText,
                    settings: settings,
                    summaryType: type,
                    summaryLength: length
                });
            }
        } catch (err) {
            console.error("Context menu summarize action failed:", err);
        }
    }
});
