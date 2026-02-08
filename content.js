
// Variables
let isReading = false;
let isPaused = true; // Start paused or playing?
let wpm = 300;
let paragraphs = [];
let currentParagraphIndex = 0;
let currentWordIndex = 0;
let wordQueue = [];
let intervalId = null;

// UI Elements
let overlay = null;
let wordStrip = null;
let progressBar = null;
let playPauseBtn = null;
let statusDisplay = null;

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_rsvp") {
        wpm = request.settings.wpm;
        if (!isReading) {
            initRSVP();
        } else {
            // Update WPM if already reading
            updateSpeed();
        }
        sendResponse({ status: "started" });
    }
});

function initRSVP() {
    extractParagraphs();
    if (paragraphs.length === 0) {
        alert("No readable text found on this page.");
        return;
    }

    createOverlay();
    isReading = true;
    isPaused = false;
    currentParagraphIndex = 0;

    loadParagraph(0);

    // Start Loop
    startLoop();
    updatePlayPauseButton();
}


function extractParagraphs() {
    // Improved Extraction Strategy
    // 1. Target main content containers first
    const selectors = ['article', 'main', '.post-content', '.entry-content', '#content', '.story-body'];
    let root = document.querySelector(selectors.find(s => document.querySelector(s)) || 'body');

    // 2. Get all P tags within root
    const nodes = root.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote');

    paragraphs = [];
    nodes.forEach(node => {
        // Filter hidden nodes
        if (node.offsetParent === null) return;

        const text = node.innerText.trim();
        // Check for reasonable length and word count
        if (text.length > 20 && text.split(/\s+/).length > 3) {
            // Split into words, preserving punctuation attached to words
            const words = text.split(/\s+/);
            paragraphs.push(words);
        }
    });
}

function createOverlay() {
    if (document.getElementById('fr-overlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'fr-overlay';

    overlay.innerHTML = `
        <button id="fr-close">&times;</button>
        <div id="fr-reader-container">
            <div id="fr-word-strip"></div>
            <!-- Center Marker line -->
            <div style="position:absolute; left:50%; top:20%; bottom:20%; width:2px; background:rgba(255,0,0,0.1); transform:translateX(-50%); pointer-events:none;"></div>
        </div>
        <div id="fr-progress-container">
            <div id="fr-progress-bar"></div>
        </div>
        <div id="fr-controls">
            <button id="fr-prev-para" class="fr-btn">Prev Para</button>
            <button id="fr-play-pause" class="fr-btn primary">Pause</button>
            <button id="fr-next-para" class="fr-btn">Next Para</button>
        </div>
        <div id="fr-status" style="margin-top:10px; font-size:12px; color:#888;"></div>
    `;

    document.body.appendChild(overlay);

    // Bind events
    document.getElementById('fr-close').addEventListener('click', stopRSVP);
    playPauseBtn = document.getElementById('fr-play-pause');
    playPauseBtn.addEventListener('click', togglePause);
    document.getElementById('fr-prev-para').addEventListener('click', () => jumpParagraph(-1));
    document.getElementById('fr-next-para').addEventListener('click', () => jumpParagraph(1));
    statusDisplay = document.getElementById('fr-status');

    // Keyboard events
    document.addEventListener('keydown', handleKeydown);

    wordStrip = document.getElementById('fr-word-strip');
    progressBar = document.getElementById('fr-progress-bar');
}

function handleKeydown(e) {
    if (!isReading) return;
    if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
    } else if (e.code === 'ArrowLeft') {
        // Rewind a few words or jump paragraph
        if (e.shiftKey) jumpParagraph(-1);
        else jumpWord(-5);
    } else if (e.code === 'ArrowRight') {
        if (e.shiftKey) jumpParagraph(1);
        else jumpWord(5);
    } else if (e.code === 'Escape') {
        stopRSVP();
    }
}

function jumpWord(delta) {
    let newIndex = currentWordIndex + delta;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= wordQueue.length) newIndex = wordQueue.length - 1;
    currentWordIndex = newIndex;
    updateDisplay();
}

function loadParagraph(index) {
    if (index < 0 || index >= paragraphs.length) return false;
    currentParagraphIndex = index;
    currentWordIndex = 0;
    wordQueue = paragraphs[index];

    renderParagraphToDOM();
    updateDisplay();
    updateStatus();
    return true;
}

function renderParagraphToDOM() {
    // Create span for every word in the paragraph at once
    if (!wordStrip) return;
    wordStrip.innerHTML = '';

    const fragment = document.createDocumentFragment();
    wordQueue.forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.className = 'fr-word';
        span.dataset.index = i;
        fragment.appendChild(span);
    });

    wordStrip.appendChild(fragment);

    // Force layout recalc to ensure we can measure widths if needed, 
    // but the flex layout should handle it.
}

