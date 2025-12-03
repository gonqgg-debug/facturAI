-- ============================================================
-- Supabase Migration: Initial Schema for Mini Market POS
-- ============================================================
-- This schema mirrors the Dexie.js local database structure
-- with added fields for multi-tenant support and sync tracking.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DEVICE MANAGEMENT TABLES
-- ============================================================

-- Stores table: Each store/business is a tenant
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices table: Registered devices for each store
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    device_token TEXT UNIQUE NOT NULL,
    device_name TEXT,
    device_type TEXT, -- 'browser', 'mobile', 'desktop'
    user_agent TEXT,
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pairing codes for device registration
CREATE TABLE pairing_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by_device_id UUID REFERENCES devices(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for quick code lookup
CREATE INDEX idx_pairing_codes_code ON pairing_codes(code) WHERE used_at IS NULL;

-- ============================================================
-- BUSINESS DATA TABLES
-- ============================================================

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rnc TEXT,
    alias TEXT[], -- Array of alternative names
    custom_rules TEXT,
    examples JSONB DEFAULT '[]'::jsonb, -- Invoice examples
    default_credit_days INTEGER,
    supplier_type TEXT CHECK (supplier_type IN ('individual', 'company')),
    taxpayer_type TEXT,
    phone TEXT,
    mobile TEXT,
    email TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    address TEXT,
    address2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    website TEXT,
    notes TEXT,
    tags TEXT[],
    category TEXT CHECK (category IN ('Distributor', 'Manufacturer', 'Wholesaler', 'Service', 'Other')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id TEXT, -- Custom SKU
    barcode TEXT,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    aliases TEXT[],
    category TEXT,
    last_price DECIMAL(12,2) DEFAULT 0,
    last_date TEXT,
    average_cost DECIMAL(12,2),
    cost_includes_tax BOOLEAN DEFAULT TRUE,
    cost_tax_rate DECIMAL(5,4),
    selling_price DECIMAL(12,2),
    price_includes_tax BOOLEAN DEFAULT TRUE,
    tax_rate DECIMAL(5,4),
    is_exempt BOOLEAN DEFAULT FALSE,
    target_margin DECIMAL(5,4),
    current_stock INTEGER DEFAULT 0,
    reorder_point INTEGER,
    last_stock_update TEXT,
    sales_volume INTEGER DEFAULT 0,
    sales_velocity DECIMAL(10,4),
    last_sale_date TEXT,
    ai_suggested_price DECIMAL(12,2),
    ai_suggested_margin DECIMAL(5,4),
    ai_reasoning TEXT,
    ai_analyst_rating TEXT CHECK (ai_analyst_rating IN ('BUY', 'SELL', 'HOLD')),
    ai_creative_idea TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('retail', 'wholesale', 'corporate')),
    rnc TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    credit_limit DECIMAL(12,2),
    current_balance DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Accounts
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit')),
    currency TEXT NOT NULL CHECK (currency IN ('DOP', 'USD')),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    color TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices (Purchase Invoices from suppliers)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL,
    provider_rnc TEXT,
    client_name TEXT,
    client_rnc TEXT,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    ncf TEXT NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('DOP', 'USD')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    itbis_total DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    raw_text TEXT,
    image_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'verified', 'exported', 'needs_extraction')),
    category TEXT CHECK (category IN ('Inventory', 'Utilities', 'Maintenance', 'Payroll', 'Other')),
    security_code TEXT,
    is_ecf BOOLEAN,
    qr_url TEXT,
    reasoning TEXT,
    payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
    paid_date TEXT,
    paid_amount DECIMAL(12,2),
    credit_days INTEGER,
    receipt_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    itbis_total DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'partial', 'paid')),
    paid_amount DECIMAL(12,2) DEFAULT 0,
    shift_id INTEGER, -- Local shift reference
    receipt_number TEXT,
    cashier_id INTEGER, -- Local user reference
    cashier_name TEXT,
    has_returns BOOLEAN DEFAULT FALSE,
    returned_amount DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    return_id UUID,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('DOP', 'USD')),
    payment_date TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
    check_number TEXT,
    reference_number TEXT,
    is_refund BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Returns
