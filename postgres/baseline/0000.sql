-- Canfly test baseline reconstructed from the production catalog dated 2026-11-19.

-- Apply to an empty PostgreSQL 17 database with pnpm db:bootstrap:test.

SET LOCAL search_path = public;

CREATE EXTENSION pgcrypto WITH SCHEMA public VERSION '1.3';

CREATE EXTENSION pg_trgm WITH SCHEMA public VERSION '1.6';

CREATE TYPE public.book_character_role AS ENUM ('main', 'supporting', 'cameo', 'mentioned');

CREATE TYPE public.book_type AS ENUM ('comic', 'book', 'audiobook');

CREATE TYPE public.chapter_status AS ENUM ('draft', 'published');

CREATE TYPE public.character_friendship_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE TYPE public.character_message_role AS ENUM ('user', 'character', 'system');

CREATE TYPE public.character_reply_mode AS ENUM ('ai_auto', 'manual', 'hybrid', 'disabled');

CREATE TYPE public.character_type AS ENUM ('person', 'city');

CREATE TYPE public.collaborator_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TYPE public.comment_status AS ENUM ('pending', 'approved', 'spam');

CREATE TYPE public.edition_format AS ENUM ('book', 'comic', 'audiobook', 'album', 'magazine', 'audiorelease', 'digital', 'artwork');

CREATE TYPE public.edition_status AS ENUM ('draft', 'published', 'archived');

CREATE TYPE public.highlight_status AS ENUM ('pending', 'resolved', 'ignored');

CREATE TYPE public.highlight_type AS ENUM ('quote', 'editorial_comment', 'author_note');

CREATE TYPE public.highlight_visibility AS ENUM ('public', 'internal', 'private');

CREATE TYPE public.homepage_slide_theme AS ENUM ('atelier', 'night-city', 'pvz', 'volga', 'dreams');

CREATE TYPE public.media_type AS ENUM ('trailer', 'podcast', 'review', 'other');

CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'shipped', 'completed', 'cancelled');

CREATE TYPE public.public_role AS ENUM ('reader', 'author');

CREATE TYPE public.release_character_role AS ENUM ('main', 'supporting', 'cameo');

CREATE TYPE public.release_status AS ENUM ('draft', 'published', 'archived');

