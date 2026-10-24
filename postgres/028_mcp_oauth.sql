-- OAuth grants are limited by an explicit email allowlist AND the live admin role.
-- Codes and tokens are stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES mcp_oauth_clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  resource TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope = 'canfly:content'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE TABLE IF NOT EXISTS mcp_oauth_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES mcp_oauth_clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope = 'canfly:content'),
  access_token_hash TEXT NOT NULL UNIQUE,
  access_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mcp_oauth_refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  grant_id UUID NOT NULL REFERENCES mcp_oauth_grants(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mcp_oauth_grants_user_id_idx ON mcp_oauth_grants(user_id);
CREATE INDEX IF NOT EXISTS mcp_oauth_grants_client_id_idx ON mcp_oauth_grants(client_id);
CREATE INDEX IF NOT EXISTS mcp_oauth_refresh_grant_id_idx ON mcp_oauth_refresh_tokens(grant_id);
CREATE INDEX IF NOT EXISTS mcp_oauth_codes_client_id_idx ON mcp_oauth_codes(client_id);
CREATE INDEX IF NOT EXISTS mcp_oauth_codes_user_id_idx ON mcp_oauth_codes(user_id);
CREATE INDEX IF NOT EXISTS mcp_oauth_codes_expires_at_idx ON mcp_oauth_codes(expires_at);
