--liquibase formatted sql

--changeset omprakash:002-seed-categories

INSERT INTO category (id, name, icon, color, is_system) VALUES
    (gen_random_uuid(), 'Food & Dining',       'utensils',       '#f97316', true),
    (gen_random_uuid(), 'Transport',            'car',            '#3b82f6', true),
    (gen_random_uuid(), 'Rent & Housing',       'home',           '#8b5cf6', true),
    (gen_random_uuid(), 'Utilities',            'zap',            '#eab308', true),
    (gen_random_uuid(), 'Entertainment',        'tv',             '#ec4899', true),
    (gen_random_uuid(), 'Health & Medical',     'heart-pulse',    '#ef4444', true),
    (gen_random_uuid(), 'Shopping',             'shopping-bag',   '#14b8a6', true),
    (gen_random_uuid(), 'Family Transfers',     'users',          '#a855f7', true),
    (gen_random_uuid(), 'Savings & Investments','trending-up',    '#22c55e', true),
    (gen_random_uuid(), 'Financial',            'credit-card',    '#64748b', true),
    (gen_random_uuid(), 'Income',               'banknote',       '#10b981', true),
    (gen_random_uuid(), 'Miscellaneous',        'circle-help',    '#94a3b8', true);