CREATE TYPE public.user_role AS ENUM ('reader', 'author', 'editor', 'admin');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE SEQUENCE public.mcp_oauth_events_id_seq AS bigint
  INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE TABLE public.bookmarks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  chapter_id uuid NOT NULL,
  user_id uuid NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.chapter_editorial_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  chapter_id uuid NOT NULL,
  author_id uuid NOT NULL,
  text_content text NOT NULL,
  paragraph_index integer,
  context_before text,
  context_after text,
  note text NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone,
  client_request_id uuid,
  start_offset integer,
  end_offset integer,
  source_chapter_updated_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.chapter_highlight_likes (
  highlight_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.chapter_highlights (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  chapter_id uuid NOT NULL,
  user_id uuid NOT NULL,
  text_content text NOT NULL,
  paragraph_index integer,
  context_before text,
  context_after text,
  note text,
  is_public boolean DEFAULT false NOT NULL,
  likes_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  client_request_id uuid,
  start_offset integer,
  end_offset integer,
  source_chapter_updated_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  ai_artifacts jsonb DEFAULT '{}'::jsonb NOT NULL,
  anchor jsonb,
  draft_text text DEFAULT ''::text NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  publication jsonb
);

CREATE TABLE public.chapter_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  chapter_id uuid NOT NULL,
  content text NOT NULL,
  version_number integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.chapters (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  edition_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  chapter_index integer NOT NULL,
  status chapter_status DEFAULT 'draft'::chapter_status NOT NULL,
  word_count integer DEFAULT 0 NOT NULL,
  view_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  published_at timestamp with time zone,
  audio_url text,
  duration_seconds integer,
  audio_blob_path text,
  audio_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  audio_content_type text,
  audio_file_size_bytes bigint,
  audio_uploaded_at timestamp with time zone
);

CREATE TABLE public.character_ai_settings (
  character_id uuid NOT NULL,
  model_id text DEFAULT 'openai/gpt-4o-mini'::text NOT NULL,
  temperature double precision DEFAULT 0.8 NOT NULL,
  max_output_tokens integer DEFAULT 1024 NOT NULL,
  total_timeout_ms integer DEFAULT 45000 NOT NULL,
  chunk_timeout_ms integer DEFAULT 10000 NOT NULL,
  user_turns_per_hour integer DEFAULT 60 NOT NULL,
  revision integer DEFAULT 1 NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.character_conversations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  character_id uuid NOT NULL,
  title text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.character_friendships (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  character_id uuid NOT NULL,
  status character_friendship_status DEFAULT 'accepted'::character_friendship_status NOT NULL,
  intimacy_level integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.character_games (
  character_id uuid NOT NULL,
  game_id uuid NOT NULL
);

CREATE TABLE public.character_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid NOT NULL,
  role character_message_role NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.character_passport_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  character_id uuid NOT NULL,
  content text NOT NULL,
  version_number integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.character_places (
  character_id uuid NOT NULL,
  place_id uuid NOT NULL,
  role text DEFAULT 'resident'::text NOT NULL
);

CREATE TABLE public.character_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  character_id uuid NOT NULL,
  content text NOT NULL,
  post_type text DEFAULT 'thought'::text NOT NULL,
  image_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  scheduled_at timestamp with time zone,
  author_user_id uuid
);

CREATE TABLE public.character_relationships (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  character_id uuid NOT NULL,
  related_character_id uuid NOT NULL,
  relationship_type text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.character_user_memories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  character_id uuid NOT NULL,
  summary text,
  facts jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.character_wall_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  character_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  hidden boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.characters (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  avatar text,
  bio text,
  full_description text,
  abilities jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  speaking_style text,
  personality text,
  boundaries text,
  knowledge_scope text,
  spoiler_policy text,
  reply_mode character_reply_mode DEFAULT 'ai_auto'::character_reply_mode NOT NULL,
  can_receive_messages boolean DEFAULT true NOT NULL,
  character_type character_type DEFAULT 'person'::character_type NOT NULL,
  passport text,
  map_image_url text,
  system_role text DEFAULT ''::text NOT NULL
);

CREATE TABLE public.comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  release_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  status comment_status DEFAULT 'pending'::comment_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.editions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  release_id uuid NOT NULL,
  format edition_format DEFAULT 'book'::edition_format NOT NULL,
  platform text,
  external_url text,
  slug text NOT NULL,
  status edition_status DEFAULT 'draft'::edition_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_primary boolean DEFAULT false NOT NULL,
  quality_tier text DEFAULT 'standard'::text NOT NULL,
  artwork_url text
);

CREATE TABLE public.game_user_events (
  id bigint GENERATED ALWAYS AS IDENTITY
    (SEQUENCE NAME public.game_user_events_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE) NOT NULL,
  game_id uuid NOT NULL,
  user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  kind character varying(32) NOT NULL,
  score integer,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.game_user_scores (
  game_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_score integer,
  best_score integer,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.games (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  tagline text,
  description text,
  cover_image text,
  aspect_ratio text DEFAULT '16:9'::text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  is_published boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  seo_title text,
  seo_description text,
  seo_noindex boolean DEFAULT false NOT NULL
);

CREATE TABLE public.highlight_generation_requests (
  highlight_id uuid NOT NULL,
  request_id uuid NOT NULL,
  state text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.highlight_materials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  highlight_id uuid NOT NULL,
  kind text NOT NULL,
  origin text NOT NULL,
  parent_id uuid,
  content text DEFAULT ''::text NOT NULL,
  blob_path text,
  legacy_image_url text,
  request_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.highlight_saves (
  user_id uuid NOT NULL,
  highlight_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.homepage_slides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  eyebrow text,
  description text,
  background_image text,
  mobile_image text,
  primary_cta_label text,
  primary_cta_href text,
  secondary_cta_label text,
  secondary_cta_href text,
  aside_label text,
  aside_number text,
  aside_text text,
  theme homepage_slide_theme DEFAULT 'atelier'::homepage_slide_theme NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.linked_accounts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  url text
);

CREATE TABLE public.magic_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  token character varying(64) NOT NULL,
  email character varying(255) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  link_token character varying(64),
  attempts integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.mcp_oauth_clients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  client_id_url text,
  client_uri text,
  logo_uri text,
  token_endpoint_auth_method text DEFAULT 'none'::text NOT NULL,
  metadata_fetched_at timestamp with time zone,
  last_used_at timestamp with time zone
);

CREATE TABLE public.mcp_oauth_codes (
  code_hash text NOT NULL,
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  resource text NOT NULL,
  scope text NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval) NOT NULL
);

CREATE TABLE public.mcp_oauth_events (
  id bigint DEFAULT nextval('mcp_oauth_events_id_seq'::regclass) NOT NULL,
  event text NOT NULL,
  client_id uuid,
  user_id uuid,
  ip_hash text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.mcp_oauth_grants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  resource text NOT NULL,
  scope text NOT NULL,
  access_token_hash text NOT NULL,
  access_expires_at timestamp with time zone DEFAULT (now() + '01:00:00'::interval) NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_used_at timestamp with time zone
);

CREATE TABLE public.mcp_oauth_refresh_tokens (
  token_hash text NOT NULL,
  grant_id uuid NOT NULL,
  used_at timestamp with time zone
);

CREATE TABLE public.news_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  section text NOT NULL,
  title text NOT NULL,
  tag text,
  display_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  content text,
  author_user_id uuid,
  cover_image text,
  status text DEFAULT 'draft'::text NOT NULL,
  published_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  slug text NOT NULL
);

CREATE TABLE public.places (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  avatar text,
  bio text,
  full_description text,
  map_image_url text,
  theme_color text,
  era text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.rate_limits (
  bucket character varying(64) NOT NULL,
  subject character varying(128) NOT NULL,
  window_start timestamp with time zone NOT NULL,
  hits integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.reading_progress (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  edition_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  user_id uuid,
  session_id text,
  progress_percent numeric(5,2) DEFAULT 0 NOT NULL,
  last_read_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.release_characters (
  release_id uuid NOT NULL,
  character_id uuid NOT NULL,
  role release_character_role DEFAULT 'supporting'::release_character_role NOT NULL
);

CREATE TABLE public.release_cities (
  release_id uuid NOT NULL,
  character_id uuid NOT NULL,
  role text DEFAULT 'location'::text NOT NULL,
  importance_score integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.release_collaborators (
  release_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role collaborator_role DEFAULT 'viewer'::collaborator_role NOT NULL
);

CREATE TABLE public.release_games (
  release_id uuid NOT NULL,
  game_id uuid NOT NULL
);

CREATE TABLE public.release_media (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  release_id uuid NOT NULL,
  type media_type DEFAULT 'other'::media_type NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.release_places (
  release_id uuid NOT NULL,
  place_id uuid NOT NULL,
  role text DEFAULT 'location'::text NOT NULL,
  importance_score integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.release_series (
  release_id uuid NOT NULL,
  series_id uuid NOT NULL,
  phase_number integer
);

CREATE TABLE public.release_theme_versions (
  release_id uuid NOT NULL,
  revision integer NOT NULL,
  theme jsonb NOT NULL,
  published boolean NOT NULL,
  author_id uuid
);

CREATE TABLE public.releases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  cover_image text,
  genre text,
  release_date date,
  isbn text,
  authors jsonb DEFAULT '[]'::jsonb NOT NULL,
  annotation text,
  editor_notes text,
  view_count integer DEFAULT 0 NOT NULL,
  status release_status DEFAULT 'draft'::release_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  design_config jsonb DEFAULT '{}'::jsonb NOT NULL,
  show_in_catalog boolean DEFAULT true NOT NULL
);

CREATE TABLE public.series (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role user_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text,
  handle text NOT NULL,
  display_name text NOT NULL,
  avatar text,
  bio text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  login text,
  password_hash text,
  is_deleted boolean DEFAULT false NOT NULL,
  deleted_at timestamp with time zone,
  tagline text,
  signature_color text,
  profile_is_public boolean DEFAULT true NOT NULL,
  show_reading boolean DEFAULT true NOT NULL,
  handle_changed_at timestamp with time zone,
  public_role public_role DEFAULT 'reader'::public_role NOT NULL,
  is_admin boolean DEFAULT false NOT NULL,
  showcase_releases uuid[]
);

ALTER SEQUENCE public.mcp_oauth_events_id_seq OWNED BY public.mcp_oauth_events.id;

ALTER TABLE public.bookmarks
  ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);

ALTER TABLE public.chapter_editorial_notes
  ADD CONSTRAINT chapter_editorial_notes_pkey PRIMARY KEY (id);

ALTER TABLE public.chapter_editorial_notes
  ADD CONSTRAINT chapter_editorial_notes_status_check CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text, 'ignored'::text]));

ALTER TABLE public.chapter_highlight_likes
  ADD CONSTRAINT chapter_highlight_likes_pkey PRIMARY KEY (highlight_id, user_id);

ALTER TABLE public.chapter_highlights
  ADD CONSTRAINT chapter_highlights_pkey PRIMARY KEY (id);

ALTER TABLE public.chapter_versions
  ADD CONSTRAINT chapter_versions_pkey PRIMARY KEY (id);

ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_chunk_timeout_range CHECK (chunk_timeout_ms >= 1000 AND chunk_timeout_ms <= 60000);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_model_approved CHECK (model_id = 'openai/gpt-4o-mini'::text);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_output_range CHECK (max_output_tokens >= 128 AND max_output_tokens <= 4096);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_pkey PRIMARY KEY (character_id);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_revision_positive CHECK (revision >= 1);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_temperature_range CHECK (temperature >= 0::double precision AND temperature <= 1.5::double precision);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_timeout_pair CHECK (chunk_timeout_ms < total_timeout_ms);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_total_timeout_range CHECK (total_timeout_ms >= 5000 AND total_timeout_ms <= 120000);

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_turns_range CHECK (user_turns_per_hour >= 1 AND user_turns_per_hour <= 600);

ALTER TABLE public.character_conversations
  ADD CONSTRAINT character_conversations_pkey PRIMARY KEY (id);

ALTER TABLE public.character_conversations
  ADD CONSTRAINT character_conversations_user_id_character_id_key UNIQUE (user_id, character_id);

ALTER TABLE public.character_friendships
  ADD CONSTRAINT character_friendships_pkey PRIMARY KEY (id);

ALTER TABLE public.character_friendships
  ADD CONSTRAINT character_friendships_user_id_character_id_key UNIQUE (user_id, character_id);

ALTER TABLE public.character_games
  ADD CONSTRAINT character_games_pkey PRIMARY KEY (character_id, game_id);

ALTER TABLE public.character_messages
  ADD CONSTRAINT character_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.character_passport_versions
  ADD CONSTRAINT character_passport_versions_pkey PRIMARY KEY (id);

ALTER TABLE public.character_places
  ADD CONSTRAINT character_places_pkey PRIMARY KEY (character_id, place_id);

ALTER TABLE public.character_posts
  ADD CONSTRAINT character_posts_pkey PRIMARY KEY (id);

ALTER TABLE public.character_relationships
  ADD CONSTRAINT character_relationships_character_id_related_character_id_key UNIQUE (character_id, related_character_id);

ALTER TABLE public.character_relationships
  ADD CONSTRAINT character_relationships_pkey PRIMARY KEY (id);

ALTER TABLE public.character_user_memories
  ADD CONSTRAINT character_user_memories_pkey PRIMARY KEY (id);

ALTER TABLE public.character_user_memories
  ADD CONSTRAINT character_user_memories_user_id_character_id_key UNIQUE (user_id, character_id);

ALTER TABLE public.character_wall_posts
  ADD CONSTRAINT character_wall_posts_pkey PRIMARY KEY (id);

ALTER TABLE public.characters
  ADD CONSTRAINT characters_pkey PRIMARY KEY (id);

ALTER TABLE public.characters
  ADD CONSTRAINT characters_slug_key UNIQUE (slug);

ALTER TABLE public.comments
  ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE public.editions
  ADD CONSTRAINT editions_pkey PRIMARY KEY (id);

ALTER TABLE public.editions
  ADD CONSTRAINT editions_quality_tier_check CHECK (quality_tier = ANY (ARRAY['draft'::text, 'standard'::text, 'premium'::text]));

ALTER TABLE public.editions
  ADD CONSTRAINT editions_slug_key UNIQUE (slug);

ALTER TABLE public.game_user_events
  ADD CONSTRAINT game_user_events_game_id_user_id_request_id_key UNIQUE (game_id, user_id, request_id);

ALTER TABLE public.game_user_events
  ADD CONSTRAINT game_user_events_kind_check CHECK (kind::text ~ '^[a-z][a-z0-9_]{0,31}$'::text);

ALTER TABLE public.game_user_events
  ADD CONSTRAINT game_user_events_pkey PRIMARY KEY (id);

ALTER TABLE public.game_user_events
  ADD CONSTRAINT game_user_events_score_check CHECK (score >= 0 AND score <= 1000000000);

ALTER TABLE public.game_user_scores
  ADD CONSTRAINT game_user_scores_pkey PRIMARY KEY (game_id, user_id);

ALTER TABLE public.games
  ADD CONSTRAINT games_aspect_ratio_check CHECK (aspect_ratio = ANY (ARRAY['16:9'::text, '4:3'::text, '1:1'::text, '9:16'::text]));

ALTER TABLE public.games
  ADD CONSTRAINT games_pkey PRIMARY KEY (id);

ALTER TABLE public.games
  ADD CONSTRAINT games_slug_key UNIQUE (slug);

ALTER TABLE public.highlight_generation_requests
  ADD CONSTRAINT highlight_generation_requests_pkey PRIMARY KEY (highlight_id, request_id);

ALTER TABLE public.highlight_generation_requests
  ADD CONSTRAINT highlight_generation_requests_state_check CHECK (state = ANY (ARRAY['running'::text, 'complete'::text, 'failed'::text]));

ALTER TABLE public.highlight_materials
  ADD CONSTRAINT highlight_materials_highlight_id_request_id_key UNIQUE (highlight_id, request_id);

ALTER TABLE public.highlight_materials
  ADD CONSTRAINT highlight_materials_kind_check CHECK (kind = ANY (ARRAY['text'::text, 'explain'::text, 'meaning'::text, 'rewrite'::text, 'image'::text]));

ALTER TABLE public.highlight_materials
  ADD CONSTRAINT highlight_materials_origin_check CHECK (origin = ANY (ARRAY['manual'::text, 'ai'::text, 'upload'::text]));

ALTER TABLE public.highlight_materials
  ADD CONSTRAINT highlight_materials_pkey PRIMARY KEY (id);

ALTER TABLE public.highlight_saves
  ADD CONSTRAINT highlight_saves_pkey PRIMARY KEY (user_id, highlight_id);

ALTER TABLE public.homepage_slides
  ADD CONSTRAINT homepage_slides_pkey PRIMARY KEY (id);

ALTER TABLE public.linked_accounts
  ADD CONSTRAINT linked_accounts_pkey PRIMARY KEY (id);

ALTER TABLE public.linked_accounts
  ADD CONSTRAINT linked_accounts_provider_provider_account_id_key UNIQUE (provider, provider_account_id);

ALTER TABLE public.magic_tokens
  ADD CONSTRAINT magic_tokens_pkey PRIMARY KEY (id);

ALTER TABLE public.magic_tokens
  ADD CONSTRAINT magic_tokens_token_key UNIQUE (token);

ALTER TABLE public.mcp_oauth_clients
  ADD CONSTRAINT mcp_oauth_clients_pkey PRIMARY KEY (id);

ALTER TABLE public.mcp_oauth_codes
  ADD CONSTRAINT mcp_oauth_codes_pkey PRIMARY KEY (code_hash);

ALTER TABLE public.mcp_oauth_codes
  ADD CONSTRAINT mcp_oauth_codes_scope_check CHECK (scope = 'canfly:content'::text);

ALTER TABLE public.mcp_oauth_events
  ADD CONSTRAINT mcp_oauth_events_pkey PRIMARY KEY (id);

ALTER TABLE public.mcp_oauth_grants
  ADD CONSTRAINT mcp_oauth_grants_access_token_hash_key UNIQUE (access_token_hash);

ALTER TABLE public.mcp_oauth_grants
  ADD CONSTRAINT mcp_oauth_grants_pkey PRIMARY KEY (id);

ALTER TABLE public.mcp_oauth_grants
  ADD CONSTRAINT mcp_oauth_grants_scope_check CHECK (scope = 'canfly:content'::text);

ALTER TABLE public.mcp_oauth_refresh_tokens
  ADD CONSTRAINT mcp_oauth_refresh_tokens_pkey PRIMARY KEY (token_hash);

ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_pkey PRIMARY KEY (id);

ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_slug_unique UNIQUE (slug);

ALTER TABLE public.places
  ADD CONSTRAINT places_pkey PRIMARY KEY (id);

ALTER TABLE public.places
  ADD CONSTRAINT places_slug_key UNIQUE (slug);

ALTER TABLE public.rate_limits
  ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (bucket, subject, window_start);

ALTER TABLE public.reading_progress
  ADD CONSTRAINT reading_progress_pkey PRIMARY KEY (id);

ALTER TABLE public.release_characters
  ADD CONSTRAINT release_characters_pkey PRIMARY KEY (release_id, character_id);

ALTER TABLE public.release_cities
  ADD CONSTRAINT release_cities_pkey PRIMARY KEY (release_id, character_id);

ALTER TABLE public.release_collaborators
  ADD CONSTRAINT release_collaborators_pkey PRIMARY KEY (release_id, user_id);

ALTER TABLE public.release_games
  ADD CONSTRAINT release_games_pkey PRIMARY KEY (release_id, game_id);

ALTER TABLE public.release_media
  ADD CONSTRAINT release_media_pkey PRIMARY KEY (id);

ALTER TABLE public.release_places
  ADD CONSTRAINT release_places_pkey PRIMARY KEY (release_id, place_id);

ALTER TABLE public.release_series
  ADD CONSTRAINT release_series_pkey PRIMARY KEY (release_id, series_id);

ALTER TABLE public.release_theme_versions
  ADD CONSTRAINT release_theme_versions_pkey PRIMARY KEY (release_id, revision);

ALTER TABLE public.release_theme_versions
  ADD CONSTRAINT release_theme_versions_revision_check CHECK (revision > 0);

ALTER TABLE public.releases
  ADD CONSTRAINT releases_pkey PRIMARY KEY (id);

ALTER TABLE public.releases
  ADD CONSTRAINT releases_slug_key UNIQUE (slug);

ALTER TABLE public.series
  ADD CONSTRAINT series_pkey PRIMARY KEY (id);

ALTER TABLE public.series
  ADD CONSTRAINT series_slug_key UNIQUE (slug);

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role);

ALTER TABLE public.users
  ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE public.users
  ADD CONSTRAINT users_handle_key UNIQUE (handle);

ALTER TABLE public.users
  ADD CONSTRAINT users_login_key UNIQUE (login);

ALTER TABLE public.users
  ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX idx_bookmarks_chapter ON public.bookmarks USING btree (chapter_id);

CREATE INDEX idx_bookmarks_user ON public.bookmarks USING btree (user_id);

CREATE INDEX idx_editorial_notes_chapter ON public.chapter_editorial_notes USING btree (chapter_id, status);

CREATE UNIQUE INDEX idx_editorial_notes_request ON public.chapter_editorial_notes USING btree (author_id, client_request_id) WHERE (client_request_id IS NOT NULL);

CREATE INDEX chapter_highlights_feed_page ON public.chapter_highlights USING btree (created_at DESC, id DESC) WHERE (is_public AND (publication IS NOT NULL));

CREATE INDEX idx_chapter_highlights_chapter ON public.chapter_highlights USING btree (chapter_id);

CREATE INDEX idx_chapter_highlights_public ON public.chapter_highlights USING btree (chapter_id, is_public);

CREATE UNIQUE INDEX idx_chapter_highlights_request ON public.chapter_highlights USING btree (user_id, client_request_id) WHERE (client_request_id IS NOT NULL);

CREATE INDEX idx_chapter_highlights_user ON public.chapter_highlights USING btree (user_id);

CREATE INDEX idx_chapter_highlights_user_public ON public.chapter_highlights USING btree (user_id, is_public, created_at DESC);

CREATE INDEX idx_chapter_versions_chapter ON public.chapter_versions USING btree (chapter_id);

CREATE INDEX idx_chapter_versions_number ON public.chapter_versions USING btree (chapter_id, version_number DESC);

CREATE INDEX chapters_feed_page ON public.chapters USING btree (created_at DESC, id DESC) WHERE (status = 'published'::chapter_status);

CREATE INDEX idx_chapters_edition ON public.chapters USING btree (edition_id);

CREATE INDEX idx_chapters_edition_index ON public.chapters USING btree (edition_id, chapter_index);

CREATE INDEX idx_character_conversations_user ON public.character_conversations USING btree (user_id);

CREATE INDEX idx_character_friendships_character ON public.character_friendships USING btree (character_id);

CREATE INDEX idx_character_friendships_user ON public.character_friendships USING btree (user_id);

CREATE INDEX idx_character_games_character ON public.character_games USING btree (character_id);

CREATE INDEX idx_character_games_game ON public.character_games USING btree (game_id);

CREATE INDEX idx_character_messages_conversation_created ON public.character_messages USING btree (conversation_id, created_at);

CREATE INDEX idx_passport_versions_character ON public.character_passport_versions USING btree (character_id);

CREATE INDEX idx_passport_versions_number ON public.character_passport_versions USING btree (character_id, version_number DESC);

CREATE INDEX idx_character_places_character ON public.character_places USING btree (character_id);

CREATE INDEX idx_character_places_place ON public.character_places USING btree (place_id);

CREATE INDEX character_posts_feed_page ON public.character_posts USING btree (created_at DESC, id DESC);

CREATE INDEX idx_character_posts_character ON public.character_posts USING btree (character_id);

CREATE INDEX idx_character_posts_created ON public.character_posts USING btree (created_at DESC);

CREATE INDEX idx_character_posts_visible ON public.character_posts USING btree (character_id, COALESCE(scheduled_at, created_at) DESC);

CREATE INDEX character_relationships_feed_page ON public.character_relationships USING btree (created_at DESC, id DESC);

CREATE INDEX idx_character_wall_posts_user ON public.character_wall_posts USING btree (user_id);

CREATE INDEX idx_character_wall_posts_visible ON public.character_wall_posts USING btree (character_id, hidden, created_at DESC);

CREATE INDEX idx_characters_name_trgm ON public.characters USING gin (name gin_trgm_ops);

CREATE INDEX idx_characters_slug ON public.characters USING btree (slug);

CREATE INDEX idx_characters_type ON public.characters USING btree (character_type);

CREATE INDEX idx_comments_release ON public.comments USING btree (release_id);

CREATE INDEX idx_comments_status ON public.comments USING btree (status);

CREATE INDEX idx_comments_user ON public.comments USING btree (user_id);

CREATE INDEX idx_editions_quality_tier ON public.editions USING btree (quality_tier);

CREATE INDEX idx_editions_release ON public.editions USING btree (release_id);

CREATE INDEX idx_editions_release_format_status ON public.editions USING btree (release_id, format, status);

CREATE INDEX idx_editions_slug ON public.editions USING btree (slug);

CREATE INDEX idx_editions_status ON public.editions USING btree (status);

CREATE INDEX idx_game_user_events_recent ON public.game_user_events USING btree (game_id, user_id, created_at DESC, id DESC);

CREATE INDEX idx_games_slug ON public.games USING btree (slug);

CREATE INDEX highlight_materials_page ON public.highlight_materials USING btree (highlight_id, created_at DESC, id);

CREATE INDEX highlight_saves_page ON public.highlight_saves USING btree (user_id, created_at DESC);

CREATE INDEX idx_homepage_slides_active_order ON public.homepage_slides USING btree (is_active, display_order);

CREATE INDEX idx_linked_accounts_user_id ON public.linked_accounts USING btree (user_id);

CREATE INDEX magic_tokens_email_active_idx ON public.magic_tokens USING btree (email) WHERE (used = false);

CREATE INDEX magic_tokens_email_idx ON public.magic_tokens USING btree (email);

CREATE UNIQUE INDEX magic_tokens_link_token_idx ON public.magic_tokens USING btree (link_token) WHERE (link_token IS NOT NULL);

CREATE INDEX magic_tokens_token_idx ON public.magic_tokens USING btree (token);

CREATE UNIQUE INDEX mcp_oauth_clients_client_id_url_key ON public.mcp_oauth_clients USING btree (client_id_url) WHERE (client_id_url IS NOT NULL);

CREATE INDEX mcp_oauth_codes_client_id_idx ON public.mcp_oauth_codes USING btree (client_id);

CREATE INDEX mcp_oauth_codes_expires_at_idx ON public.mcp_oauth_codes USING btree (expires_at);

CREATE INDEX mcp_oauth_codes_user_id_idx ON public.mcp_oauth_codes USING btree (user_id);

CREATE INDEX mcp_oauth_events_created_at_idx ON public.mcp_oauth_events USING btree (created_at DESC);

CREATE INDEX mcp_oauth_events_user_id_idx ON public.mcp_oauth_events USING btree (user_id);

CREATE INDEX mcp_oauth_grants_client_id_idx ON public.mcp_oauth_grants USING btree (client_id);

CREATE INDEX mcp_oauth_grants_user_id_idx ON public.mcp_oauth_grants USING btree (user_id);

CREATE INDEX mcp_oauth_refresh_grant_id_idx ON public.mcp_oauth_refresh_tokens USING btree (grant_id);

CREATE INDEX idx_news_posts_author ON public.news_posts USING btree (author_user_id);

CREATE INDEX idx_news_posts_order ON public.news_posts USING btree (display_order);

CREATE INDEX idx_news_posts_published ON public.news_posts USING btree (status, published_at DESC);

CREATE INDEX idx_news_posts_slug ON public.news_posts USING btree (slug);

CREATE INDEX idx_news_posts_status ON public.news_posts USING btree (status);

CREATE INDEX idx_news_title_trgm ON public.news_posts USING gin (title gin_trgm_ops);

CREATE INDEX idx_places_slug ON public.places USING btree (slug);

CREATE INDEX places_feed_page ON public.places USING btree (created_at DESC, id DESC);

CREATE INDEX rate_limits_window_idx ON public.rate_limits USING btree (window_start);

CREATE INDEX idx_reading_progress_edition ON public.reading_progress USING btree (edition_id);

CREATE INDEX idx_reading_progress_session ON public.reading_progress USING btree (session_id) WHERE (session_id IS NOT NULL);

CREATE UNIQUE INDEX idx_reading_progress_session_unique ON public.reading_progress USING btree (edition_id, chapter_id, session_id) WHERE (session_id IS NOT NULL);

CREATE INDEX idx_reading_progress_user ON public.reading_progress USING btree (user_id) WHERE (user_id IS NOT NULL);

CREATE INDEX idx_reading_progress_user_recent ON public.reading_progress USING btree (user_id, last_read_at DESC) WHERE (user_id IS NOT NULL);

CREATE UNIQUE INDEX idx_reading_progress_user_unique ON public.reading_progress USING btree (edition_id, chapter_id, user_id) WHERE (user_id IS NOT NULL);

CREATE INDEX idx_release_characters_character ON public.release_characters USING btree (character_id);

CREATE INDEX idx_release_characters_main ON public.release_characters USING btree (character_id) WHERE (role = 'main'::release_character_role);

CREATE INDEX idx_release_cities_character ON public.release_cities USING btree (character_id);

CREATE INDEX idx_release_cities_release ON public.release_cities USING btree (release_id);

CREATE INDEX idx_release_collaborators_user ON public.release_collaborators USING btree (user_id);

CREATE INDEX idx_release_games_game ON public.release_games USING btree (game_id);

CREATE INDEX idx_release_games_release ON public.release_games USING btree (release_id);

CREATE INDEX idx_release_media_release ON public.release_media USING btree (release_id);

CREATE INDEX idx_release_places_place ON public.release_places USING btree (place_id);

CREATE INDEX idx_release_places_release ON public.release_places USING btree (release_id);

CREATE INDEX idx_release_series_series ON public.release_series USING btree (series_id);

CREATE INDEX release_theme_published_idx ON public.release_theme_versions USING btree (release_id, revision DESC) WHERE published;

CREATE INDEX idx_releases_release_date ON public.releases USING btree (release_date DESC);

CREATE INDEX idx_releases_slug ON public.releases USING btree (slug);

CREATE INDEX idx_releases_status ON public.releases USING btree (status);

CREATE INDEX idx_releases_status_date ON public.releases USING btree (status, release_date DESC NULLS LAST, created_at DESC);

CREATE INDEX idx_releases_title_trgm ON public.releases USING gin (title gin_trgm_ops);

CREATE INDEX idx_series_slug ON public.series USING btree (slug);

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);

CREATE UNIQUE INDEX idx_users_handle_lower ON public.users USING btree (lower(handle)) WHERE (is_deleted = false);

CREATE INDEX idx_users_is_deleted ON public.users USING btree (is_deleted) WHERE (is_deleted = true);

CREATE INDEX idx_users_public_role ON public.users USING btree (public_role) WHERE (is_deleted = false);

ALTER TABLE public.bookmarks
  ADD CONSTRAINT bookmarks_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE;

ALTER TABLE public.bookmarks
  ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.chapter_editorial_notes
  ADD CONSTRAINT chapter_editorial_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id);

