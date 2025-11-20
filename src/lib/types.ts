export interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    value: number;
    itbis: number;
    amount: number;
}

export interface Invoice {
    id?: number;
    // Extracted Data
    providerName: string;
    providerRnc: string;
    clientName?: string;
    clientRnc?: string;
    issueDate: string;
    dueDate?: string;
    ncf: string;
    currency: 'DOP' | 'USD';
    items: InvoiceItem[];

    // Totals
    subtotal: number;
    discount: number;
    itbisTotal: number;
    total: number;

    // Metadata
    rawText: string;
    imageUrl?: string;
    status: 'draft' | 'verified' | 'exported' | 'needs_extraction';
    category?: 'Inventory' | 'Utilities' | 'Maintenance' | 'Payroll' | 'Other';
    createdAt: Date;

    // Security
    securityCode?: string; // QR Code content
    isEcf?: boolean;
    qrUrl?: string;
}

export interface Supplier {
    id?: number;
    name: string;
    rnc: string;
    alias?: string[];
    customRules?: string;
    examples: Invoice[];
}

export interface KnowledgeBaseRule {
    id?: number;
    supplierId: number;
    rule: string;
    createdAt: Date;
}

export interface GlobalContextItem {
    id?: number;
    title: string;
    content: string; // Extracted text
    type: 'text' | 'file';
    category?: 'tax' | 'conversion' | 'business_logic';
    fileName?: string;
    fileType?: 'pdf' | 'excel' | 'txt';
    createdAt: Date;
}

export interface UserHints {
    supplierName?: string;
    total?: number;
    itbis?: number;
    isMultiPage?: boolean;
}
