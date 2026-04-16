--liquibase formatted sql

--changeset omprakash:008-import-batch

CREATE TABLE import_batch (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id   UUID         NOT NULL REFERENCES bank_account(id),
    original_filename VARCHAR(500) NOT NULL,
    imported_at       TIMESTAMP    NOT NULL DEFAULT now(),
    transaction_count INT          NOT NULL DEFAULT 0,
    duplicate_count   INT          NOT NULL DEFAULT 0
);

CREATE INDEX idx_import_batch_bank_account ON import_batch(bank_account_id);

ALTER TABLE financial_transaction
    ADD COLUMN import_batch_id UUID REFERENCES import_batch(id) ON DELETE CASCADE;

CREATE INDEX idx_transaction_import_batch ON financial_transaction(import_batch_id);
