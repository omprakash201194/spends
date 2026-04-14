--liquibase formatted sql

--changeset omprakash:001-initial-schema

CREATE TABLE household (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    invite_code VARCHAR(12)  UNIQUE NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE app_user (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id  UUID         REFERENCES household (id),
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'MEMBER',
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_user_household ON app_user (household_id);

CREATE TABLE bank_account (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID         NOT NULL REFERENCES app_user (id),
    bank_name             VARCHAR(100) NOT NULL,
    account_number_masked VARCHAR(50),
    account_type          VARCHAR(50),
    currency              VARCHAR(10)  NOT NULL DEFAULT 'INR',
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_account_user ON bank_account (user_id);

CREATE TABLE category (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name      VARCHAR(100) UNIQUE NOT NULL,
    icon      VARCHAR(50),
    color     VARCHAR(20),
    parent_id UUID REFERENCES category (id),
    is_system BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE financial_transaction (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id  UUID          NOT NULL REFERENCES bank_account (id),
    value_date       DATE          NOT NULL,
    transaction_date DATE          NOT NULL,
    cheque_number    VARCHAR(50),
    raw_remarks      TEXT,
    merchant_name    VARCHAR(255),
    withdrawal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    deposit_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
    balance          NUMERIC(15, 2),
    category_id      UUID REFERENCES category (id),
    is_reviewed      BOOLEAN       NOT NULL DEFAULT FALSE,
    import_hash      VARCHAR(64)   UNIQUE,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_txn_bank_account ON financial_transaction (bank_account_id);
CREATE INDEX idx_txn_date         ON financial_transaction (transaction_date);
CREATE INDEX idx_txn_category     ON financial_transaction (category_id);

CREATE TABLE category_rule (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES app_user (id),
    pattern     VARCHAR(255) NOT NULL,
    category_id UUID         NOT NULL REFERENCES category (id),
    priority    INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_category_rule_user ON category_rule (user_id);

CREATE TABLE budget (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          NOT NULL REFERENCES app_user (id),
    category_id UUID          NOT NULL REFERENCES category (id),
    year        INT           NOT NULL,
    month       INT           NOT NULL,
    amount      NUMERIC(15, 2) NOT NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, category_id, year, month)
);

CREATE INDEX idx_budget_user ON budget (user_id, year, month);