ALTER TABLE public.chapter_editorial_notes
  ADD CONSTRAINT chapter_editorial_notes_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE;

ALTER TABLE public.chapter_highlight_likes
  ADD CONSTRAINT chapter_highlight_likes_highlight_id_fkey FOREIGN KEY (highlight_id) REFERENCES chapter_highlights(id) ON DELETE CASCADE;

ALTER TABLE public.chapter_highlight_likes
  ADD CONSTRAINT chapter_highlight_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.chapter_highlights
  ADD CONSTRAINT chapter_highlights_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE;

ALTER TABLE public.chapter_highlights
  ADD CONSTRAINT chapter_highlights_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.chapter_versions
  ADD CONSTRAINT chapter_versions_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE;

ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_ai_settings
  ADD CONSTRAINT character_ai_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE public.character_conversations
  ADD CONSTRAINT character_conversations_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_conversations
  ADD CONSTRAINT character_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.character_friendships
  ADD CONSTRAINT character_friendships_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_friendships
  ADD CONSTRAINT character_friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.character_games
  ADD CONSTRAINT character_games_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_games
  ADD CONSTRAINT character_games_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

ALTER TABLE public.character_messages
  ADD CONSTRAINT character_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES character_conversations(id) ON DELETE CASCADE;

ALTER TABLE public.character_passport_versions
  ADD CONSTRAINT character_passport_versions_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_places
  ADD CONSTRAINT character_places_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_places
  ADD CONSTRAINT character_places_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;

