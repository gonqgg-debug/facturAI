/**
 * DGII (Dirección General de Impuestos Internos) File Generation
 * 
 * Generates the official tax reporting files required by Dominican Republic tax authority:
 * - Format 606: Purchase Report (monthly purchases with NCF)
 * - Format 607: Sales Report (monthly sales with NCF)
 * 
 * File format: Pipe-delimited text file (.txt)
 * Encoding: UTF-8 without BOM
 */

import { db } from './db';
import type { Invoice, Sale, Supplier, Customer } from './types';
import { browser } from '$app/environment';

// ============ TYPE DEFINITIONS ============

/**
 * DGII 606 Record - Purchase Report
 */
export interface DGII606Record {
    RNC_Cedula: string;
    Tipo_Identificacion: '1' | '2' | '3'; // 1=RNC, 2=Cedula, 3=Pasaporte
    NCF: string;
    NCF_Modificado: string;
    Fecha_Comprobante: string; // YYYYMMDD
    Fecha_Pago: string;
    
    // Amounts
    Monto_Facturado_Servicios: number;
    Monto_Facturado_Bienes: number;
    Total_Monto_Facturado: number;
    
    // ITBIS breakdown
    ITBIS_Facturado_18: number;
    ITBIS_Facturado_16: number;
    ITBIS_Facturado_0: number;
    ITBIS_Retenido: number;
    ITBIS_Sujeto_Proporcionalidad: number;
    ITBIS_Llevado_Costo: number;
    ITBIS_Adelantado: number;
    ITBIS_Percibido_Compras: number;
    
    // Retentions
    Tipo_Retencion_ISR: string;
    Monto_Retencion_Renta: number;
    ISR_Percibido_Compras: number;
    
    // Payment form
    Forma_Pago: '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08';
}

/**
 * DGII 607 Record - Sales Report
 */
export interface DGII607Record {
    RNC_Cedula: string;
    Tipo_Identificacion: '1' | '2' | '3' | '';
    NCF: string;
    NCF_Modificado: string;
    Tipo_Ingreso: '01' | '02' | '03' | '04' | '05' | '06';
    Fecha_Comprobante: string;
    Fecha_Retencion: string;
    
    // Amounts
    Monto_Facturado_Servicios: number;
    Monto_Facturado_Bienes: number;
    Total_Monto_Facturado: number;
    
    // ITBIS
    ITBIS_Facturado_18: number;
    ITBIS_Facturado_16: number;
    ITBIS_Facturado_0: number;
    ITBIS_Retenido: number;
    ITBIS_Retenido_Terceros: number;
    ITBIS_Percibido: number;
    
    // Other taxes
    ISR_Retenido: number;
    ISR_Percibido: number;
    Impuesto_Selectivo_Consumo: number;
    Otros_Impuestos: number;
    
    // Tip
    Monto_Propina_Legal: number;
    
    // Payment breakdown
    Efectivo: number;
    Cheque: number;
    Tarjeta: number;
    Credito: number;
    Bonos: number;
    Permuta: number;
    Otras_Formas_Venta: number;
}

// ============ HELPERS ============

/**
 * Format date as YYYYMMDD
 */
function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '');
}

/**
 * Get identification type based on RNC/Cedula format
 */
function getIdentificationType(rnc: string): '1' | '2' | '3' {
    const cleaned = rnc?.replace(/[-\s]/g, '') || '';
    if (cleaned.length === 9) return '1'; // RNC (9 digits)
    if (cleaned.length === 11) return '2'; // Cedula (11 digits)
    return '3'; // Passport or other
}

/**
 * Get payment method code for DGII
 */
function getPaymentCode(method: string): '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' {
    const codes: Record<string, '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08'> = {
        'cash': '01',          // Efectivo
        'check': '02',         // Cheque/Transferencia
        'bank_transfer': '03', // Transferencia Bancaria
        'credit_card': '04',   // Tarjeta de Crédito/Débito
        'debit_card': '04',    // Tarjeta de Crédito/Débito
        'credit': '05',        // A crédito
        'mobile_payment': '06', // Bonos/Certificados
        'other': '08'          // Otras formas
    };
    return codes[method] || '08';
}

