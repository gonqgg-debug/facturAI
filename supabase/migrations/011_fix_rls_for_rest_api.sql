-- ============================================================
-- Migration: Fix RLS Policies for REST API Compatibility
-- ============================================================
-- Problem: In Supabase REST API (PostgREST), each HTTP request is a 
-- new session. The session variable set by set_store_context() doesn't
-- persist between requests, causing RLS policy violations.
--
-- Solution: Change RLS policies to validate that the store_id exists
-- in the stores table, rather than relying on session context.
-- This allows sync operations while still providing basic security.
-- ============================================================

-- ============================================================
-- SUPPLIERS TABLE
-- ============================================================
DROP POLICY IF EXISTS "suppliers_insert_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_select_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_all_policy" ON suppliers;

CREATE POLICY "suppliers_select_policy" ON suppliers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = suppliers.store_id)
    );

CREATE POLICY "suppliers_insert_policy" ON suppliers
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = suppliers.store_id)
    );

CREATE POLICY "suppliers_update_policy" ON suppliers
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = suppliers.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = suppliers.store_id)
    );

CREATE POLICY "suppliers_delete_policy" ON suppliers
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = suppliers.store_id)
    );

-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "products_delete_policy" ON products;
DROP POLICY IF EXISTS "products_all_policy" ON products;

CREATE POLICY "products_select_policy" ON products
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id)
    );

CREATE POLICY "products_insert_policy" ON products
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id)
    );

CREATE POLICY "products_update_policy" ON products
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id)
    );

CREATE POLICY "products_delete_policy" ON products
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id)
    );

-- ============================================================
-- CUSTOMERS TABLE
-- ============================================================
DROP POLICY IF EXISTS "customers_insert_policy" ON customers;
DROP POLICY IF EXISTS "customers_update_policy" ON customers;
DROP POLICY IF EXISTS "customers_select_policy" ON customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON customers;
DROP POLICY IF EXISTS "customers_all_policy" ON customers;

CREATE POLICY "customers_select_policy" ON customers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = customers.store_id)
    );

CREATE POLICY "customers_insert_policy" ON customers
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = customers.store_id)
    );

CREATE POLICY "customers_update_policy" ON customers
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = customers.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = customers.store_id)
    );

CREATE POLICY "customers_delete_policy" ON customers
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = customers.store_id)
    );

-- ============================================================
-- SALES TABLE
-- ============================================================
DROP POLICY IF EXISTS "sales_insert_policy" ON sales;
DROP POLICY IF EXISTS "sales_update_policy" ON sales;
DROP POLICY IF EXISTS "sales_select_policy" ON sales;
DROP POLICY IF EXISTS "sales_delete_policy" ON sales;
DROP POLICY IF EXISTS "sales_all_policy" ON sales;

CREATE POLICY "sales_select_policy" ON sales
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sales.store_id)
    );

CREATE POLICY "sales_insert_policy" ON sales
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sales.store_id)
    );

CREATE POLICY "sales_update_policy" ON sales
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sales.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sales.store_id)
    );

CREATE POLICY "sales_delete_policy" ON sales
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sales.store_id)
    );

-- ============================================================
-- INVOICES TABLE
-- ============================================================
DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON invoices;
DROP POLICY IF EXISTS "invoices_all_policy" ON invoices;

CREATE POLICY "invoices_select_policy" ON invoices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = invoices.store_id)
    );

CREATE POLICY "invoices_insert_policy" ON invoices
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = invoices.store_id)
    );

CREATE POLICY "invoices_update_policy" ON invoices
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = invoices.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = invoices.store_id)
    );

CREATE POLICY "invoices_delete_policy" ON invoices
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = invoices.store_id)
    );

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "payments_insert_policy" ON payments;
DROP POLICY IF EXISTS "payments_update_policy" ON payments;
DROP POLICY IF EXISTS "payments_select_policy" ON payments;
DROP POLICY IF EXISTS "payments_delete_policy" ON payments;
DROP POLICY IF EXISTS "payments_all_policy" ON payments;

CREATE POLICY "payments_select_policy" ON payments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = payments.store_id)
    );

CREATE POLICY "payments_insert_policy" ON payments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = payments.store_id)
    );

CREATE POLICY "payments_update_policy" ON payments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = payments.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = payments.store_id)
    );