ALTER TABLE public.character_posts
  ADD CONSTRAINT character_posts_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE public.character_posts
  ADD CONSTRAINT character_posts_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_relationships
  ADD CONSTRAINT character_relationships_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_relationships
  ADD CONSTRAINT character_relationships_related_character_id_fkey FOREIGN KEY (related_character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_user_memories
  ADD CONSTRAINT character_user_memories_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_user_memories
  ADD CONSTRAINT character_user_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.character_wall_posts
  ADD CONSTRAINT character_wall_posts_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.character_wall_posts
  ADD CONSTRAINT character_wall_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.editions
  ADD CONSTRAINT editions_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.game_user_events
  ADD CONSTRAINT game_user_events_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

ALTER TABLE public.game_user_events
  ADD CONSTRAINT game_user_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.game_user_scores
  ADD CONSTRAINT game_user_scores_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

ALTER TABLE public.game_user_scores
  ADD CONSTRAINT game_user_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.highlight_generation_requests
  ADD CONSTRAINT highlight_generation_requests_highlight_id_fkey FOREIGN KEY (highlight_id) REFERENCES chapter_highlights(id) ON DELETE CASCADE;

ALTER TABLE public.highlight_materials
  ADD CONSTRAINT highlight_materials_highlight_id_fkey FOREIGN KEY (highlight_id) REFERENCES chapter_highlights(id) ON DELETE CASCADE;

ALTER TABLE public.highlight_materials
  ADD CONSTRAINT highlight_materials_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES highlight_materials(id) ON DELETE SET NULL;

ALTER TABLE public.highlight_saves
  ADD CONSTRAINT highlight_saves_highlight_id_fkey FOREIGN KEY (highlight_id) REFERENCES chapter_highlights(id) ON DELETE CASCADE;

ALTER TABLE public.highlight_saves
  ADD CONSTRAINT highlight_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.linked_accounts
  ADD CONSTRAINT linked_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.mcp_oauth_codes
  ADD CONSTRAINT mcp_oauth_codes_client_id_fkey FOREIGN KEY (client_id) REFERENCES mcp_oauth_clients(id) ON DELETE CASCADE;

ALTER TABLE public.mcp_oauth_codes
  ADD CONSTRAINT mcp_oauth_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.mcp_oauth_events
  ADD CONSTRAINT mcp_oauth_events_client_id_fkey FOREIGN KEY (client_id) REFERENCES mcp_oauth_clients(id) ON DELETE SET NULL;

ALTER TABLE public.mcp_oauth_events
  ADD CONSTRAINT mcp_oauth_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE public.mcp_oauth_grants
  ADD CONSTRAINT mcp_oauth_grants_client_id_fkey FOREIGN KEY (client_id) REFERENCES mcp_oauth_clients(id) ON DELETE CASCADE;

ALTER TABLE public.mcp_oauth_grants
  ADD CONSTRAINT mcp_oauth_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.mcp_oauth_refresh_tokens
  ADD CONSTRAINT mcp_oauth_refresh_tokens_grant_id_fkey FOREIGN KEY (grant_id) REFERENCES mcp_oauth_grants(id) ON DELETE CASCADE;

ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES users(id);

ALTER TABLE public.reading_progress
  ADD CONSTRAINT reading_progress_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE;

ALTER TABLE public.reading_progress
  ADD CONSTRAINT reading_progress_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE;

ALTER TABLE public.reading_progress
  ADD CONSTRAINT reading_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.release_characters
  ADD CONSTRAINT release_characters_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.release_characters
  ADD CONSTRAINT release_characters_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.release_cities
  ADD CONSTRAINT release_cities_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

ALTER TABLE public.release_cities
  ADD CONSTRAINT release_cities_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.release_collaborators
  ADD CONSTRAINT release_collaborators_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.release_collaborators
  ADD CONSTRAINT release_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.release_games
  ADD CONSTRAINT release_games_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

ALTER TABLE public.release_games
  ADD CONSTRAINT release_games_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.release_media
  ADD CONSTRAINT release_media_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.release_places
  ADD CONSTRAINT release_places_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;

ALTER TABLE public.release_places
  ADD CONSTRAINT release_places_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.release_series
  ADD CONSTRAINT release_series_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.release_series
  ADD CONSTRAINT release_series_series_id_fkey FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE;

ALTER TABLE public.release_theme_versions
  ADD CONSTRAINT release_theme_versions_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE public.release_theme_versions
  ADD CONSTRAINT release_theme_versions_release_id_fkey FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE TRIGGER update_editorial_notes_updated_at BEFORE UPDATE ON chapter_editorial_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapter_highlights_updated_at BEFORE UPDATE ON chapter_highlights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON chapters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_conversations_updated_at BEFORE UPDATE ON character_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_friendships_updated_at BEFORE UPDATE ON character_friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_wall_posts_updated_at BEFORE UPDATE ON character_wall_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_editions_updated_at BEFORE UPDATE ON editions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_homepage_slides_updated_at BEFORE UPDATE ON homepage_slides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_places_updated_at BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_releases_updated_at BEFORE UPDATE ON releases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_series_updated_at BEFORE UPDATE ON series FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