function updateDisplay() {
    if (!wordStrip) return;

    const words = wordStrip.children;
    if (words.length === 0) return;

    // Remove active class from all
    const prevActive = wordStrip.querySelector('.active');
    if (prevActive) prevActive.classList.remove('active');

    // Add active class to current
    const currentWordEl = words[currentWordIndex];
    if (currentWordEl) {
        currentWordEl.classList.add('active');

        // Calculate offset to center this word
        // We want the CENTER of the currentWordEl to be at the CENTER of the container (50%)
        // The container is absolutely positioned left: 50%
        // So we need to translate the strip to the left by (currentWordEl.offsetLeft + currentWordEl.offsetWidth/2)

        const offset = currentWordEl.offsetLeft + (currentWordEl.offsetWidth / 2);
        wordStrip.style.transform = `translateX(-${offset}px)`;
    }

    // Fade context logic handled by CSS (.active has opacity 1, others 0.25)
    // Maybe we want near neighbors to be slightly more visible?
    // CSS can't easily select "siblings near active", so JS adjustment might be needed for advanced fading.
    // For now, simple active/inactive opacity is fine as per MVP.
    // Actually, user asked for "context text as well before and after". 0.25 opacity provides that.

    // Update progress bar
    const totalParas = paragraphs.length;
    const progress = ((currentParagraphIndex) / totalParas) * 100;
    progressBar.style.width = `${progress}%`;
}

function startLoop() {
    stopLoop(); // Clear existing
    if (isPaused) return;

    // Calculate interval based on WPM
    // Standard word length handling? For now just simple WPM.
    const msPerWord = 60000 / wpm;

    // Check if we need to adjust speed based on word length? (Optional enhancement)
    // Long words take longer to read.

    const tick = () => {
        // Render current state
        updateDisplay();

        // Schedule next tick
        let delay = msPerWord;

        // Basic delay adjustment for punctuation
        const currentWord = wordQueue[currentWordIndex];
        if (currentWord) {
            if (currentWord.endsWith('.') || currentWord.endsWith('!') || currentWord.endsWith('?')) {
                delay *= 1.5; // Pause at end of sentence
            } else if (currentWord.endsWith(',')) {
                delay *= 1.2; // Slight pause at comma
            }
        }

        intervalId = setTimeout(() => {
            if (isPaused) return; // double check

            currentWordIndex++;
            if (currentWordIndex >= wordQueue.length) {
                // Next paragraph
                if (currentParagraphIndex + 1 < paragraphs.length) {
                    currentParagraphIndex++;
                    loadParagraph(currentParagraphIndex);
                    // Add a small extra pause between paragraphs?
                    // The recursion will continue from loadParagraph's reset index (0)
                    // We need to trigger the next tick manually or just let the loop continue?
                    // loadParagraph resets index to 0.
                    // Let's call tick again immediately or after a pause.
                    setTimeout(tick, msPerWord * 2);
                    return;
                } else {
                    stopRSVP();
                    return;
                }
            }

            tick(); // Continue loop

        }, delay);
    };

    tick(); // Start
}

function stopLoop() {
    if (intervalId) clearTimeout(intervalId);
    intervalId = null;
}

function updateSpeed() {
    // If just speed changed, we don't need to restart everything, just the loop timing.
    // The loop handles dynamic delay, but restart is safer.
    if (isReading && !isPaused) {
        startLoop();
    }
}

function togglePause() {
    isPaused = !isPaused;
    updatePlayPauseButton();
    if (isPaused) {
        stopLoop();
    } else {
        startLoop();
    }
}

function updatePlayPauseButton() {
    if (playPauseBtn) {
        playPauseBtn.textContent = isPaused ? "Resume" : "Pause";
        playPauseBtn.className = isPaused ? "fr-btn" : "fr-btn primary";
    }
}

function jumpParagraph(direction) {
    const newIndex = currentParagraphIndex + direction;
    if (newIndex >= 0 && newIndex < paragraphs.length) {
        loadParagraph(newIndex);
        // If we were playing, we keep playing. logic handles it.
    }
}

function updateStatus() {
    if (statusDisplay) {
        statusDisplay.textContent = `Paragraph ${currentParagraphIndex + 1} of ${paragraphs.length} • ${wpm} WPM`;
    }
}

function stopRSVP() {
    isReading = false;
    isPaused = false;
    stopLoop();
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
    document.removeEventListener('keydown', handleKeydown);
}