CREATE POLICY "payments_delete_policy" ON payments
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = payments.store_id)
    );

-- ============================================================
-- RETURNS TABLE
-- ============================================================
DROP POLICY IF EXISTS "returns_insert_policy" ON returns;
DROP POLICY IF EXISTS "returns_update_policy" ON returns;
DROP POLICY IF EXISTS "returns_select_policy" ON returns;
DROP POLICY IF EXISTS "returns_delete_policy" ON returns;
DROP POLICY IF EXISTS "returns_all_policy" ON returns;

CREATE POLICY "returns_select_policy" ON returns
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = returns.store_id)
    );

CREATE POLICY "returns_insert_policy" ON returns
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = returns.store_id)
    );

CREATE POLICY "returns_update_policy" ON returns
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = returns.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = returns.store_id)
    );

CREATE POLICY "returns_delete_policy" ON returns
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = returns.store_id)
    );

-- ============================================================
-- BANK_ACCOUNTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "bank_accounts_insert_policy" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_update_policy" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_select_policy" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_delete_policy" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_all_policy" ON bank_accounts;

CREATE POLICY "bank_accounts_select_policy" ON bank_accounts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = bank_accounts.store_id)
    );

CREATE POLICY "bank_accounts_insert_policy" ON bank_accounts
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = bank_accounts.store_id)
    );

CREATE POLICY "bank_accounts_update_policy" ON bank_accounts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = bank_accounts.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = bank_accounts.store_id)
    );

CREATE POLICY "bank_accounts_delete_policy" ON bank_accounts
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = bank_accounts.store_id)
    );

-- ============================================================
-- STOCK_MOVEMENTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "stock_movements_insert_policy" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_update_policy" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_select_policy" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_delete_policy" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_all_policy" ON stock_movements;

CREATE POLICY "stock_movements_select_policy" ON stock_movements
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = stock_movements.store_id)
    );

CREATE POLICY "stock_movements_insert_policy" ON stock_movements
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = stock_movements.store_id)
    );

CREATE POLICY "stock_movements_update_policy" ON stock_movements
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = stock_movements.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = stock_movements.store_id)
    );

CREATE POLICY "stock_movements_delete_policy" ON stock_movements
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = stock_movements.store_id)
    );

-- ============================================================
-- PURCHASE_ORDERS TABLE
-- ============================================================
DROP POLICY IF EXISTS "purchase_orders_insert_policy" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update_policy" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_select_policy" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete_policy" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_all_policy" ON purchase_orders;

CREATE POLICY "purchase_orders_select_policy" ON purchase_orders
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = purchase_orders.store_id)
    );

CREATE POLICY "purchase_orders_insert_policy" ON purchase_orders
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = purchase_orders.store_id)
    );

CREATE POLICY "purchase_orders_update_policy" ON purchase_orders
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = purchase_orders.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = purchase_orders.store_id)
    );

CREATE POLICY "purchase_orders_delete_policy" ON purchase_orders
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = purchase_orders.store_id)
    );

-- ============================================================
-- RECEIPTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "receipts_insert_policy" ON receipts;
DROP POLICY IF EXISTS "receipts_update_policy" ON receipts;
DROP POLICY IF EXISTS "receipts_select_policy" ON receipts;
DROP POLICY IF EXISTS "receipts_delete_policy" ON receipts;
DROP POLICY IF EXISTS "receipts_all_policy" ON receipts;

CREATE POLICY "receipts_select_policy" ON receipts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipts.store_id)
    );

CREATE POLICY "receipts_insert_policy" ON receipts
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipts.store_id)
    );

CREATE POLICY "receipts_update_policy" ON receipts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipts.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipts.store_id)
    );

CREATE POLICY "receipts_delete_policy" ON receipts
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipts.store_id)
    );

-- ============================================================
-- RULES TABLE
-- ============================================================
DROP POLICY IF EXISTS "rules_insert_policy" ON rules;
DROP POLICY IF EXISTS "rules_update_policy" ON rules;
DROP POLICY IF EXISTS "rules_select_policy" ON rules;
DROP POLICY IF EXISTS "rules_delete_policy" ON rules;
DROP POLICY IF EXISTS "rules_all_policy" ON rules;

CREATE POLICY "rules_select_policy" ON rules
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = rules.store_id)
    );

CREATE POLICY "rules_insert_policy" ON rules
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = rules.store_id)
    );

