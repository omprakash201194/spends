--liquibase formatted sql

--changeset omprakash:004-seed-category-rules
-- Global default category rules for auto-categorization.
-- user_id is NULL, is_global = TRUE → apply to all users.
-- Patterns are case-insensitive substring matches on raw_remarks or merchant UPI handle.
-- Higher priority = matched first.

-- Food & Dining (priority 100)
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'swiggy',       id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'zomato',       id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'dominos',      id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'mcdonalds',    id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'kfc',          id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'pizzahut',     id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'burger king',  id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'dunkin',       id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'starbucks',    id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'cafe coffee',  id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'blinkit',      id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'zepto',        id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'bigbasket',    id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'instamart',    id, 100, TRUE, NOW() FROM category WHERE name = 'Food & Dining';

-- Transport (priority 100)
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'ola',          id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'uber',         id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'rapido',       id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'redbus',       id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'irctc',        id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'indigo',       id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'airindia',     id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'makemytrip',   id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'goibibo',      id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'fasttag',      id, 100, TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'petrol',       id, 90,  TRUE, NOW() FROM category WHERE name = 'Transport';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'fuel',         id, 90,  TRUE, NOW() FROM category WHERE name = 'Transport';

-- Entertainment (priority 100)
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'netflix',      id, 100, TRUE, NOW() FROM category WHERE name = 'Entertainment';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'primevideo',   id, 100, TRUE, NOW() FROM category WHERE name = 'Entertainment';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'hotstar',      id, 100, TRUE, NOW() FROM category WHERE name = 'Entertainment';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'spotify',      id, 100, TRUE, NOW() FROM category WHERE name = 'Entertainment';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'gaana',        id, 100, TRUE, NOW() FROM category WHERE name = 'Entertainment';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'bookmyshow',   id, 100, TRUE, NOW() FROM category WHERE name = 'Entertainment';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'youtube',      id, 100, TRUE, NOW() FROM category WHERE name = 'Entertainment';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'jiocinema',    id, 100, TRUE, NOW() FROM category WHERE name = 'Entertainment';

-- Shopping (priority 100)
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'amazon',       id, 100, TRUE, NOW() FROM category WHERE name = 'Shopping';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'flipkart',     id, 100, TRUE, NOW() FROM category WHERE name = 'Shopping';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'myntra',       id, 100, TRUE, NOW() FROM category WHERE name = 'Shopping';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'ajio',         id, 100, TRUE, NOW() FROM category WHERE name = 'Shopping';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'meesho',       id, 100, TRUE, NOW() FROM category WHERE name = 'Shopping';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'nykaa',        id, 100, TRUE, NOW() FROM category WHERE name = 'Shopping';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'tatacliq',     id, 100, TRUE, NOW() FROM category WHERE name = 'Shopping';

-- Health & Medical (priority 100)
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'pharmeasy',    id, 100, TRUE, NOW() FROM category WHERE name = 'Health & Medical';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'netmeds',      id, 100, TRUE, NOW() FROM category WHERE name = 'Health & Medical';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, '1mg',          id, 100, TRUE, NOW() FROM category WHERE name = 'Health & Medical';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'apollo',       id, 100, TRUE, NOW() FROM category WHERE name = 'Health & Medical';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'practo',       id, 100, TRUE, NOW() FROM category WHERE name = 'Health & Medical';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'medplus',      id, 100, TRUE, NOW() FROM category WHERE name = 'Health & Medical';

-- Utilities (priority 100)
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'bescom',       id, 100, TRUE, NOW() FROM category WHERE name = 'Utilities';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'bwssb',        id, 100, TRUE, NOW() FROM category WHERE name = 'Utilities';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'airtel',       id, 100, TRUE, NOW() FROM category WHERE name = 'Utilities';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'jio',          id, 100, TRUE, NOW() FROM category WHERE name = 'Utilities';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'bsnl',         id, 100, TRUE, NOW() FROM category WHERE name = 'Utilities';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'electricity',  id, 90,  TRUE, NOW() FROM category WHERE name = 'Utilities';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'broadband',    id, 90,  TRUE, NOW() FROM category WHERE name = 'Utilities';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'recharge',     id, 80,  TRUE, NOW() FROM category WHERE name = 'Utilities';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'act fibernet',  id, 100,  TRUE, NOW() FROM category WHERE name = 'Utilities';

-- Financial (priority 100)
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'cred',         id, 100, TRUE, NOW() FROM category WHERE name = 'Financial';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'creditcard',   id, 100, TRUE, NOW() FROM category WHERE name = 'Financial';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'credit card',  id, 100, TRUE, NOW() FROM category WHERE name = 'Financial';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'loan emi',     id, 100, TRUE, NOW() FROM category WHERE name = 'Financial';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'insurance',    id, 100, TRUE, NOW() FROM category WHERE name = 'Financial';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'lic',          id, 100, TRUE, NOW() FROM category WHERE name = 'Financial';

-- Savings & Investments (priority 100)
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'zerodha',      id, 100, TRUE, NOW() FROM category WHERE name = 'Savings & Investments';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'groww',        id, 100, TRUE, NOW() FROM category WHERE name = 'Savings & Investments';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'kuvera',       id, 100, TRUE, NOW() FROM category WHERE name = 'Savings & Investments';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'coin',         id, 100, TRUE, NOW() FROM category WHERE name = 'Savings & Investments';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'mutual fund',  id, 100, TRUE, NOW() FROM category WHERE name = 'Savings & Investments';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'sip',          id, 90,  TRUE, NOW() FROM category WHERE name = 'Savings & Investments';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'nps',          id, 100, TRUE, NOW() FROM category WHERE name = 'Savings & Investments';
INSERT INTO category_rule (id, user_id, pattern, category_id, priority, is_global, created_at)
SELECT gen_random_uuid(), NULL, 'ppf',          id, 100, TRUE, NOW() FROM category WHERE name = 'Savings & Investments';
