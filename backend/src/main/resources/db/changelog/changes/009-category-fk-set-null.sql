-- liquibase formatted sql

-- changeset omprakash:009-category-fk-set-null
-- Allow category to be deleted without blocking: set transaction.category_id to NULL
-- instead of violating the FK constraint (needed for Danger Zone bulk-delete of custom categories).
ALTER TABLE financial_transaction
    DROP CONSTRAINT IF EXISTS financial_transaction_category_id_fkey;

ALTER TABLE financial_transaction
    ADD CONSTRAINT financial_transaction_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE SET NULL;