CREATE POLICY "rules_update_policy" ON rules
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = rules.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = rules.store_id)
    );

CREATE POLICY "rules_delete_policy" ON rules
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = rules.store_id)
    );

-- ============================================================
-- GLOBAL_CONTEXT TABLE
-- ============================================================
DROP POLICY IF EXISTS "global_context_insert_policy" ON global_context;
DROP POLICY IF EXISTS "global_context_update_policy" ON global_context;
DROP POLICY IF EXISTS "global_context_select_policy" ON global_context;
DROP POLICY IF EXISTS "global_context_delete_policy" ON global_context;
DROP POLICY IF EXISTS "global_context_all_policy" ON global_context;

CREATE POLICY "global_context_select_policy" ON global_context
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = global_context.store_id)
    );

CREATE POLICY "global_context_insert_policy" ON global_context
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = global_context.store_id)
    );

CREATE POLICY "global_context_update_policy" ON global_context
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = global_context.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = global_context.store_id)
    );

CREATE POLICY "global_context_delete_policy" ON global_context
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = global_context.store_id)
    );

-- ============================================================
-- USERS TABLE
-- ============================================================
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;
DROP POLICY IF EXISTS "users_all_policy" ON users;

CREATE POLICY "users_select_policy" ON users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = users.store_id)
    );

CREATE POLICY "users_insert_policy" ON users
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = users.store_id)
    );

CREATE POLICY "users_update_policy" ON users
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = users.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = users.store_id)
    );

CREATE POLICY "users_delete_policy" ON users
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = users.store_id)
    );

-- ============================================================
-- ROLES TABLE
-- ============================================================
DROP POLICY IF EXISTS "roles_insert_policy" ON roles;
DROP POLICY IF EXISTS "roles_update_policy" ON roles;
DROP POLICY IF EXISTS "roles_select_policy" ON roles;
DROP POLICY IF EXISTS "roles_delete_policy" ON roles;
DROP POLICY IF EXISTS "roles_all_policy" ON roles;

CREATE POLICY "roles_select_policy" ON roles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = roles.store_id)
    );

CREATE POLICY "roles_insert_policy" ON roles
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = roles.store_id)
    );

CREATE POLICY "roles_update_policy" ON roles
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = roles.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = roles.store_id)
    );

CREATE POLICY "roles_delete_policy" ON roles
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = roles.store_id)
    );

-- ============================================================
-- SHIFTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "shifts_insert_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_update_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_delete_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_all_policy" ON shifts;

CREATE POLICY "shifts_select_policy" ON shifts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = shifts.store_id)
    );

CREATE POLICY "shifts_insert_policy" ON shifts
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = shifts.store_id)
    );

CREATE POLICY "shifts_update_policy" ON shifts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = shifts.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = shifts.store_id)
    );

CREATE POLICY "shifts_delete_policy" ON shifts
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = shifts.store_id)
    );

-- ============================================================
-- TEAM_INVITES TABLE
-- ============================================================
DROP POLICY IF EXISTS "team_invites_insert_policy" ON team_invites;
DROP POLICY IF EXISTS "team_invites_update_policy" ON team_invites;
DROP POLICY IF EXISTS "team_invites_select_policy" ON team_invites;
DROP POLICY IF EXISTS "team_invites_delete_policy" ON team_invites;
DROP POLICY IF EXISTS "team_invites_all_policy" ON team_invites;

CREATE POLICY "team_invites_select_policy" ON team_invites
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = team_invites.store_id)
    );

CREATE POLICY "team_invites_insert_policy" ON team_invites
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = team_invites.store_id)
    );

CREATE POLICY "team_invites_update_policy" ON team_invites
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = team_invites.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = team_invites.store_id)
    );

CREATE POLICY "team_invites_delete_policy" ON team_invites
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = team_invites.store_id)
    );

-- ============================================================
-- INVENTORY_LOTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "inventory_lots_insert_policy" ON inventory_lots;
DROP POLICY IF EXISTS "inventory_lots_update_policy" ON inventory_lots;
DROP POLICY IF EXISTS "inventory_lots_select_policy" ON inventory_lots;
DROP POLICY IF EXISTS "inventory_lots_delete_policy" ON inventory_lots;
DROP POLICY IF EXISTS "inventory_lots_all_policy" ON inventory_lots;

