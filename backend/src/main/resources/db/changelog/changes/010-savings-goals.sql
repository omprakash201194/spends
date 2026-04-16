--liquibase formatted sql

--changeset omprakash:010-savings-goals

CREATE TABLE savings_goal (
    id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID           NOT NULL REFERENCES app_user(id),
    name        VARCHAR(100)   NOT NULL,
    target      NUMERIC(15, 2) NOT NULL CHECK (target > 0),
    start_date  DATE           NOT NULL,
    target_date DATE,
    created_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_goal_user ON savings_goal(user_id);