/**
 * Get income type for 607 based on NCF type
 */
function getIncomeType(ncf: string): '01' | '02' | '03' | '04' | '05' | '06' {
    if (!ncf) return '01';
    const prefix = ncf.substring(0, 3);
    
    // Map NCF prefix to income type
    const typeMap: Record<string, '01' | '02' | '03' | '04' | '05' | '06'> = {
        'B01': '01', // Ingresos por operaciones (No financieros)
        'B02': '01', // Consumidor final
        'E31': '01', // e-CF Crédito Fiscal
        'E32': '01', // e-CF Consumo Final
        'B14': '04', // Regímenes especiales
        'E44': '04', // e-CF Regímenes especiales
        'B15': '05', // Gubernamental
        'E45': '05', // e-CF Gubernamental
    };
    
    return typeMap[prefix] || '01';
}

/**
 * Format number for DGII (2 decimal places, no thousand separators)
 */
function formatAmount(amount: number): string {
    return (amount || 0).toFixed(2);
}

/**
 * Clean RNC for DGII format
 */
function cleanRNC(rnc: string): string {
    return rnc?.replace(/[-\s]/g, '') || '';
}

// ============ 606 GENERATION ============

/**
 * Generate 606 records from invoices for a month
 */
export async function generate606Records(month: number, year: number): Promise<DGII606Record[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    
    const invoices = await db.invoices
        .where('issueDate')
        .between(startDate, endDate, true, true)
        .and(inv => inv.status === 'verified' || inv.status === 'exported')
        .toArray();
    
    const records: DGII606Record[] = [];
    
    for (const inv of invoices) {
        // Calculate ITBIS by rate
        let itbis18 = 0, itbis16 = 0, itbis0 = 0;
        for (const item of inv.items) {
            const rate = item.taxRate ?? 0.18;
            if (rate >= 0.17) itbis18 += item.itbis;
            else if (rate >= 0.15) itbis16 += item.itbis;
            else itbis0 += item.value;
        }
        
        // Determine if services or goods
        const isService = inv.category === 'Utilities' || inv.category === 'Maintenance' || inv.category === 'Payroll';
        
        const record: DGII606Record = {
            RNC_Cedula: cleanRNC(inv.providerRnc),
            Tipo_Identificacion: getIdentificationType(inv.providerRnc),
            NCF: inv.ncf || '',
            NCF_Modificado: '',
            Fecha_Comprobante: formatDate(inv.issueDate),
            Fecha_Pago: inv.paidDate ? formatDate(inv.paidDate) : '',
            Monto_Facturado_Servicios: isService ? inv.subtotal : 0,
            Monto_Facturado_Bienes: isService ? 0 : inv.subtotal,
            Total_Monto_Facturado: inv.total,
            ITBIS_Facturado_18: itbis18,
            ITBIS_Facturado_16: itbis16,
            ITBIS_Facturado_0: itbis0,
            ITBIS_Retenido: 0,
            ITBIS_Sujeto_Proporcionalidad: 0,
            ITBIS_Llevado_Costo: 0,
            ITBIS_Adelantado: 0,
            ITBIS_Percibido_Compras: 0,
            Tipo_Retencion_ISR: '',
            Monto_Retencion_Renta: 0,
            ISR_Percibido_Compras: 0,
            Forma_Pago: getPaymentCode(inv.paymentStatus === 'paid' ? 'cash' : 'credit')
        };
        
        records.push(record);
    }
    
    return records;
}

/**
 * Generate 606 file content
 */
export async function generate606Content(month: number, year: number): Promise<string> {
    const records = await generate606Records(month, year);
    
    // Generate pipe-delimited content
    const lines = records.map(r => [
        r.RNC_Cedula,
        r.Tipo_Identificacion,
        r.NCF,
        r.NCF_Modificado,
        r.Fecha_Comprobante,
        r.Fecha_Pago,
        formatAmount(r.Monto_Facturado_Servicios),
        formatAmount(r.Monto_Facturado_Bienes),
        formatAmount(r.Total_Monto_Facturado),
        formatAmount(r.ITBIS_Facturado_18),
        formatAmount(r.ITBIS_Facturado_16),
        formatAmount(r.ITBIS_Facturado_0),
        formatAmount(r.ITBIS_Retenido),
        formatAmount(r.ITBIS_Sujeto_Proporcionalidad),
        formatAmount(r.ITBIS_Llevado_Costo),
        formatAmount(r.ITBIS_Adelantado),
        formatAmount(r.ITBIS_Percibido_Compras),
        r.Tipo_Retencion_ISR,
        formatAmount(r.Monto_Retencion_Renta),
        formatAmount(r.ISR_Percibido_Compras),
        r.Forma_Pago
    ].join('|'));
    
    return lines.join('\n');
}