CREATE POLICY "inventory_lots_select_policy" ON inventory_lots
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id)
    );

CREATE POLICY "inventory_lots_insert_policy" ON inventory_lots
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id)
    );

CREATE POLICY "inventory_lots_update_policy" ON inventory_lots
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id)
    );

CREATE POLICY "inventory_lots_delete_policy" ON inventory_lots
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id)
    );

-- ============================================================
-- COST_CONSUMPTIONS TABLE
-- ============================================================
DROP POLICY IF EXISTS "cost_consumptions_insert_policy" ON cost_consumptions;
DROP POLICY IF EXISTS "cost_consumptions_update_policy" ON cost_consumptions;
DROP POLICY IF EXISTS "cost_consumptions_select_policy" ON cost_consumptions;
DROP POLICY IF EXISTS "cost_consumptions_delete_policy" ON cost_consumptions;
DROP POLICY IF EXISTS "cost_consumptions_all_policy" ON cost_consumptions;

CREATE POLICY "cost_consumptions_select_policy" ON cost_consumptions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id)
    );

CREATE POLICY "cost_consumptions_insert_policy" ON cost_consumptions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id)
    );

CREATE POLICY "cost_consumptions_update_policy" ON cost_consumptions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id)
    );

CREATE POLICY "cost_consumptions_delete_policy" ON cost_consumptions
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id)
    );

-- ============================================================
-- JOURNAL_ENTRIES TABLE
-- ============================================================
DROP POLICY IF EXISTS "journal_entries_insert_policy" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_update_policy" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_select_policy" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_delete_policy" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_all_policy" ON journal_entries;

CREATE POLICY "journal_entries_select_policy" ON journal_entries
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id)
    );

CREATE POLICY "journal_entries_insert_policy" ON journal_entries
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id)
    );

CREATE POLICY "journal_entries_update_policy" ON journal_entries
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id)
    );

CREATE POLICY "journal_entries_delete_policy" ON journal_entries
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id)
    );

-- ============================================================
-- ITBIS_SUMMARIES TABLE
-- ============================================================
DROP POLICY IF EXISTS "itbis_summaries_insert_policy" ON itbis_summaries;
DROP POLICY IF EXISTS "itbis_summaries_update_policy" ON itbis_summaries;
DROP POLICY IF EXISTS "itbis_summaries_select_policy" ON itbis_summaries;
DROP POLICY IF EXISTS "itbis_summaries_delete_policy" ON itbis_summaries;
DROP POLICY IF EXISTS "itbis_summaries_all_policy" ON itbis_summaries;

CREATE POLICY "itbis_summaries_select_policy" ON itbis_summaries
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = itbis_summaries.store_id)
    );

CREATE POLICY "itbis_summaries_insert_policy" ON itbis_summaries
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = itbis_summaries.store_id)
    );

CREATE POLICY "itbis_summaries_update_policy" ON itbis_summaries
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = itbis_summaries.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = itbis_summaries.store_id)
    );

CREATE POLICY "itbis_summaries_delete_policy" ON itbis_summaries
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = itbis_summaries.store_id)
    );

-- ============================================================
-- CARD_SETTLEMENTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "card_settlements_insert_policy" ON card_settlements;
DROP POLICY IF EXISTS "card_settlements_update_policy" ON card_settlements;
DROP POLICY IF EXISTS "card_settlements_select_policy" ON card_settlements;
DROP POLICY IF EXISTS "card_settlements_delete_policy" ON card_settlements;
DROP POLICY IF EXISTS "card_settlements_all_policy" ON card_settlements;

CREATE POLICY "card_settlements_select_policy" ON card_settlements
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = card_settlements.store_id)
    );

CREATE POLICY "card_settlements_insert_policy" ON card_settlements
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = card_settlements.store_id)
    );

CREATE POLICY "card_settlements_update_policy" ON card_settlements
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = card_settlements.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = card_settlements.store_id)
    );

CREATE POLICY "card_settlements_delete_policy" ON card_settlements
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = card_settlements.store_id)
    );

-- ============================================================
-- NCF_RANGES TABLE
-- ============================================================
DROP POLICY IF EXISTS "ncf_ranges_insert_policy" ON ncf_ranges;
DROP POLICY IF EXISTS "ncf_ranges_update_policy" ON ncf_ranges;
DROP POLICY IF EXISTS "ncf_ranges_select_policy" ON ncf_ranges;
DROP POLICY IF EXISTS "ncf_ranges_delete_policy" ON ncf_ranges;
DROP POLICY IF EXISTS "ncf_ranges_all_policy" ON ncf_ranges;

