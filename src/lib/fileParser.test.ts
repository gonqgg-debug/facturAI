/**
 * Unit Tests for File Parser
 * Tests file text extraction from various formats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTextFromFile } from './fileParser';

// Mock dependencies
vi.mock('./ocr', () => ({
    processImage: vi.fn()
}));

vi.mock('xlsx', () => {
    const mockRead = vi.fn();
    const mockSheetToCsv = vi.fn();
    return {
        default: {
            read: mockRead,
            utils: {
                sheet_to_csv: mockSheetToCsv
            }
        },
        read: mockRead,
        utils: {
            sheet_to_csv: mockSheetToCsv
        }
    };
});

import * as XLSX from 'xlsx';
import { processImage } from './ocr';

describe('extractTextFromFile', () => {
    let mockFile: File;
    let mockXLSXRead: ReturnType<typeof vi.fn>;
    let mockSheetToCsv: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockXLSXRead = vi.mocked(XLSX.default.read);
        mockSheetToCsv = vi.mocked(XLSX.default.utils.sheet_to_csv);
    });

    const createMockFile = (name: string, content: string = 'test content'): File => {
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], name, { type: 'text/plain' });
        // Add File API methods
        (file as any).text = async () => content;
        (file as any).arrayBuffer = async () => {
            const buffer = new ArrayBuffer(content.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < content.length; i++) {
                view[i] = content.charCodeAt(i);
            }
            return buffer;
        };
        return file;
    };

    describe('TXT files', () => {
        it('should extract text from .txt file', async () => {
            mockFile = createMockFile('test.txt', 'Hello World');
            const result = await extractTextFromFile(mockFile);
            expect(result).toBe('Hello World');
        });

        it('should handle empty txt file', async () => {
            mockFile = createMockFile('empty.txt', '');
            const result = await extractTextFromFile(mockFile);
            expect(result).toBe('');
        });

        it('should handle txt file with special characters', async () => {
            mockFile = createMockFile('special.txt', 'Test\nNew Line\nTab\tHere');
            const result = await extractTextFromFile(mockFile);
            expect(result).toContain('Test');
            expect(result).toContain('New Line');
        });
    });

    describe('Excel files', () => {
        beforeEach(() => {
            mockXLSXRead.mockReturnValue({
                SheetNames: ['Sheet1'],
                Sheets: {
                    Sheet1: {}
                }
            } as any);
            mockSheetToCsv.mockReturnValue('col1,col2\nval1,val2');
        });

        it('should extract text from .xlsx file', async () => {
            mockFile = createMockFile('test.xlsx');
            const result = await extractTextFromFile(mockFile);
            
            expect(mockXLSXRead).toHaveBeenCalled();
            expect(result).toContain('Sheet: Sheet1');
            expect(result).toContain('col1,col2');
        });

        it('should extract text from .xls file', async () => {
            mockFile = createMockFile('test.xls');
            const result = await extractTextFromFile(mockFile);
            
            expect(mockXLSXRead).toHaveBeenCalled();
            expect(result).toContain('Sheet: Sheet1');
        });

        it('should extract text from .csv file', async () => {
            mockFile = createMockFile('test.csv');
            const result = await extractTextFromFile(mockFile);
            
            expect(mockXLSXRead).toHaveBeenCalled();
            expect(result).toContain('Sheet: Sheet1');
        });

        it('should handle multiple sheets', async () => {
            mockXLSXRead.mockReturnValue({
                SheetNames: ['Sheet1', 'Sheet2'],
                Sheets: {
                    Sheet1: {},
                    Sheet2: {}
                }
            } as any);
            mockSheetToCsv
                .mockReturnValueOnce('sheet1 data')
                .mockReturnValueOnce('sheet2 data');

            mockFile = createMockFile('multi.xlsx');
            const result = await extractTextFromFile(mockFile);
            
            expect(result).toContain('Sheet: Sheet1');
            expect(result).toContain('Sheet: Sheet2');
            expect(result).toContain('sheet1 data');
            expect(result).toContain('sheet2 data');
        });

        it('should format sheets with separator', async () => {
            mockFile = createMockFile('test.xlsx');
            const result = await extractTextFromFile(mockFile);
            
            expect(result).toContain('---');
        });
    });

    describe('PDF files', () => {
        // PDF tests require complex PDF.js mocking - skipping for now
        // Can be added later with proper PDF.js test setup
        it.skip('should extract text from .pdf file', async () => {
            // Requires PDF.js mocking
        });

        it.skip('should handle multi-page PDF', async () => {
            // Requires PDF.js mocking
        });

        it.skip('should format PDF pages correctly', async () => {
            // Requires PDF.js mocking
        });
    });

    describe('Image files', () => {
        beforeEach(() => {
            vi.mocked(processImage).mockResolvedValue({
                text: 'Extracted text from image',
                confidence: 0.95
            });
        });

        it('should extract text from .jpg file', async () => {
            mockFile = createMockFile('test.jpg');
            const result = await extractTextFromFile(mockFile);
            
            expect(processImage).toHaveBeenCalledWith(mockFile);
            expect(result).toBe('Extracted text from image');
        });

        it('should extract text from .jpeg file', async () => {
            mockFile = createMockFile('test.jpeg');
            const result = await extractTextFromFile(mockFile);
            
            expect(processImage).toHaveBeenCalled();
            expect(result).toBe('Extracted text from image');
        });

        it('should extract text from .png file', async () => {
            mockFile = createMockFile('test.png');
            const result = await extractTextFromFile(mockFile);
            
            expect(processImage).toHaveBeenCalled();
            expect(result).toBe('Extracted text from image');
        });

        it('should extract text from .webp file', async () => {
            mockFile = createMockFile('test.webp');
            const result = await extractTextFromFile(mockFile);
            
            expect(processImage).toHaveBeenCalled();
            expect(result).toBe('Extracted text from image');
        });

        it('should extract text from .bmp file', async () => {
            mockFile = createMockFile('test.bmp');
            const result = await extractTextFromFile(mockFile);
            
            expect(processImage).toHaveBeenCalled();
            expect(result).toBe('Extracted text from image');
        });

        it('should handle OCR errors gracefully', async () => {
            vi.mocked(processImage).mockRejectedValue(new Error('OCR failed'));
            
            mockFile = createMockFile('test.jpg');
            await expect(extractTextFromFile(mockFile)).rejects.toThrow();
        });
    });

    describe('Unsupported file types', () => {
        it('should throw error for unsupported file type', async () => {
            mockFile = createMockFile('test.unknown');
            await expect(extractTextFromFile(mockFile)).rejects.toThrow('Unsupported file type');
        });

        it('should handle files without extension', async () => {
            mockFile = createMockFile('noextension');
            await expect(extractTextFromFile(mockFile)).rejects.toThrow('Unsupported file type');
        });

        it('should handle uppercase extensions', async () => {
            mockFile = createMockFile('test.TXT');
            const result = await extractTextFromFile(mockFile);
            expect(result).toBe('test content');
        });
    });

    describe('Edge cases', () => {
        it('should handle file with multiple dots in name', async () => {
            mockFile = createMockFile('test.file.txt');
            const result = await extractTextFromFile(mockFile);
            expect(result).toBe('test content');
        });

        it('should handle very long file names', async () => {
            const longName = 'a'.repeat(100) + '.txt';
            mockFile = createMockFile(longName);
            const result = await extractTextFromFile(mockFile);
            expect(result).toBe('test content');
        });
    });
});

