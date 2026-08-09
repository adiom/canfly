'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { AdminUserProfile, Character, NewsPost, UserRole } from '@/lib/types';
import Link from 'next/link';

const userRoles: UserRole[] = ['reader', 'author', 'editor', 'admin'];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'characters' | 'news' | 'users'>('characters');
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState({ login: '', password: '', display_name: '' });
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [charsRes, newsRes, usersRes] = await Promise.all([
          fetch('/api/admin/characters'),
          fetch('/api/admin/news'),
          fetch('/api/admin/users'),
        ]);

        if (
          charsRes.status === 401 ||
          newsRes.status === 401 ||
          usersRes.status === 401
        ) {
          router.push('/admin/login');
          return;
        }

        if (charsRes.ok) {
          const data = await charsRes.json();
          setCharacters(data);
        } else {
          setError('Не удалось загрузить персонажей');
        }

        if (newsRes.ok) {
          const data = await newsRes.json();
          setNewsPosts(data);
        } else {
          setError('Не удалось загрузить новости');
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data);
        } else {
          setError('Не удалось загрузить пользователей');
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Ошибка загрузки админки');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  const deleteCharacter = async (character: Character) => {
    if (!window.confirm(`Удалить персонажа "${character.name}"?`)) return;

    const response = await fetch(`/api/admin/characters/${character.id}`, { method: 'DELETE' });

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setError('Не удалось удалить персонажа');
      return;
    }

    setCharacters((current) => current.filter((item) => item.id !== character.id));
  };

  const deleteNews = async (post: NewsPost) => {
    if (!window.confirm(`Удалить новость "${post.title}"?`)) return;

    const response = await fetch(`/api/admin/news/${post.id}`, { method: 'DELETE' });

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setError('Не удалось удалить новость');
      return;
    }

    setNewsPosts((current) => current.filter((item) => item.id !== post.id));
  };

  const reloadUsers = async () => {
    const response = await fetch('/api/admin/users');

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setError('Не удалось загрузить пользователей');
      return;
    }

    setUsers(await response.json());
  };

  const createUser = async () => {
    setError('');
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newUser,
        roles: ['reader'],
      }),
    });

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || 'Не удалось создать пользователя');
      return;
    }

    setNewUser({ login: '', password: '', display_name: '' });
    await reloadUsers();
  };

  const toggleUserRole = async (user: AdminUserProfile, role: UserRole) => {
    const roles = user.roles.includes(role)
      ? user.roles.filter((item) => item !== role)
      : [...user.roles, role];

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles }),
    });

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setError('Не удалось обновить роли');
      return;
    }

    setUsers((current) =>
      current.map((item) => (item.id === user.id ? { ...item, roles } : item)),
    );
  };

  const changeUserPassword = async (user: AdminUserProfile) => {
    const password = passwordDrafts[user.id] || '';

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setError('Не удалось сменить пароль');
      return;
    }

    setPasswordDrafts((current) => ({ ...current, [user.id]: '' }));
  };

  const deleteUser = async (user: AdminUserProfile) => {
    if (!window.confirm(`Скрыть пользователя "${user.display_name}"? Запись останется в БД.`)) {
      return;
    }

    const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || 'Не удалось скрыть пользователя');
      return;
    }

    setUsers((current) => current.filter((item) => item.id !== user.id));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Загрузка...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 backdrop-blur-sm sticky top-0 z-50 bg-slate-900/80">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            Canfly Admin
          </Link>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
          >
            Выход
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start gap-3 rounded-md border border-purple-900/60 bg-purple-950/30 px-4 py-3 text-sm text-purple-100">
          <span aria-hidden>✨</span>
          <p>
            Управление персонажами теперь в{' '}
            <Link href="/studio/characters" className="font-semibold underline underline-offset-2 hover:text-purple-50">
              Студии
            </Link>
            . Здесь остались слайды и пользователи. Релизы, издания и главы — в{' '}
            <Link href="/studio" className="font-semibold underline underline-offset-2 hover:text-purple-50">
              Студии
            </Link>
            .
          </p>
        </div>
        {error && (
          <div className="mb-6 rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-4 mb-8 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'characters'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Персонажи ({characters.length})
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'news'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Новости ({newsPosts.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'users'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Пользователи ({users.length})
          </button>
        </div>

        {/* Characters Tab */}
        {activeTab === 'characters' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Управление персонажами</h2>
              <Link href="/admin/characters/new">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Добавить персонажа
                </Button>
              </Link>
            </div>

            <div className="space-y-4">
              {characters.map((char) => (
                <div key={char.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{char.name}</h3>
                    <p className="text-slate-400 text-sm line-clamp-1">{char.bio}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/characters/${char.id}/edit`}>
                      <Button variant="outline" size="sm">Редактировать</Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => deleteCharacter(char)}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Управление новостями</h2>
              <Link href="/admin/news/new">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Добавить новость
                </Button>
              </Link>
            </div>

            <div className="space-y-4">
              {newsPosts.length > 0 ? (
                newsPosts.map((post) => (
                  <div key={post.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex justify-between items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{post.title}</h3>
                        <span className={`rounded-full px-2 py-1 text-xs ${
                          post.is_active
                            ? 'bg-green-900/50 text-green-200'
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          {post.is_active ? 'активна' : 'скрыта'}
                        </span>
                        <span className="rounded-full bg-slate-950 px-2 py-1 text-xs text-slate-400">
                          #{post.display_order}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">
                        {post.section}{post.tag ? ` • ${post.tag}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link href={`/news/${post.id}`} target="_blank">
                        <Button variant="outline" size="sm">Просмотр</Button>
                      </Link>
                      <Link href={`/admin/news/${post.id}/edit`}>
                        <Button variant="outline" size="sm">Редактировать</Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => deleteNews(post)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400">
                  Новости пока не добавлены
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Пользователи и роли</h2>
              <p className="mt-1 text-sm text-slate-400">
                Пользователь входит по login/password. Пароль меняет только админ.
              </p>
            </div>

            <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800 p-6">
              <h3 className="mb-4 text-lg font-bold text-white">Создать пользователя</h3>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  value={newUser.login}
                  onChange={(event) => setNewUser((current) => ({ ...current, login: event.target.value }))}
                  placeholder="login"
                  className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                />
                <input
                  value={newUser.display_name}
                  onChange={(event) => setNewUser((current) => ({ ...current, display_name: event.target.value }))}
                  placeholder="имя"
                  className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                />
                <input
                  value={newUser.password}
                  onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                  placeholder="пароль"
                  type="password"
                  className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                />
                <Button
                  type="button"
                  onClick={createUser}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Создать
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {users.length > 0 ? (
                users.map((user) => (
                  <div key={user.id} className="rounded-lg border border-slate-700 bg-slate-800 p-6">
                    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">{user.display_name}</h3>
                        <p className="text-sm text-slate-400">
                          {user.login ? `login: ${user.login}` : `@${user.handle}`} • друзей: {user.friends_count} • диалогов: {user.conversations_count}
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        {new Date(user.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>

                    <div className="mb-5 flex flex-wrap gap-2">
                      {userRoles.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleUserRole(user, role)}
                          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                            user.roles.includes(role)
                              ? 'border-purple-400 bg-purple-950/50 text-purple-200'
                              : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-700 pt-4 md:flex-row md:items-center">
                      <input
                        value={passwordDrafts[user.id] || ''}
                        onChange={(event) =>
                          setPasswordDrafts((current) => ({
                            ...current,
                            [user.id]: event.target.value,
                          }))
                        }
                        placeholder="новый пароль"
                        type="password"
                        className="h-10 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => changeUserPassword(user)}
                      >
                        Сменить пароль
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => deleteUser(user)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400">
                  Пользователей пока нет
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-20 py-8 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>&copy; 2024 Canfly Admin Panel</p>
        </div>
      </footer>
    </main>
  );
}
