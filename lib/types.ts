export type HomepageSlideTheme = 'atelier' | 'night-city' | 'pvz' | 'volga' | 'dreams';

export interface NewsPost {
  id: string;
  slug: string;
  section: string;
  title: string;
  content: string | null;
  tag: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  author_user_id: string | null;
  cover_image: string | null;
  status: string;
  published_at: string | null;
  updated_at: string;
}

export interface Character {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  bio: string | null;
  full_description: string | null;
  abilities: string[] | null;
  speaking_style: string | null;
  personality: string | null;
  boundaries: string | null;
  knowledge_scope: string | null;
  spoiler_policy: string | null;
  /**
   * Системная инструкция для чат-бота персонажа. Задаётся в Studio
   * (редактирование персонажа) и подставляется в system-промпт модели
   * вместо ранее захардкоженного characterPrompts. Пустая строка — чат
   * отключён (route вернёт 503, страница чата покажет «не настроено»).
   */
  system_role: string;
  reply_mode: CharacterReplyMode;
  can_receive_messages: boolean;
  character_type: CharacterType;
  passport: string | null;
  map_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type PublicRole = 'reader' | 'author';
export type SystemRole = 'editor';
export type CharacterType = 'person' | 'city';

export interface Place {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  bio: string | null;
  full_description: string | null;
  map_image_url: string | null;
  theme_color: string | null;
  era: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleasePlaceLink {
  release_id: string;
  release_slug: string;
  release_title: string;
  role: string;
}

export interface CharacterPlaceLink {
  character_id: string;
  character_name: string;
  character_slug: string;
  character_avatar: string | null;
  role: string;
}
export type CharacterReplyMode = 'ai_auto' | 'manual' | 'hybrid' | 'disabled';
export type CharacterFriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type CharacterMessageRole = 'user' | 'character' | 'system';
export interface UserProfile {
  id: string;
  email: string | null;
  login: string | null;
  handle: string;
  display_name: string;
  avatar: string | null;
  bio: string | null;
  /** Одна строка под именем в профиле */
  tagline: string | null;
  /** id цвета из CANFLY_COLORS; null — цвет ещё не выбран, берётся дефолт по users.id */
  signature_color: string | null;
  profile_is_public: boolean;
  show_reading: boolean;
  handle_changed_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  public_role: PublicRole;
  is_admin: boolean;
  showcase_releases: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserProfile extends UserProfile {
  system_roles: SystemRole[];
  friends_count: number;
  conversations_count: number;
}

export interface CharacterFriendship {
  id: string;
  user_id: string;
  character_id: string;
  status: CharacterFriendshipStatus;
  intimacy_level: number;
  created_at: string;
  updated_at: string;
}

export interface CharacterConversation {
  id: string;
  user_id: string;
  character_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterMessage {
  id: string;
  conversation_id: string;
  role: CharacterMessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type CharacterPostType = 'thought' | 'announcement' | 'question';

export interface CharacterPost {
  id: string;
  character_id: string;
  content: string;
  post_type: CharacterPostType;
  image_url: string | null;
  scheduled_at: string | null;
  author_user_id: string | null;
  created_at: string;
}

export interface CharacterPostWithCharacter extends CharacterPost {
  character: {
    id: string;
    name: string;
    slug: string;
    avatar: string | null;
  };
}

export interface CharacterWallPost {
  id: string;
  character_id: string;
  user_id: string;
  content: string;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterWallPostWithUser extends CharacterWallPost {
  user: {
    id: string;
    handle: string;
    display_name: string;
    avatar: string | null;
  };
}

export interface CharacterStats {
  friends: number;
  posts: number;
  relations: number;
  /** Дата последнего видимого поста — «когда герой говорил в последний раз» */
  last_spoke_at: string | null;
}

export interface CharacterFriendSummary {
  id: string;
  handle: string;
  display_name: string;
  avatar: string | null;
  intimacy_level: number;
}


export interface CharacterRelationship {
  id: string;
  character_id: string;
  related_character_id: string;
  relationship_type: string;
  description: string | null;
  created_at: string;
}

/** Связь вместе с героем, на которого она указывает — чтобы показать имя, а не uuid */
export interface CharacterRelationshipWithTarget extends CharacterRelationship {
  related_name: string;
  related_slug: string;
  related_avatar: string | null;
  related_type: CharacterType;
}

export type HighlightType = 'quote' | 'editorial_comment' | 'author_note';
export type HighlightVisibility = 'public' | 'internal' | 'private';
export type HighlightStatus = 'pending' | 'resolved' | 'ignored';

export interface HomepageSlide {
  id: string;
  title: string;
  eyebrow: string | null;
  description: string | null;
  background_image: string | null;
  mobile_image: string | null;
  primary_cta_label: string | null;
  primary_cta_href: string | null;
  secondary_cta_label: string | null;
  secondary_cta_href: string | null;
  aside_label: string | null;
  aside_number: string | null;
  aside_text: string | null;
  theme: HomepageSlideTheme;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}
