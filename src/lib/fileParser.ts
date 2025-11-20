
import * as XLSX from 'xlsx';
import { processImage } from './ocr';

export async function extractTextFromFile(file: File): Promise<string> {
    const type = file.name.split('.').pop()?.toLowerCase();

    if (type === 'txt') {
        return await file.text();
    }

    if (['xlsx', 'xls', 'csv'].includes(type || '')) {
        return await extractExcel(file);
    }

    if (type === 'pdf') {
        return await extractPdf(file);
    }

    if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(type || '')) {
        const { text } = await processImage(file);
        return text;
    }

    throw new Error('Unsupported file type');
}

async function extractExcel(file: File): Promise<string> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    let text = '';

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += `Sheet: ${sheetName}\n`;
        text += XLSX.utils.sheet_to_csv(sheet);
        text += '\n---\n';
    });

    return text;
}

async function extractPdf(file: File): Promise<string> {
    // Dynamic import to avoid SSR issues with DOMMatrix/Canvas
    const pdfjsLib = await import('pdfjs-dist');

    // Configure worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        text += `Page ${i}:\n${strings.join(' ')}\n\n`;
    }

    return text;
}
