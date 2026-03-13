import contentScript from '../src/content.js?script';

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
                    console.log("Reading script not active, injecting...", err);

                    await chrome.scripting.insertCSS({
                        target: { tabId: tab.id },
                        files: ['styles.css']
                    });

                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: [contentScript]
                    });

                    await chrome.tabs.sendMessage(tab.id, {
                        action: "start_rsvp",
                        text: info.selectionText,
                        settings: settings
                    });
                }
            };

            await sendMessage();

        } catch (err) {
            console.error("Context menu reading action failed:", err);
        }
    } else if ((info.menuItemId === "summarize-normal" || info.menuItemId.startsWith("summarize-")) && info.selectionText) {
        // Ignore clicks on parent menus
        if (info.menuItemId === "summarize-advanced-parent" || info.menuItemId.startsWith("summarize-type-")) {
            return;
        }

        if (!tab.id) return;

        let type = "tldr";
        let length = "long";

        if (info.menuItemId !== "summarize-normal") {
            // Extract type and length from ID (e.g., summarize-key-points-short -> type: key-points, length: short)
            const parts = info.menuItemId.replace("summarize-", "").split("-");
            length = parts.pop();
            type = parts.join("-");
        }

        try {
            const sendSummarizeMessage = async () => {
                const data = await chrome.storage.sync.get(['theme']);
                const settings = {
                    theme: data.theme || 'light'
                };

                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: "summarize_text",
                        text: info.selectionText,
                        settings: settings,
                        summaryType: type,
                        summaryLength: length
                    });
                } catch (err) {
                    console.log("Reading script not active, injecting for summarizer...", err);

                    await chrome.scripting.insertCSS({
                        target: { tabId: tab.id },
                        files: ['styles.css']
                    });

                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: [contentScript]
                    });

                    await chrome.tabs.sendMessage(tab.id, {
                        action: "summarize_text",
                        text: info.selectionText,
                        settings: settings,
                        summaryType: type,
                        summaryLength: length
                    });
                }
            };

            await sendSummarizeMessage();
        } catch (err) {
            console.error("Context menu summarize action failed:", err);
        }
    }
});