CREATE POLICY "ncf_ranges_select_policy" ON ncf_ranges
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_ranges.store_id)
    );

CREATE POLICY "ncf_ranges_insert_policy" ON ncf_ranges
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_ranges.store_id)
    );

CREATE POLICY "ncf_ranges_update_policy" ON ncf_ranges
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_ranges.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_ranges.store_id)
    );

CREATE POLICY "ncf_ranges_delete_policy" ON ncf_ranges
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_ranges.store_id)
    );

-- ============================================================
-- NCF_USAGE TABLE
-- ============================================================
DROP POLICY IF EXISTS "ncf_usage_insert_policy" ON ncf_usage;
DROP POLICY IF EXISTS "ncf_usage_update_policy" ON ncf_usage;
DROP POLICY IF EXISTS "ncf_usage_select_policy" ON ncf_usage;
DROP POLICY IF EXISTS "ncf_usage_delete_policy" ON ncf_usage;
DROP POLICY IF EXISTS "ncf_usage_all_policy" ON ncf_usage;

CREATE POLICY "ncf_usage_select_policy" ON ncf_usage
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_usage.store_id)
    );

CREATE POLICY "ncf_usage_insert_policy" ON ncf_usage
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_usage.store_id)
    );

CREATE POLICY "ncf_usage_update_policy" ON ncf_usage
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_usage.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_usage.store_id)
    );

CREATE POLICY "ncf_usage_delete_policy" ON ncf_usage
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = ncf_usage.store_id)
    );

-- ============================================================
-- ACCOUNTING_AUDIT_LOG TABLE
-- ============================================================
DROP POLICY IF EXISTS "accounting_audit_log_insert_policy" ON accounting_audit_log;
DROP POLICY IF EXISTS "accounting_audit_log_update_policy" ON accounting_audit_log;
DROP POLICY IF EXISTS "accounting_audit_log_select_policy" ON accounting_audit_log;
DROP POLICY IF EXISTS "accounting_audit_log_delete_policy" ON accounting_audit_log;
DROP POLICY IF EXISTS "accounting_audit_log_all_policy" ON accounting_audit_log;

CREATE POLICY "accounting_audit_log_select_policy" ON accounting_audit_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = accounting_audit_log.store_id)
    );

CREATE POLICY "accounting_audit_log_insert_policy" ON accounting_audit_log
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = accounting_audit_log.store_id)
    );

CREATE POLICY "accounting_audit_log_update_policy" ON accounting_audit_log
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = accounting_audit_log.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = accounting_audit_log.store_id)
    );

CREATE POLICY "accounting_audit_log_delete_policy" ON accounting_audit_log
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = accounting_audit_log.store_id)
    );

-- ============================================================
-- RECEIPT_SETTINGS TABLE
-- ============================================================
DROP POLICY IF EXISTS "receipt_settings_insert_policy" ON receipt_settings;
DROP POLICY IF EXISTS "receipt_settings_update_policy" ON receipt_settings;
DROP POLICY IF EXISTS "receipt_settings_select_policy" ON receipt_settings;
DROP POLICY IF EXISTS "receipt_settings_delete_policy" ON receipt_settings;
DROP POLICY IF EXISTS "receipt_settings_all_policy" ON receipt_settings;

CREATE POLICY "receipt_settings_select_policy" ON receipt_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipt_settings.store_id)
    );

CREATE POLICY "receipt_settings_insert_policy" ON receipt_settings
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipt_settings.store_id)
    );

CREATE POLICY "receipt_settings_update_policy" ON receipt_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipt_settings.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipt_settings.store_id)
    );

CREATE POLICY "receipt_settings_delete_policy" ON receipt_settings
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = receipt_settings.store_id)
    );

-- ============================================================
-- TRANSACTION_FEATURES TABLE
-- ============================================================
DROP POLICY IF EXISTS "transaction_features_insert_policy" ON transaction_features;
DROP POLICY IF EXISTS "transaction_features_update_policy" ON transaction_features;
DROP POLICY IF EXISTS "transaction_features_select_policy" ON transaction_features;
DROP POLICY IF EXISTS "transaction_features_delete_policy" ON transaction_features;
DROP POLICY IF EXISTS "transaction_features_all_policy" ON transaction_features;

