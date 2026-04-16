--liquibase formatted sql

--changeset omprakash:007-views-schema

CREATE TABLE spend_view (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID         NOT NULL REFERENCES household(id),
    name         VARCHAR(200) NOT NULL,
    type         VARCHAR(20)  NOT NULL CHECK (type IN ('TRIP', 'EVENT', 'CUSTOM')),
    start_date   DATE         NOT NULL,
    end_date     DATE         NOT NULL,
    description  TEXT,
    color        VARCHAR(20),
    total_budget NUMERIC(15, 2),
    created_at   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE view_transaction (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_id        UUID NOT NULL REFERENCES spend_view(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES financial_transaction(id) ON DELETE CASCADE,
    UNIQUE (view_id, transaction_id)
);

CREATE TABLE view_category_budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_id         UUID           NOT NULL REFERENCES spend_view(id) ON DELETE CASCADE,
    category_id     UUID           NOT NULL REFERENCES category(id),
    expected_amount NUMERIC(15, 2) NOT NULL,
    UNIQUE (view_id, category_id)
);

CREATE INDEX idx_spend_view_household   ON spend_view(household_id);
CREATE INDEX idx_view_transaction_view  ON view_transaction(view_id);
CREATE INDEX idx_view_transaction_tx    ON view_transaction(transaction_id);
