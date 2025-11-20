import Tesseract from 'tesseract.js';
import jsQR from 'jsqr';

export interface ProcessResult {
    text: string;
    qrCode?: string;
}

export async function processImage(imageBlob: Blob): Promise<ProcessResult> {
    const img = await loadImage(imageBlob);

    // 1. QR Code Detection (on original image for best detail)
    const qrCode = scanQRCode(img);

    // 2. Preprocess & Split
    const canvases = preprocessAndSplit(img);

    // 3. Run Tesseract on chunks
    const worker = await Tesseract.createWorker('spa');
    await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });

    let fullText = '';
    for (const canvas of canvases) {
        const { data: { text } } = await worker.recognize(canvas);
        fullText += text + '\n';
    }

    await worker.terminate();

    return { text: fullText, qrCode };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
}

function scanQRCode(img: HTMLImageElement): string | undefined {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    return code ? code.data : undefined;
}

function preprocessAndSplit(img: HTMLImageElement): HTMLCanvasElement[] {
    const MAX_HEIGHT_PER_CHUNK = 2000;
    const OVERLAP = 100;

    const width = img.width;
    const totalHeight = img.height;

    const chunks: HTMLCanvasElement[] = [];
    let currentY = 0;

    while (currentY < totalHeight) {
        const remainingHeight = totalHeight - currentY;
        const chunkHeight = Math.min(remainingHeight, MAX_HEIGHT_PER_CHUNK);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = chunkHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Draw slice
            ctx.drawImage(img, 0, currentY, width, chunkHeight, 0, 0, width, chunkHeight);

            // Apply filters to this chunk
            applyFilters(ctx, width, chunkHeight);

            chunks.push(canvas);
        }

        if (remainingHeight <= MAX_HEIGHT_PER_CHUNK) break;
        currentY += (chunkHeight - OVERLAP); // Move down, keeping overlap
    }

    return chunks;
}

function applyFilters(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Grayscale
        const gray = 0.21 * r + 0.72 * g + 0.07 * b;

        // Simple Contrast Enhancement (less aggressive)
        // gray = ((gray - 128) * 1.2) + 128; 

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }

    ctx.putImageData(imageData, 0, 0);
}
