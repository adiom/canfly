-- Account settings: multiple emails + linked OAuth accounts
-- Запускать после schema.sql (users таблица должна существовать)

-- Таблица email'ов пользователя
CREATE TABLE IF NOT EXISTS user_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    verified BOOLEAN NOT NULL DEFAULT false,
    verification_token TEXT,
    verification_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, email)
);

-- Индексы для частых запросов
CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_primary ON user_emails(user_id, is_primary) WHERE is_primary = true;

-- Таблица привязанных внешних аккаунтов (OAuth)
CREATE TABLE IF NOT EXISTS linked_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,              -- 'yandex', 'github', 'google', 'canfly'
    provider_account_id TEXT NOT NULL,   -- OAuth sub/id от провайдера
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_linked_accounts_user_id ON linked_accounts(user_id);

-- Таблица для верификации email'ов (отдельная от magic_tokens для безопасности)
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID NOT NULL REFERENCES user_emails(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                  -- 6-значный код
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_email ON email_verifications(user_id, email_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON email_verifications(expires_at);

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_emails_updated_at ON user_emails;
CREATE TRIGGER update_user_emails_updated_at
    BEFORE UPDATE ON user_emails
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Синхронизация существующих users.email в user_emails (если таблица пуста)
INSERT INTO user_emails (user_id, email, is_primary, verified)
SELECT id, email, true, true
FROM users
WHERE email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_emails WHERE user_emails.user_id = users.id);