import releaseNotes from './release_notes.json';

// Save settings
const saveBtn = document.getElementById('save-btn'); // Note: ID might have been 'save' in html, let's check
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
        applyTheme(theme); // Apply immediately
        setTimeout(() => {
            status.textContent = '';
        }, 2000);
    });
}

// Restore select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    // Populate Version from Manifest (Source of Truth for Version)
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version-number').textContent = manifest.version;
    document.getElementById('footer-version').textContent = manifest.version;

    // Populate Release Notes from dedicated JSON file
    const notesList = document.getElementById('release-notes-list');
    notesList.innerHTML = '';

    // Find notes for current version
    const currentVersionNotes = releaseNotes.find(note => note.version === manifest.version);

    if (currentVersionNotes && currentVersionNotes.changes.length > 0) {
        currentVersionNotes.changes.forEach(note => {
            const li = document.createElement('li');
            li.textContent = note;
            notesList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = "No release notes found for this version.";
        notesList.appendChild(li);
    }

    chrome.storage.sync.get({
        wpm: 300,
        theme: 'light',
        smartHighlight: true
    }, (items) => {
        document.getElementById('wpm').value = items.wpm;
        document.getElementById('theme').value = items.theme;
        document.getElementById('smartHighlight').checked = items.smartHighlight;
        applyTheme(items.theme);
    });
}

function applyTheme(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    if (theme === 'dark') {
        document.body.classList.add('theme-dark');
    } else if (theme === 'auto') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('theme-dark');
        }
    }
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('theme').addEventListener('change', (e) => applyTheme(e.target.value));