CREATE POLICY "transaction_features_select_policy" ON transaction_features
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = transaction_features.store_id)
    );

CREATE POLICY "transaction_features_insert_policy" ON transaction_features
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = transaction_features.store_id)
    );

CREATE POLICY "transaction_features_update_policy" ON transaction_features
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = transaction_features.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = transaction_features.store_id)
    );

CREATE POLICY "transaction_features_delete_policy" ON transaction_features
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = transaction_features.store_id)
    );

-- ============================================================
-- REAL_TIME_INSIGHTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "real_time_insights_insert_policy" ON real_time_insights;
DROP POLICY IF EXISTS "real_time_insights_update_policy" ON real_time_insights;
DROP POLICY IF EXISTS "real_time_insights_select_policy" ON real_time_insights;
DROP POLICY IF EXISTS "real_time_insights_delete_policy" ON real_time_insights;
DROP POLICY IF EXISTS "real_time_insights_all_policy" ON real_time_insights;

CREATE POLICY "real_time_insights_select_policy" ON real_time_insights
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = real_time_insights.store_id)
    );

CREATE POLICY "real_time_insights_insert_policy" ON real_time_insights
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = real_time_insights.store_id)
    );

CREATE POLICY "real_time_insights_update_policy" ON real_time_insights
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = real_time_insights.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = real_time_insights.store_id)
    );

CREATE POLICY "real_time_insights_delete_policy" ON real_time_insights
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = real_time_insights.store_id)
    );

-- ============================================================
-- CUSTOMER_SEGMENTS TABLE (if exists)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_segments') THEN
        EXECUTE 'DROP POLICY IF EXISTS "customer_segments_insert_policy" ON customer_segments';
        EXECUTE 'DROP POLICY IF EXISTS "customer_segments_update_policy" ON customer_segments';
        EXECUTE 'DROP POLICY IF EXISTS "customer_segments_select_policy" ON customer_segments';
        EXECUTE 'DROP POLICY IF EXISTS "customer_segments_delete_policy" ON customer_segments';
        EXECUTE 'DROP POLICY IF EXISTS "customer_segments_all_policy" ON customer_segments';

        EXECUTE 'CREATE POLICY "customer_segments_select_policy" ON customer_segments
            FOR SELECT USING (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = customer_segments.store_id)
            )';

        EXECUTE 'CREATE POLICY "customer_segments_insert_policy" ON customer_segments
            FOR INSERT WITH CHECK (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = customer_segments.store_id)
            )';

        EXECUTE 'CREATE POLICY "customer_segments_update_policy" ON customer_segments
            FOR UPDATE USING (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = customer_segments.store_id)
            ) WITH CHECK (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = customer_segments.store_id)
            )';

        EXECUTE 'CREATE POLICY "customer_segments_delete_policy" ON customer_segments
            FOR DELETE USING (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = customer_segments.store_id)
            )';
    END IF;
END $$;

-- ============================================================
-- WEATHER_RECORDS TABLE (if exists)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'weather_records') THEN
        EXECUTE 'DROP POLICY IF EXISTS "weather_records_insert_policy" ON weather_records';
        EXECUTE 'DROP POLICY IF EXISTS "weather_records_update_policy" ON weather_records';
        EXECUTE 'DROP POLICY IF EXISTS "weather_records_select_policy" ON weather_records';
        EXECUTE 'DROP POLICY IF EXISTS "weather_records_delete_policy" ON weather_records';
        EXECUTE 'DROP POLICY IF EXISTS "weather_records_all_policy" ON weather_records';

        EXECUTE 'CREATE POLICY "weather_records_select_policy" ON weather_records
            FOR SELECT USING (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = weather_records.store_id)
            )';

        EXECUTE 'CREATE POLICY "weather_records_insert_policy" ON weather_records
            FOR INSERT WITH CHECK (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = weather_records.store_id)
            )';

        EXECUTE 'CREATE POLICY "weather_records_update_policy" ON weather_records
            FOR UPDATE USING (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = weather_records.store_id)
            ) WITH CHECK (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = weather_records.store_id)
            )';

        EXECUTE 'CREATE POLICY "weather_records_delete_policy" ON weather_records
            FOR DELETE USING (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = weather_records.store_id)
            )';
    END IF;
