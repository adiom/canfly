-- 031: MCP OAuth — CIMD-клиенты, аудит и служебные поля
--
-- 028 создала базовые таблицы, но в ней клиент всегда имеет UUID. По
-- спецификации MCP современные клиенты (ChatGPT, Claude) могут приходить с
-- Client ID Metadata Document: client_id — это HTTPS-URL. Чтобы гранты
-- продолжали ссылаться на UUID, храним URL отдельно и ищем клиента по нему.
--
-- Токены и коды по-прежнему лежат только хешами. В events не пишем ни
-- секретов, ни email: только идентификаторы и тип события.

ALTER TABLE public.mcp_oauth_clients
  ADD COLUMN IF NOT EXISTS client_id_url TEXT,
  ADD COLUMN IF NOT EXISTS client_uri TEXT,
  ADD COLUMN IF NOT EXISTS logo_uri TEXT,
  ADD COLUMN IF NOT EXISTS token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS metadata_fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- ON CONFLICT (client_id_url) в upsert CIMD-клиента.
CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_clients_client_id_url_key
  ON public.mcp_oauth_clients (client_id_url)
  WHERE client_id_url IS NOT NULL;

ALTER TABLE public.mcp_oauth_grants
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.mcp_oauth_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  client_id UUID REFERENCES public.mcp_oauth_clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mcp_oauth_events_created_at_idx
  ON public.mcp_oauth_events (created_at DESC);

CREATE INDEX IF NOT EXISTS mcp_oauth_events_user_id_idx
  ON public.mcp_oauth_events (user_id);
