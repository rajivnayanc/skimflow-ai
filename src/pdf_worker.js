import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

async function start() {
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get('url');
    if (!url) return;

    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            let lastY, lastX, lastWidth;
            let pageText = '';
            
            for (let item of textContent.items) {
                if (lastY !== undefined && Math.abs(item.transform[5] - lastY) > (item.height * 0.5 || 5)) {
                    pageText += '\n';
                } else if (lastX !== undefined) {
                    const expectedNextX = lastX + lastWidth;
                    const gap = item.transform[4] - expectedNextX;
                    if (gap > (item.height * 0.2) || gap > 3) {
                        pageText += ' ';
                    }
                }
                
                pageText += item.str;
                lastX = item.transform[4];
                lastY = item.transform[5];
                lastWidth = item.width || (item.str.length * 5);

                if (item.hasEOL) {
                    pageText += '\n';
                    lastY = undefined;
                    lastX = undefined;
                }
            }
            
            pageText = pageText.replace(/ {2,}/g, ' ');
            
            if (pageText.trim().length > 0) {
                window.parent.postMessage({
                    type: 'SKIMFLOW_PDF_TEXT',
                    text: pageText + '\n\n'
                }, '*');
            }
            
            // Yield execution to avoid overloading main thread (per user request)
            await new Promise(r => setTimeout(r, 50));
        }
    } catch (error) {
        console.error("PDF Parse Error:", error);
        window.parent.postMessage({
            type: 'SKIMFLOW_PDF_ERROR',
            error: error.message
        }, '*');
    }
}

start();