CREATE TABLE returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    original_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    original_receipt_number TEXT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) NOT NULL,
    itbis_total DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    refund_method TEXT NOT NULL,
    refund_status TEXT NOT NULL CHECK (refund_status IN ('pending', 'completed')),
    reason TEXT NOT NULL CHECK (reason IN ('defective', 'wrong_item', 'customer_changed_mind', 'damaged', 'expired', 'other')),
    reason_notes TEXT,
    shift_id INTEGER,
    processed_by INTEGER,
    processed_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Movements
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'return')),
    quantity INTEGER NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    receipt_id UUID,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    return_id UUID REFERENCES returns(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_name TEXT,
    order_date TEXT NOT NULL,
    expected_date TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'partial', 'received', 'closed', 'cancelled')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) NOT NULL,
    itbis_total DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts (Goods Received)
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_name TEXT,
    receipt_date TEXT NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total DECIMAL(12,2) NOT NULL,
    notes TEXT,
    received_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Base Rules
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    rule TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global Context Items
CREATE TABLE global_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'file')),
    category TEXT CHECK (category IN ('tax', 'conversion', 'business_logic', 'pricing_rule')),
    file_name TEXT,
    file_type TEXT CHECK (file_type IN ('pdf', 'excel', 'txt')),
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    tags TEXT[],
    favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Segments (AI insights)
CREATE TABLE customer_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL,
    segment_name TEXT NOT NULL,
    segment_type TEXT,
    confidence_score DECIMAL(5,4),
    data JSONB,
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather Records
CREATE TABLE weather_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    condition TEXT,
    precipitation_level TEXT,
    location TEXT,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYNC TRACKING
-- ============================================================

-- Sync log for tracking changes
CREATE TABLE sync_log (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    data JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient sync queries
CREATE INDEX idx_sync_log_store_time ON sync_log(store_id, synced_at DESC);
CREATE INDEX idx_sync_log_table ON sync_log(store_id, table_name, synced_at DESC);

-- ============================================================
-- INDEXES FOR COMMON QUERIES
-- ============================================================

-- Store-based indexes for all business tables
CREATE INDEX idx_suppliers_store ON suppliers(store_id);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_barcode ON products(store_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_customers_store ON customers(store_id);
CREATE INDEX idx_bank_accounts_store ON bank_accounts(store_id);
CREATE INDEX idx_invoices_store ON invoices(store_id);
CREATE INDEX idx_invoices_date ON invoices(store_id, issue_date);
CREATE INDEX idx_sales_store ON sales(store_id);
CREATE INDEX idx_sales_date ON sales(store_id, date);
CREATE INDEX idx_payments_store ON payments(store_id);
CREATE INDEX idx_returns_store ON returns(store_id);
CREATE INDEX idx_stock_movements_store ON stock_movements(store_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_purchase_orders_store ON purchase_orders(store_id);
CREATE INDEX idx_receipts_store ON receipts(store_id);
CREATE INDEX idx_rules_store ON rules(store_id);
CREATE INDEX idx_global_context_store ON global_context(store_id);
CREATE INDEX idx_devices_store ON devices(store_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all business tables
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON returns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_movements_updated_at BEFORE UPDATE ON stock_movements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_global_context_updated_at BEFORE UPDATE ON global_context FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- HELPER FUNCTIONS FOR SYNC
-- ============================================================

-- Function to get changes since a timestamp for a specific store
CREATE OR REPLACE FUNCTION get_changes_since(
    p_store_id UUID,
    p_since TIMESTAMPTZ,
    p_table_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    table_name TEXT,
    record_id UUID,
    action TEXT,
    data JSONB,
    synced_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.table_name,
        sl.record_id,
        sl.action,
        sl.data,
        sl.synced_at
    FROM sync_log sl
    WHERE sl.store_id = p_store_id
      AND sl.synced_at > p_since
      AND (p_table_name IS NULL OR sl.table_name = p_table_name)
    ORDER BY sl.synced_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to log a sync operation
CREATE OR REPLACE FUNCTION log_sync_operation(
    p_store_id UUID,
    p_device_id UUID,
    p_table_name TEXT,
    p_record_id UUID,
    p_action TEXT,
    p_data JSONB
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO sync_log (store_id, device_id, table_name, record_id, action, data)
    VALUES (p_store_id, p_device_id, p_table_name, p_record_id, p_action, p_data)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INITIAL DATA
-- ============================================================

-- This will be populated when the first device registers
-- No initial data needed here

