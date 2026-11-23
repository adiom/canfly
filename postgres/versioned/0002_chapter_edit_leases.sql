CREATE TABLE public.chapter_edit_leases (
  chapter_id uuid NOT NULL,
  user_id uuid,
  actor_kind text NOT NULL,
  session_id text NOT NULL,
  lease_token text NOT NULL,
  generation bigint DEFAULT 1 NOT NULL,
  acquired_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  released_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT chapter_edit_leases_pkey PRIMARY KEY (chapter_id),
  CONSTRAINT chapter_edit_leases_chapter_id_fkey FOREIGN KEY (chapter_id)
    REFERENCES public.chapters(id) ON DELETE CASCADE,
  CONSTRAINT chapter_edit_leases_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT chapter_edit_leases_actor_kind_check
    CHECK (actor_kind = ANY (ARRAY['studio'::text, 'mcp'::text])),
  CONSTRAINT chapter_edit_leases_actor_check
    CHECK (actor_kind = 'mcp' OR user_id IS NOT NULL),
  CONSTRAINT chapter_edit_leases_session_id_check
    CHECK (char_length(session_id) >= 8 AND char_length(session_id) <= 128),
  CONSTRAINT chapter_edit_leases_token_check
    CHECK (lease_token ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chapter_edit_leases_generation_check
    CHECK (generation > 0),
  CONSTRAINT chapter_edit_leases_ttl_check
    CHECK (expires_at >= acquired_at)
);

CREATE INDEX chapter_edit_leases_expiry_idx
  ON public.chapter_edit_leases (expires_at);
