/** @deprecated Books system retired. Use Release system instead. */
export type BookType = 'comic' | 'book' | 'audiobook';

/** @deprecated Books system retired. Use Release system instead. */
export interface BookChapter {
  title: string;
  content: string;
}
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
export type HomepageSlideTheme = 'atelier' | 'night-city' | 'pvz' | 'volga' | 'dreams';

/** @deprecated Books system retired. Use Release system instead. */
export interface Book {
  id: string;
  title: string;
  slug: string;
  type: BookType;
  description: string | null;
  cover_image: string | null;
  preview_pages: string[] | null;
  chapters?: BookChapter[] | null;
  external_links: Record<string, string> | null;
  price: number | null;
  is_featured: boolean;
  display_order: number;
  label: string | null;
  tone: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsPost {
  id: string;
  section: string;
  title: string;
  content: string | null;
  tag: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

/** @deprecated Books system retired. */
export interface BookCharacterLink {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  bio: string | null;
}

/** @deprecated Books system retired. */
export interface BookWithCharacters extends Book {
  characters?: BookCharacterLink[];
  character_ids?: string[];
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
  reply_mode: CharacterReplyMode;
  can_receive_messages: boolean;
  character_type: CharacterType;
  passport: string | null;
  map_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'reader' | 'author' | 'editor' | 'admin';
export type CharacterType = 'person' | 'city';
export type CharacterReplyMode = 'ai_auto' | 'manual' | 'hybrid' | 'disabled';
export type CharacterFriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type CharacterMessageRole = 'user' | 'character' | 'system';
/** @deprecated Books system retired. */
export type BookCharacterRole = 'main' | 'supporting' | 'cameo' | 'mentioned';

export interface UserProfile {
  id: string;
  email: string | null;
  login: string | null;
  handle: string;
  display_name: string;
  avatar: string | null;
  bio: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserProfile extends UserProfile {
  roles: UserRole[];
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

/** @deprecated Books system retired. */
export interface CharacterBookAppearance {
  id: string;
  title: string;
  slug: string;
  type: BookType;
  cover_image: string | null;
  role: BookCharacterRole;
  importance_score: number;
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
  books: number;
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

export interface OrderItem {
  book_id: string;
  title: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Books system retired. Cart system needs migration to Release. */
export interface CartItem {
  bookId: string;
  title: string;
  price: number;
  quantity: number;
  image: string | null;
}

export type HighlightType = 'quote' | 'editorial_comment' | 'author_note';
export type HighlightVisibility = 'public' | 'internal' | 'private';
export type HighlightStatus = 'pending' | 'resolved' | 'ignored';

export interface Highlight {
  id: string;
  /** @deprecated book_id from retired books system */
  book_id: string;
  user_id: string;
  chapter_index: number;
  text_content: string;
  comment: string | null;
  type: HighlightType;
  visibility: HighlightVisibility;
  status: HighlightStatus;
  range_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChapterRating {
  id: string;
  /** @deprecated book_id from retired books system */
  book_id: string;
  chapter_index: number;
  user_id: string;
  rating: number;
  created_at: string;
}

/** @deprecated Books system retired. */
export interface BookReview {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

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
