--liquibase formatted sql

--changeset omprakash:005-user-claude-api-key
ALTER TABLE app_user ADD COLUMN claude_api_key VARCHAR(200);
