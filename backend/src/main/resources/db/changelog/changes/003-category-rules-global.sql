--liquibase formatted sql

--changeset omprakash:003-category-rules-global
-- Make user_id nullable so we can have global (system-level) category rules
ALTER TABLE category_rule ALTER COLUMN user_id DROP NOT NULL;

-- Add is_global flag — global rules apply to all users during auto-categorization
ALTER TABLE category_rule ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to quickly fetch global rules
CREATE INDEX IF NOT EXISTS idx_category_rule_global ON category_rule (is_global) WHERE is_global = TRUE;
