-- Migration: Add invoice photo fields to receipts table
-- Purpose: Store photos of physical invoices for the Invoice Vault feature

-- Add invoice photo fields to receipts table
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS invoice_photo_url TEXT,
ADD COLUMN IF NOT EXISTS invoice_photo_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN receipts.invoice_photo_url IS 'Base64 encoded photo or URL of the physical invoice';
COMMENT ON COLUMN receipts.invoice_photo_name IS 'Original filename of the invoice photo';

