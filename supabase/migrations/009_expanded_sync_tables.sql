-- ============================================================
-- Migration: Expanded Sync Tables for Full Data Synchronization
-- ============================================================
-- This migration adds all remaining tables needed to enable
-- full synchronization of all app data across devices.
-- ============================================================

-- ============================================================
-- SHIFTS TABLE (Cash register shifts)
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    local_id INTEGER NOT NULL,              -- Maps to Dexie ++id
    shift_number INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    cashier_id INTEGER,                     -- Local user ID
    cashier_name TEXT,
    opening_cash DECIMAL(12,2) DEFAULT 0,
    closing_cash DECIMAL(12,2),
    expected_cash DECIMAL(12,2),
    cash_difference DECIMAL(12,2),
    total_sales DECIMAL(12,2) DEFAULT 0,
    total_returns DECIMAL(12,2) DEFAULT 0,
    total_cash_sales DECIMAL(12,2) DEFAULT 0,
    total_card_sales DECIMAL(12,2) DEFAULT 0,
    total_transfer_sales DECIMAL(12,2) DEFAULT 0,
    total_credit_sales DECIMAL(12,2) DEFAULT 0,
    transactions_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_store ON shifts(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_store_local_unique ON shifts(store_id, local_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(store_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_opened ON shifts(store_id, opened_at);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_all_policy" ON shifts FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INVENTORY LOTS (FIFO Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
    purchase_date TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    unit_cost DECIMAL(12,4) NOT NULL,
    cost_includes_tax BOOLEAN DEFAULT TRUE,
    tax_rate DECIMAL(5,4),
    expiration_date TEXT,
    batch_number TEXT,
    status TEXT NOT NULL CHECK (status IN ('available', 'depleted', 'expired')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_store ON inventory_lots(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_product ON inventory_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_status ON inventory_lots(store_id, product_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_expiration ON inventory_lots(expiration_date) WHERE expiration_date IS NOT NULL;

ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_lots_all_policy" ON inventory_lots FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_inventory_lots_updated_at BEFORE UPDATE ON inventory_lots 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COST CONSUMPTIONS (FIFO Consumption Records)
-- ============================================================
CREATE TABLE IF NOT EXISTS cost_consumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES inventory_lots(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    return_id UUID REFERENCES returns(id) ON DELETE SET NULL,
    adjustment_id UUID,
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(12,4) NOT NULL,
    total_cost DECIMAL(12,4) NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sale', 'return', 'adjustment', 'loss')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_consumptions_store ON cost_consumptions(store_id);
CREATE INDEX IF NOT EXISTS idx_cost_consumptions_lot ON cost_consumptions(lot_id);
CREATE INDEX IF NOT EXISTS idx_cost_consumptions_product ON cost_consumptions(product_id);
CREATE INDEX IF NOT EXISTS idx_cost_consumptions_sale ON cost_consumptions(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cost_consumptions_date ON cost_consumptions(store_id, date);

ALTER TABLE cost_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_consumptions_all_policy" ON cost_consumptions FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_cost_consumptions_updated_at BEFORE UPDATE ON cost_consumptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- JOURNAL ENTRIES (Accounting Journal)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('sale', 'purchase', 'payment', 'return', 'adjustment', 'settlement', 'manual')),
    source_id UUID,
    shift_id INTEGER,
    debit_account TEXT NOT NULL,
    credit_account TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'DOP',
    status TEXT NOT NULL CHECK (status IN ('pending', 'posted', 'voided')),
    posted_by INTEGER,
    posted_at TIMESTAMPTZ,
    voided_by INTEGER,
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_store ON journal_entries(store_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(store_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(store_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(store_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_number ON journal_entries(store_id, entry_number);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries_all_policy" ON journal_entries FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ITBIS SUMMARIES (Tax Period Summaries)
-- ============================================================
CREATE TABLE IF NOT EXISTS itbis_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    period TEXT NOT NULL,               -- YYYY-MM format
    itbis_collected DECIMAL(12,2) DEFAULT 0,
    itbis_paid DECIMAL(12,2) DEFAULT 0,
    itbis_balance DECIMAL(12,2) DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'filed')),
    filed_at TIMESTAMPTZ,
    filed_by INTEGER,
    declaration_number TEXT,
    notes TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itbis_summaries_store ON itbis_summaries(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_itbis_summaries_period ON itbis_summaries(store_id, period);
CREATE INDEX IF NOT EXISTS idx_itbis_summaries_status ON itbis_summaries(store_id, status);

ALTER TABLE itbis_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itbis_summaries_all_policy" ON itbis_summaries FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_itbis_summaries_updated_at BEFORE UPDATE ON itbis_summaries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CARD SETTLEMENTS (Credit/Debit Card Batch Settlements)
-- ============================================================
CREATE TABLE IF NOT EXISTS card_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    settlement_date TEXT NOT NULL,
    bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
    processor TEXT,                     -- e.g., 'VISANET', 'CARDNET'
    batch_number TEXT,
    terminal_id TEXT,
    gross_amount DECIMAL(12,2) NOT NULL,
    commission DECIMAL(12,2) DEFAULT 0,
    tax_on_commission DECIMAL(12,2) DEFAULT 0,
    net_amount DECIMAL(12,2) NOT NULL,
    transactions_count INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'reconciled', 'disputed')),
    journal_entry_id UUID,
    deposit_date TEXT,
    deposit_reference TEXT,
    notes TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_settlements_store ON card_settlements(store_id);
CREATE INDEX IF NOT EXISTS idx_card_settlements_date ON card_settlements(store_id, settlement_date);
CREATE INDEX IF NOT EXISTS idx_card_settlements_status ON card_settlements(store_id, status);
CREATE INDEX IF NOT EXISTS idx_card_settlements_bank ON card_settlements(bank_account_id);

ALTER TABLE card_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_settlements_all_policy" ON card_settlements FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_card_settlements_updated_at BEFORE UPDATE ON card_settlements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- NCF RANGES (Fiscal Number Ranges)
-- ============================================================
CREATE TABLE IF NOT EXISTS ncf_ranges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                 -- e.g., 'B01', 'B02', 'B14', 'B15'
    prefix TEXT NOT NULL,
    start_number INTEGER NOT NULL,
    end_number INTEGER NOT NULL,
    current_number INTEGER NOT NULL,
    authorization_date TEXT,
    expiration_date TEXT,
    resolution_number TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ncf_ranges_store ON ncf_ranges(store_id);
CREATE INDEX IF NOT EXISTS idx_ncf_ranges_type ON ncf_ranges(store_id, type);
CREATE INDEX IF NOT EXISTS idx_ncf_ranges_active ON ncf_ranges(store_id, is_active);

ALTER TABLE ncf_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ncf_ranges_all_policy" ON ncf_ranges FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_ncf_ranges_updated_at BEFORE UPDATE ON ncf_ranges 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- NCF USAGE (Fiscal Number Usage Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS ncf_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    ncf TEXT NOT NULL,
    type TEXT NOT NULL,
    range_id UUID REFERENCES ncf_ranges(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_rnc TEXT,
    amount DECIMAL(12,2),
    itbis DECIMAL(12,2),
    issued_at TIMESTAMPTZ NOT NULL,
    voided BOOLEAN DEFAULT FALSE,
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ncf_usage_store ON ncf_usage(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ncf_usage_ncf ON ncf_usage(store_id, ncf);
CREATE INDEX IF NOT EXISTS idx_ncf_usage_type ON ncf_usage(store_id, type);
CREATE INDEX IF NOT EXISTS idx_ncf_usage_sale ON ncf_usage(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ncf_usage_issued ON ncf_usage(store_id, issued_at);

ALTER TABLE ncf_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ncf_usage_all_policy" ON ncf_usage FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_ncf_usage_updated_at BEFORE UPDATE ON ncf_usage 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ACCOUNTING AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS accounting_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action TEXT NOT NULL,               -- e.g., 'create', 'update', 'delete', 'void'
    entity_type TEXT NOT NULL,          -- e.g., 'journal_entry', 'settlement', 'inventory_lot'
    entity_id UUID NOT NULL,
    user_id INTEGER,
    user_name TEXT,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_audit_store ON accounting_audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_timestamp ON accounting_audit_log(store_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_entity ON accounting_audit_log(store_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_user ON accounting_audit_log(store_id, user_id);

ALTER TABLE accounting_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_audit_log_all_policy" ON accounting_audit_log FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_accounting_audit_log_updated_at BEFORE UPDATE ON accounting_audit_log 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RECEIPT SETTINGS (POS Ticket Configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS receipt_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    business_name TEXT,
    business_rnc TEXT,
    business_address TEXT,
    business_phone TEXT,
    business_email TEXT,
    header_text TEXT,
    footer_text TEXT,
    show_logo BOOLEAN DEFAULT TRUE,
    logo_url TEXT,
    paper_width INTEGER DEFAULT 80,     -- mm
    font_size INTEGER DEFAULT 12,
    show_item_sku BOOLEAN DEFAULT FALSE,
    show_cashier BOOLEAN DEFAULT TRUE,
    show_customer BOOLEAN DEFAULT TRUE,
    include_itbis_detail BOOLEAN DEFAULT TRUE,
    additional_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_settings_store ON receipt_settings(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_settings_store_unique ON receipt_settings(store_id);

ALTER TABLE receipt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipt_settings_all_policy" ON receipt_settings FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_receipt_settings_updated_at BEFORE UPDATE ON receipt_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRANSACTION FEATURES (ML/Analytics Features)
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    local_id INTEGER,                   -- Maps to Dexie ++id if needed
    timestamp TIMESTAMPTZ NOT NULL,
    hour_of_day INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    item_count INTEGER,
    shift_id INTEGER,
    cashier_id INTEGER,
    customer_type TEXT,
    payment_method TEXT,
    features JSONB,                     -- Additional ML features
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_features_store ON transaction_features(store_id);
CREATE INDEX IF NOT EXISTS idx_transaction_features_timestamp ON transaction_features(store_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_transaction_features_hour ON transaction_features(store_id, hour_of_day);
CREATE INDEX IF NOT EXISTS idx_transaction_features_day ON transaction_features(store_id, day_of_week);

ALTER TABLE transaction_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_features_all_policy" ON transaction_features FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_transaction_features_updated_at BEFORE UPDATE ON transaction_features 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- REAL TIME INSIGHTS (AI-Generated Insights Cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS real_time_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    local_id INTEGER,                   -- Maps to Dexie ++id if needed
    insight_type TEXT NOT NULL,         -- e.g., 'sales_anomaly', 'stock_alert', 'trend'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
    category TEXT,
    data JSONB,
    action_items JSONB,
    confidence_score DECIMAL(5,4),
    expires_at TIMESTAMPTZ,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_time_insights_store ON real_time_insights(store_id);
CREATE INDEX IF NOT EXISTS idx_real_time_insights_type ON real_time_insights(store_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_real_time_insights_expires ON real_time_insights(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_real_time_insights_created ON real_time_insights(store_id, created_at);

ALTER TABLE real_time_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "real_time_insights_all_policy" ON real_time_insights FOR ALL
    USING (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL)
    WITH CHECK (store_id::text = current_setting('app.store_id', true) OR current_setting('app.store_id', true) IS NULL);

CREATE TRIGGER update_real_time_insights_updated_at BEFORE UPDATE ON real_time_insights 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SYNC LOG UPDATE: Allow new table names
-- ============================================================
-- Update the check constraint on sync_log to allow new table names
-- (The existing constraint might be too restrictive)
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_action_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_action_check 
    CHECK (action IN ('insert', 'update', 'delete'));

-- ============================================================
-- SUMMARY
-- ============================================================
-- Tables added:
-- 1. shifts - Cash register shifts
-- 2. inventory_lots - FIFO inventory tracking
-- 3. cost_consumptions - FIFO cost consumption records
-- 4. journal_entries - Accounting journal
-- 5. itbis_summaries - Tax period summaries
-- 6. card_settlements - Card batch settlements
-- 7. ncf_ranges - Fiscal number ranges
-- 8. ncf_usage - Fiscal number usage log
-- 9. accounting_audit_log - Audit trail
-- 10. receipt_settings - POS ticket configuration
-- 11. transaction_features - ML/Analytics features
-- 12. real_time_insights - AI insights cache
--
-- All tables have:
-- - store_id for multi-tenant isolation
-- - RLS policies for security
-- - updated_at triggers for sync tracking
-- - Appropriate indexes for performance