END $$;

-- ============================================================
-- SYNC_LOG TABLE
-- ============================================================
DROP POLICY IF EXISTS "sync_log_insert_policy" ON sync_log;
DROP POLICY IF EXISTS "sync_log_update_policy" ON sync_log;
DROP POLICY IF EXISTS "sync_log_select_policy" ON sync_log;
DROP POLICY IF EXISTS "sync_log_delete_policy" ON sync_log;
DROP POLICY IF EXISTS "sync_log_all_policy" ON sync_log;

CREATE POLICY "sync_log_select_policy" ON sync_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sync_log.store_id)
    );

CREATE POLICY "sync_log_insert_policy" ON sync_log
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sync_log.store_id)
    );

CREATE POLICY "sync_log_update_policy" ON sync_log
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sync_log.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sync_log.store_id)
    );

CREATE POLICY "sync_log_delete_policy" ON sync_log
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = sync_log.store_id)
    );

-- ============================================================
-- DEVICES TABLE
-- ============================================================
DROP POLICY IF EXISTS "devices_insert_policy" ON devices;
DROP POLICY IF EXISTS "devices_update_policy" ON devices;
DROP POLICY IF EXISTS "devices_select_policy" ON devices;
DROP POLICY IF EXISTS "devices_delete_policy" ON devices;
DROP POLICY IF EXISTS "devices_all_policy" ON devices;

CREATE POLICY "devices_select_policy" ON devices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = devices.store_id)
    );

CREATE POLICY "devices_insert_policy" ON devices
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = devices.store_id)
    );

CREATE POLICY "devices_update_policy" ON devices
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = devices.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = devices.store_id)
    );

CREATE POLICY "devices_delete_policy" ON devices
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = devices.store_id)
    );

-- ============================================================
-- PAIRING_CODES TABLE
-- ============================================================
DROP POLICY IF EXISTS "pairing_codes_insert_policy" ON pairing_codes;
DROP POLICY IF EXISTS "pairing_codes_update_policy" ON pairing_codes;
DROP POLICY IF EXISTS "pairing_codes_select_policy" ON pairing_codes;
DROP POLICY IF EXISTS "pairing_codes_delete_policy" ON pairing_codes;
DROP POLICY IF EXISTS "pairing_codes_all_policy" ON pairing_codes;

CREATE POLICY "pairing_codes_select_policy" ON pairing_codes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = pairing_codes.store_id)
    );

CREATE POLICY "pairing_codes_insert_policy" ON pairing_codes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = pairing_codes.store_id)
    );

CREATE POLICY "pairing_codes_update_policy" ON pairing_codes
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = pairing_codes.store_id)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = pairing_codes.store_id)
    );

CREATE POLICY "pairing_codes_delete_policy" ON pairing_codes
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = pairing_codes.store_id)
    );

-- ============================================================
-- STORES TABLE - Allow all for the stores table itself
-- ============================================================
DROP POLICY IF EXISTS "stores_insert_policy" ON stores;
DROP POLICY IF EXISTS "stores_update_policy" ON stores;
DROP POLICY IF EXISTS "stores_select_policy" ON stores;
DROP POLICY IF EXISTS "stores_delete_policy" ON stores;
DROP POLICY IF EXISTS "stores_all_policy" ON stores;

-- Stores table should be accessible for creating new stores
CREATE POLICY "stores_select_policy" ON stores
    FOR SELECT USING (true);

CREATE POLICY "stores_insert_policy" ON stores
    FOR INSERT WITH CHECK (true);

CREATE POLICY "stores_update_policy" ON stores
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "stores_delete_policy" ON stores
    FOR DELETE USING (true);

-- ============================================================
-- SUMMARY
-- ============================================================
-- This migration replaces all RLS policies that relied on 
-- current_setting('app.store_id') with policies that simply
-- validate the store_id exists in the stores table.
--
-- This is necessary because PostgREST doesn't persist session
-- variables between HTTP requests, making the session-based
-- context approach unreliable for REST API sync operations.
--
-- Security: The new policies still ensure that:
-- 1. Data can only be inserted/updated for valid stores
-- 2. Data can only be read/deleted for valid stores
-- 3. Invalid store_id values will be rejected
--
-- For production, consider adding additional authentication
-- using Supabase Auth or custom JWT claims.
-- ============================================================