/**
 * Download 606 file
 */
export function download606(content: string, month: number, year: number): void {
    if (!browser) return;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `606_${year}${String(month).padStart(2, '0')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============ 607 GENERATION ============

/**
 * Generate 607 records from sales for a month
 * Note: For mini markets, most sales are consumer final (no NCF required for small amounts)
 * This generates records for sales that have NCF (business customers)
 */
export async function generate607Records(month: number, year: number): Promise<DGII607Record[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    
    const sales = await db.sales
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();
    
    const records: DGII607Record[] = [];
    
    // For 607, we typically aggregate consumer final sales
    // and list individual sales for business customers with RNC
    
    // Aggregate consumer sales (no RNC)
    let consumerTotal = 0;
    let consumerItbis18 = 0;
    let consumerItbis16 = 0;
    let consumerExempt = 0;
    let consumerCash = 0;
    let consumerCard = 0;
    let consumerTransfer = 0;
    let consumerCredit = 0;
    
    for (const sale of sales) {
        const customer = sale.customerId 
            ? await db.customers.get(sale.customerId) 
            : null;
        
        // Calculate ITBIS by rate
        let itbis18 = 0, itbis16 = 0, exempt = 0;
        for (const item of sale.items) {
            const rate = item.taxRate ?? 0.18;
            if (rate >= 0.17) itbis18 += item.itbis;
            else if (rate >= 0.15) itbis16 += item.itbis;
            else exempt += item.value;
        }
        
        // If customer has RNC, create individual record
        if (customer?.rnc) {
            const record: DGII607Record = {
                RNC_Cedula: cleanRNC(customer.rnc),
                Tipo_Identificacion: getIdentificationType(customer.rnc),
                NCF: '', // Would need NCF issuance system
                NCF_Modificado: '',
                Tipo_Ingreso: '01',
                Fecha_Comprobante: formatDate(sale.date),
                Fecha_Retencion: '',
                Monto_Facturado_Servicios: 0,
                Monto_Facturado_Bienes: sale.subtotal,
                Total_Monto_Facturado: sale.total,
                ITBIS_Facturado_18: itbis18,
                ITBIS_Facturado_16: itbis16,
                ITBIS_Facturado_0: exempt,
                ITBIS_Retenido: 0,
                ITBIS_Retenido_Terceros: 0,
                ITBIS_Percibido: 0,
                ISR_Retenido: 0,
                ISR_Percibido: 0,
                Impuesto_Selectivo_Consumo: 0,
                Otros_Impuestos: 0,
                Monto_Propina_Legal: 0,
                Efectivo: sale.paymentMethod === 'cash' ? sale.total : 0,
                Cheque: sale.paymentMethod === 'check' ? sale.total : 0,
                Tarjeta: ['credit_card', 'debit_card'].includes(sale.paymentMethod) ? sale.total : 0,
                Credito: sale.paymentStatus === 'pending' ? sale.total : 0,
                Bonos: 0,
                Permuta: 0,
                Otras_Formas_Venta: sale.paymentMethod === 'bank_transfer' ? sale.total : 0
            };
            records.push(record);
        } else {
            // Aggregate consumer sales
            consumerTotal += sale.total;
            consumerItbis18 += itbis18;
            consumerItbis16 += itbis16;
            consumerExempt += exempt;
            
            if (sale.paymentMethod === 'cash') consumerCash += sale.total;
            else if (['credit_card', 'debit_card'].includes(sale.paymentMethod)) consumerCard += sale.total;
            else if (sale.paymentMethod === 'bank_transfer') consumerTransfer += sale.total;
            else if (sale.paymentStatus === 'pending') consumerCredit += sale.total;
        }
    }
    
    // Add aggregated consumer final record if there are any
    if (consumerTotal > 0) {
        const consumerRecord: DGII607Record = {
            RNC_Cedula: '',
            Tipo_Identificacion: '',
            NCF: '', // B02 series NCF would go here if issued
            NCF_Modificado: '',
            Tipo_Ingreso: '01',
            Fecha_Comprobante: formatDate(endDate),
            Fecha_Retencion: '',
            Monto_Facturado_Servicios: 0,
            Monto_Facturado_Bienes: consumerTotal - consumerItbis18 - consumerItbis16,
            Total_Monto_Facturado: consumerTotal,
            ITBIS_Facturado_18: consumerItbis18,
            ITBIS_Facturado_16: consumerItbis16,
            ITBIS_Facturado_0: consumerExempt,
            ITBIS_Retenido: 0,
            ITBIS_Retenido_Terceros: 0,
            ITBIS_Percibido: 0,
            ISR_Retenido: 0,
            ISR_Percibido: 0,
            Impuesto_Selectivo_Consumo: 0,
            Otros_Impuestos: 0,
            Monto_Propina_Legal: 0,
            Efectivo: consumerCash,
            Cheque: 0,
            Tarjeta: consumerCard,
            Credito: consumerCredit,
            Bonos: 0,
            Permuta: 0,
            Otras_Formas_Venta: consumerTransfer
        };
        records.unshift(consumerRecord); // Add at beginning
    }
    
    return records;
}

/**
 * Generate 607 file content
 */
export async function generate607Content(month: number, year: number): Promise<string> {
    const records = await generate607Records(month, year);
    
    // Generate pipe-delimited content
    const lines = records.map(r => [
        r.RNC_Cedula,
        r.Tipo_Identificacion,
        r.NCF,
        r.NCF_Modificado,
        r.Tipo_Ingreso,
        r.Fecha_Comprobante,
        r.Fecha_Retencion,
        formatAmount(r.Monto_Facturado_Servicios),
        formatAmount(r.Monto_Facturado_Bienes),
        formatAmount(r.Total_Monto_Facturado),
        formatAmount(r.ITBIS_Facturado_18),
        formatAmount(r.ITBIS_Facturado_16),
        formatAmount(r.ITBIS_Facturado_0),
        formatAmount(r.ITBIS_Retenido),
        formatAmount(r.ITBIS_Retenido_Terceros),
        formatAmount(r.ITBIS_Percibido),
        formatAmount(r.ISR_Retenido),
        formatAmount(r.ISR_Percibido),
        formatAmount(r.Impuesto_Selectivo_Consumo),
        formatAmount(r.Otros_Impuestos),
        formatAmount(r.Monto_Propina_Legal),
        formatAmount(r.Efectivo),
        formatAmount(r.Cheque),
        formatAmount(r.Tarjeta),
        formatAmount(r.Credito),
        formatAmount(r.Bonos),
        formatAmount(r.Permuta),
        formatAmount(r.Otras_Formas_Venta)
    ].join('|'));
    
    return lines.join('\n');
}

/**
 * Download 607 file
 */
export function download607(content: string, month: number, year: number): void {
    if (!browser) return;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `607_${year}${String(month).padStart(2, '0')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============ VALIDATION ============

/**
 * Validation issues for 606 record
 */
export interface ValidationIssue {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

/**
 * Validate 606 record
 */
export function validate606Record(record: DGII606Record): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // RNC validation
    if (!record.RNC_Cedula) {
        issues.push({ field: 'RNC_Cedula', message: 'RNC/Cédula is required', severity: 'error' });
    } else if (record.RNC_Cedula.length !== 9 && record.RNC_Cedula.length !== 11) {
        issues.push({ field: 'RNC_Cedula', message: 'RNC should be 9 digits, Cédula should be 11 digits', severity: 'warning' });
    }
    
    // NCF validation
    if (!record.NCF) {
        issues.push({ field: 'NCF', message: 'NCF is required', severity: 'error' });
    } else if (!/^[BbEe][0-9]{10,12}$/.test(record.NCF)) {
        issues.push({ field: 'NCF', message: 'Invalid NCF format', severity: 'error' });
    }
    
    // Date validation
    if (!record.Fecha_Comprobante || record.Fecha_Comprobante.length !== 8) {
        issues.push({ field: 'Fecha_Comprobante', message: 'Date is required (YYYYMMDD)', severity: 'error' });
    }
    
    // Amount validation
    if (record.Total_Monto_Facturado <= 0) {
        issues.push({ field: 'Total_Monto_Facturado', message: 'Total amount must be greater than 0', severity: 'error' });
    }
    
    // ITBIS consistency check
    const calculatedItbis = record.ITBIS_Facturado_18 + record.ITBIS_Facturado_16;
    const subtotal = record.Monto_Facturado_Servicios + record.Monto_Facturado_Bienes;
    const expectedTotal = subtotal + calculatedItbis;
    if (Math.abs(expectedTotal - record.Total_Monto_Facturado) > 1) {
        issues.push({ 
            field: 'Total_Monto_Facturado', 
            message: `Total (${record.Total_Monto_Facturado}) doesn't match subtotal + ITBIS (${expectedTotal.toFixed(2)})`, 
            severity: 'warning' 
        });
    }
    
    return issues;
}

/**
 * Validate all 606 records
 */
export function validate606Records(records: DGII606Record[]): Map<number, ValidationIssue[]> {
    const issues = new Map<number, ValidationIssue[]>();
    
    records.forEach((record, index) => {
        const recordIssues = validate606Record(record);
        if (recordIssues.length > 0) {
            issues.set(index, recordIssues);
        }
    });
    
    return issues;
}

// ============ SUMMARY ============

/**
 * Get summary statistics for 606
 */
export async function get606Summary(month: number, year: number): Promise<{
    recordCount: number;
    totalBienes: number;
    totalServicios: number;
    totalFacturado: number;
    totalItbis18: number;
    totalItbis16: number;
    totalItbis: number;
}> {
    const records = await generate606Records(month, year);
    
    return {
        recordCount: records.length,
        totalBienes: records.reduce((sum, r) => sum + r.Monto_Facturado_Bienes, 0),
        totalServicios: records.reduce((sum, r) => sum + r.Monto_Facturado_Servicios, 0),
        totalFacturado: records.reduce((sum, r) => sum + r.Total_Monto_Facturado, 0),
        totalItbis18: records.reduce((sum, r) => sum + r.ITBIS_Facturado_18, 0),
        totalItbis16: records.reduce((sum, r) => sum + r.ITBIS_Facturado_16, 0),
        totalItbis: records.reduce((sum, r) => sum + r.ITBIS_Facturado_18 + r.ITBIS_Facturado_16, 0)
    };
}

/**
 * Get summary statistics for 607
 */
export async function get607Summary(month: number, year: number): Promise<{
    recordCount: number;
    totalBienes: number;
    totalServicios: number;
    totalFacturado: number;
    totalItbis18: number;
    totalItbis16: number;
    totalItbis: number;
    totalEfectivo: number;
    totalTarjeta: number;
    totalCredito: number;
}> {
    const records = await generate607Records(month, year);
    
    return {
        recordCount: records.length,
        totalBienes: records.reduce((sum, r) => sum + r.Monto_Facturado_Bienes, 0),
        totalServicios: records.reduce((sum, r) => sum + r.Monto_Facturado_Servicios, 0),
        totalFacturado: records.reduce((sum, r) => sum + r.Total_Monto_Facturado, 0),
        totalItbis18: records.reduce((sum, r) => sum + r.ITBIS_Facturado_18, 0),
        totalItbis16: records.reduce((sum, r) => sum + r.ITBIS_Facturado_16, 0),
        totalItbis: records.reduce((sum, r) => sum + r.ITBIS_Facturado_18 + r.ITBIS_Facturado_16, 0),
        totalEfectivo: records.reduce((sum, r) => sum + r.Efectivo, 0),
        totalTarjeta: records.reduce((sum, r) => sum + r.Tarjeta, 0),
        totalCredito: records.reduce((sum, r) => sum + r.Credito, 0)
    };
}

