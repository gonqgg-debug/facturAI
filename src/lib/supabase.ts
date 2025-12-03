/**
 * Supabase Client Configuration
 * 
 * This module initializes the Supabase client for sync operations.
 * The client is used by the sync service to push/pull data from the cloud.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

// ============================================================
// ENVIRONMENT CONFIGURATION
// ============================================================

const SUPABASE_URL = browser ? import.meta.env.VITE_SUPABASE_URL : '';
const SUPABASE_ANON_KEY = browser ? import.meta.env.VITE_SUPABASE_ANON_KEY : '';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Database types matching our Supabase schema
 * These types provide type safety for database operations
 */
export interface Database {
    public: {
        Tables: {
            stores: {
                Row: {
                    id: string;
                    name: string;
                    owner_email: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['stores']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['stores']['Insert']>;
            };
            devices: {
                Row: {
                    id: string;
                    store_id: string;
                    device_token: string;
                    device_name: string | null;
                    device_type: string | null;
                    user_agent: string | null;
                    last_sync_at: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['devices']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['devices']['Insert']>;
            };
            pairing_codes: {
                Row: {
                    id: string;
                    store_id: string;
                    code: string;
                    expires_at: string;
                    used_at: string | null;
                    used_by_device_id: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['pairing_codes']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['pairing_codes']['Insert']>;
            };
            suppliers: {
                Row: {
                    id: string;
                    store_id: string;
                    name: string;
                    rnc: string | null;
                    alias: string[] | null;
                    custom_rules: string | null;
                    examples: unknown;
                    default_credit_days: number | null;
                    supplier_type: 'individual' | 'company' | null;
                    taxpayer_type: string | null;
                    phone: string | null;
                    mobile: string | null;
                    email: string | null;
                    contact_person: string | null;
                    contact_phone: string | null;
                    address: string | null;
                    address2: string | null;
                    city: string | null;
                    state: string | null;
                    postal_code: string | null;
                    country: string | null;
                    website: string | null;
                    notes: string | null;
                    tags: string[] | null;
                    category: 'Distributor' | 'Manufacturer' | 'Wholesaler' | 'Service' | 'Other' | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['suppliers']['Insert']>;
            };
            products: {
                Row: {
                    id: string;
                    store_id: string;
                    product_id: string | null;
                    barcode: string | null;
                    supplier_id: string | null;
                    name: string;
                    aliases: string[] | null;
                    category: string | null;
                    last_price: number;
                    last_date: string | null;
                    average_cost: number | null;
                    cost_includes_tax: boolean;
                    cost_tax_rate: number | null;
                    selling_price: number | null;
                    price_includes_tax: boolean;
                    tax_rate: number | null;
                    is_exempt: boolean;
                    target_margin: number | null;
                    current_stock: number;
                    reorder_point: number | null;
                    last_stock_update: string | null;
                    sales_volume: number;
                    sales_velocity: number | null;
                    last_sale_date: string | null;
                    ai_suggested_price: number | null;
                    ai_suggested_margin: number | null;
                    ai_reasoning: string | null;
                    ai_analyst_rating: 'BUY' | 'SELL' | 'HOLD' | null;
                    ai_creative_idea: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['products']['Insert']>;
            };
            customers: {
                Row: {
                    id: string;
                    store_id: string;
                    name: string;
                    type: 'retail' | 'wholesale' | 'corporate';
                    rnc: string | null;
                    phone: string | null;
                    email: string | null;
                    address: string | null;
                    credit_limit: number | null;
                    current_balance: number;
                    is_active: boolean;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['customers']['Insert']>;
            };
            sales: {
                Row: {
                    id: string;
                    store_id: string;
                    date: string;
                    customer_id: string | null;
                    customer_name: string | null;
                    items: unknown;
                    subtotal: number;
                    discount: number;
                    itbis_total: number;
                    total: number;
                    payment_method: string;
                    payment_status: 'pending' | 'partial' | 'paid';
                    paid_amount: number;
                    shift_id: number | null;
                    receipt_number: string | null;
                    cashier_id: number | null;
                    cashier_name: string | null;
                    has_returns: boolean;
                    returned_amount: number | null;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['sales']['Insert']>;
            };
            invoices: {
                Row: {
                    id: string;
                    store_id: string;
                    provider_name: string;
                    provider_rnc: string | null;
                    client_name: string | null;
                    client_rnc: string | null;
                    issue_date: string;
                    due_date: string | null;
                    ncf: string;
                    currency: 'DOP' | 'USD';
                    items: unknown;
                    subtotal: number;
                    discount: number;
                    itbis_total: number;
                    total: number;
                    raw_text: string | null;
                    image_url: string | null;
                    status: 'draft' | 'verified' | 'exported' | 'needs_extraction';
                    category: 'Inventory' | 'Utilities' | 'Maintenance' | 'Payroll' | 'Other' | null;
                    security_code: string | null;
                    is_ecf: boolean | null;
                    qr_url: string | null;
                    reasoning: string | null;
                    payment_status: 'pending' | 'partial' | 'paid' | 'overdue' | null;
                    paid_date: string | null;
                    paid_amount: number | null;
                    credit_days: number | null;
                    receipt_id: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
            };
            payments: {
                Row: {
                    id: string;
                    store_id: string;
                    invoice_id: string | null;
                    sale_id: string | null;
                    return_id: string | null;
                    supplier_id: string | null;
                    customer_id: string | null;
                    amount: number;
                    currency: 'DOP' | 'USD';
                    payment_date: string;
                    payment_method: string;
                    bank_account_id: string | null;
                    check_number: string | null;
                    reference_number: string | null;
                    is_refund: boolean;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['payments']['Insert']>;
            };
            returns: {
                Row: {
                    id: string;
                    store_id: string;
                    date: string;
                    original_sale_id: string;
                    original_receipt_number: string | null;
                    customer_id: string | null;
                    customer_name: string | null;
                    items: unknown;
                    subtotal: number;
                    itbis_total: number;
                    total: number;
                    refund_method: string;
                    refund_status: 'pending' | 'completed';
                    reason: 'defective' | 'wrong_item' | 'customer_changed_mind' | 'damaged' | 'expired' | 'other';
                    reason_notes: string | null;
                    shift_id: number | null;
                    processed_by: number | null;
                    processed_by_name: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['returns']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['returns']['Insert']>;
            };
            bank_accounts: {
                Row: {
                    id: string;
                    store_id: string;
                    bank_name: string;
                    account_name: string;
                    account_number: string;
                    account_type: 'checking' | 'savings' | 'credit';
                    currency: 'DOP' | 'USD';
                    is_default: boolean;
                    is_active: boolean;
                    color: string | null;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['bank_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['bank_accounts']['Insert']>;
            };
            stock_movements: {
                Row: {
                    id: string;
                    store_id: string;
                    product_id: string;
                    type: 'in' | 'out' | 'adjustment' | 'return';
                    quantity: number;
                    invoice_id: string | null;
                    receipt_id: string | null;
                    sale_id: string | null;
                    return_id: string | null;
                    date: string;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['stock_movements']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['stock_movements']['Insert']>;
            };
            purchase_orders: {
                Row: {
                    id: string;
                    store_id: string;
                    po_number: string;
                    supplier_id: string;
                    supplier_name: string | null;
                    order_date: string;
                    expected_date: string | null;
                    status: 'draft' | 'sent' | 'partial' | 'received' | 'closed' | 'cancelled';
                    items: unknown;
                    subtotal: number;
                    itbis_total: number;
                    total: number;
                    notes: string | null;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>;
            };
            receipts: {
                Row: {
                    id: string;
                    store_id: string;
                    receipt_number: string;
                    purchase_order_id: string | null;
                    supplier_id: string;
                    supplier_name: string | null;
                    receipt_date: string;
                    invoice_id: string | null;
                    items: unknown;
                    total: number;
                    notes: string | null;
                    received_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['receipts']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['receipts']['Insert']>;
            };
            rules: {
                Row: {
                    id: string;
                    store_id: string;
                    supplier_id: string;
                    rule: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['rules']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['rules']['Insert']>;
            };
            global_context: {
                Row: {
                    id: string;
                    store_id: string;
                    title: string;
                    content: string;
                    type: 'text' | 'file';
                    category: 'tax' | 'conversion' | 'business_logic' | 'pricing_rule' | null;
                    file_name: string | null;
                    file_type: 'pdf' | 'excel' | 'txt' | null;
                    usage_count: number;
                    last_used: string | null;
                    tags: string[] | null;
                    favorite: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['global_context']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['global_context']['Insert']>;
            };
            customer_segments: {
                Row: {
                    id: string;
                    store_id: string;
                    segment_id: string;
                    segment_name: string;
                    segment_type: string | null;
                    confidence_score: number | null;
                    data: unknown;
                    last_updated: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['customer_segments']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['customer_segments']['Insert']>;
            };
            weather_records: {
                Row: {
                    id: string;
                    store_id: string;
                    date: string;
                    condition: string | null;
                    precipitation_level: string | null;
                    location: string | null;
                    data: unknown;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['weather_records']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['weather_records']['Insert']>;
            };
            sync_log: {
                Row: {
                    id: number;
                    store_id: string;
                    device_id: string | null;
                    table_name: string;
                    record_id: string;
                    action: 'insert' | 'update' | 'delete';
                    data: unknown;
                    synced_at: string;
                };
                Insert: Omit<Database['public']['Tables']['sync_log']['Row'], 'id'>;
                Update: Partial<Database['public']['Tables']['sync_log']['Insert']>;
            };
        };
    };
}

// ============================================================
// CLIENT INSTANCE
// ============================================================

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Get the Supabase client instance
 * Returns null if not in browser or not configured
 */
export function getSupabase(): SupabaseClient<Database> | null {
    if (!browser) return null;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('[Supabase] NOT CONFIGURED!');
        console.error('[Supabase] VITE_SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
        console.error('[Supabase] VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
        return null;
    }
    
    if (!supabaseInstance) {
        console.log('[Supabase] Creating client for:', SUPABASE_URL);
        supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false, // We handle our own device tokens
                autoRefreshToken: false
            }
        });
    }
    
    return supabaseInstance;
}

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseConfigured(): boolean {
    return browser && !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

// ============================================================
// TABLE NAME MAPPING
// ============================================================

/**
 * Mapping between Dexie table names and Supabase table names
 * Dexie uses camelCase, Supabase uses snake_case
 */
export const TABLE_NAME_MAP: Record<string, keyof Database['public']['Tables']> = {
    'suppliers': 'suppliers',
    'products': 'products',
    'customers': 'customers',
    'sales': 'sales',
    'invoices': 'invoices',
    'payments': 'payments',
    'returns': 'returns',
    'bankAccounts': 'bank_accounts',
    'stockMovements': 'stock_movements',
    'purchaseOrders': 'purchase_orders',
    'receipts': 'receipts',
    'rules': 'rules',
    'globalContext': 'global_context',
    'customerSegments': 'customer_segments',
    'weatherRecords': 'weather_records'
};

/**
 * List of tables that should be synced
 */
export const SYNCED_TABLES = Object.keys(TABLE_NAME_MAP);

/**
 * Get Supabase table name from Dexie table name
 */
export function getSupabaseTableName(dexieTableName: string): keyof Database['public']['Tables'] | null {
    return TABLE_NAME_MAP[dexieTableName] || null;
}

