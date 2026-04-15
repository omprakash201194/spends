--liquibase formatted sql

--changeset omprakash:006-custom-categories
-- Add household scoping to category table for custom (non-system) categories
ALTER TABLE category ADD COLUMN household_id UUID REFERENCES household(id);

-- Drop the blanket unique constraint on name
ALTER TABLE category DROP CONSTRAINT category_name_key;

-- System categories remain globally unique by name
CREATE UNIQUE INDEX idx_category_name_system
    ON category (name)
    WHERE is_system = TRUE;

-- Custom categories are unique per household
CREATE UNIQUE INDEX idx_category_name_household
    ON category (name, household_id)
    WHERE is_system = FALSE;
