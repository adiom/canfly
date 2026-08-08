'use client'

import { useActionState, useState, useTransition } from 'react'
import Image from 'next/image'
import { CANFLY_COLORS, type CanflyColor } from '@/lib/canfly-colors'
import type { SessionUser } from '@/lib/server/session'
import type { SignatureTheme } from '@/lib/user-signature'
import {
  changeHandle,
  updateAvatar,
  updateIdentity,
  updateSignatureColor,
  updateVisibility,
} from '@/lib/actions/user-profile'
import type { ActionResult } from '@/lib/actions/user-profile'

const initial: ActionResult = { status: 'idle' }

const LABEL_BY_FIELD = {
  identity: 'Личность',
  handle: 'Адрес',
  passport: 'Паспорт',
  visibility: 'Видимость',
} as const

function SectionLabel({ id, children }: { id: keyof typeof LABEL_BY_FIELD; children: string }) {
  return (
    <p
      id={id}
      className="scroll-mt-24 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent"
    >
      {children}
    </p>
  )
}

function StatusLine({ result }: { result: ActionResult }) {
  if (result.status === 'idle') return null
  const tone =
    result.status === 'success'
      ? 'border-cf-text-1/15 text-cf-text-2'
      : 'border-cf-accent/40 bg-cf-accent/10 text-cf-accent'
  return <p className={`border px-3 py-2 text-xs ${tone}`}>{result.message}</p>
}

export function UserSettingsClient({
  user,
  theme,
}: {
  user: SessionUser
  theme: SignatureTheme
}) {
  const [identity, identityAction] = useActionState(updateIdentity, initial)
  const [handle, handleAction] = useActionState(changeHandle, initial)
  const [avatar, setAvatar] = useState<string | null>(user.avatar)
  const [, startAvatar] = useTransition()
  const [activeColor, setActiveColor] = useState<CanflyColor>(theme.color)
  const [, startColor] = useTransition()
  const [profilePublic, setProfilePublic] = useState(user.profile_is_public)
  const [showReading, setShowReading] = useState(user.show_reading)
  const [, startVisibility] = useTransition()

  async function uploadAvatar(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/user/avatar', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) return alert(json.error ?? 'Ошибка загрузки')
    const result = await updateAvatar(json.url)
    if (result.status === 'success') setAvatar(json.url)
    else alert(result.message ?? 'Ошибка')
  }

  function pickColor(colorId: string) {
    const color = CANFLY_COLORS.find(c => c.id === colorId) ?? CANFLY_COLORS[0]
    setActiveColor(color)
    startColor(async () => {
      const result = await updateSignatureColor(colorId)
      if (result.status === 'error') alert(result.message ?? 'Ошибка')
    })
  }

  function applyVisibility(nextPublic: boolean, nextReading: boolean) {
    setProfilePublic(nextPublic)
    setShowReading(nextReading)
    startVisibility(async () => {
      const result = await updateVisibility({
        profile_is_public: nextPublic,
        show_reading: nextReading,
      })
      if (result.status === 'error') alert(result.message ?? 'Ошибка')
    })
  }

  return (
    <>
      <section>
        <SectionLabel id="identity">{LABEL_BY_FIELD.identity}</SectionLabel>
        <form action={identityAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-sm text-cf-text-2">Аватар</span>
            <div className="mt-2 flex items-center gap-4">
              <div
                className="relative h-16 w-16 overflow-hidden border-2 bg-cf-bg-2"
                style={{ borderColor: activeColor.hex }}
              >
                {avatar ? (
                  <Image src={avatar} alt="" fill sizes="64px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-[family-name:var(--font-cormorant)] text-2xl italic text-cf-text-3">
                    {user.display_name.slice(0, 1).toLowerCase()}
                  </span>
                )}
              </div>
              <label className="h-9 cursor-pointer border border-cf-text-1/15 px-4 text-xs font-bold uppercase tracking-[0.12em] text-cf-text-2 hover:border-cf-text-1/30 hover:text-cf-text-1 inline-flex items-center">
                Загрузить
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      startAvatar(() => uploadAvatar(file).catch(() => {}))
                    }
                  }}
                />
              </label>
            </div>
          </label>

          <label className="block">
            <span className="block text-sm text-cf-text-2">Имя</span>
            <input
              name="display_name"
              defaultValue={user.display_name}
              maxLength={60}
              required
              className="mt-1 h-11 w-full border border-cf-text-1/10 bg-cf-bg-2 px-3 text-cf-text-1 focus:border-cf-text-1/30 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-sm text-cf-text-2">Подпись · одна строка под именем</span>
            <input
              name="tagline"
              defaultValue={user.tagline ?? ''}
              maxLength={90}
              className="mt-1 h-11 w-full border border-cf-text-1/10 bg-cf-bg-2 px-3 italic text-cf-text-1 focus:border-cf-text-1/30 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-sm text-cf-text-2">О себе</span>
            <textarea
              name="bio"
              defaultValue={user.bio ?? ''}
              maxLength={600}
              rows={4}
              className="mt-1 w-full border border-cf-text-1/10 bg-cf-bg-2 p-3 leading-7 text-cf-text-caption focus:border-cf-text-1/30 focus:outline-none"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-11 bg-cf-accent px-5 font-black uppercase tracking-[0.1em] text-sm text-white hover:bg-[#b81e1e]"
            >
              Сохранить
            </button>
            <StatusLine result={identity} />
          </div>
        </form>
      </section>

      <section>
        <SectionLabel id="handle">{LABEL_BY_FIELD.handle}</SectionLabel>
        <form action={handleAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-sm text-cf-text-2">Публичный адрес</span>
            <div className="mt-1 flex items-center border border-cf-text-1/10 bg-cf-bg-2 focus-within:border-cf-text-1/30">
              <span className="px-3 font-mono text-sm text-cf-text-3">canfly.bio/</span>
              <input
                name="handle"
                defaultValue={user.handle ?? ''}
                pattern="[a-z0-9][a-z0-9_-]{2,23}"
                required
                className="h-11 flex-1 bg-transparent pr-3 text-cf-text-1 focus:outline-none"
              />
            </div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
              Латиница · цифры · дефис · от 3 до 24 · менять не чаще раза в 14 дней
            </p>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-11 border border-cf-text-1/15 px-5 font-bold uppercase tracking-[0.1em] text-sm text-cf-text-2 hover:border-cf-text-1/30 hover:text-cf-text-1"
            >
              Сменить
            </button>
            <StatusLine result={handle} />
          </div>
        </form>
      </section>

      <section>
        <SectionLabel id="passport">{LABEL_BY_FIELD.passport}</SectionLabel>
        <p className="mt-6 text-sm text-cf-text-3">
          Цвет паспорта красит полосу на твоей странице. Выбираешь один раз — потом меняется.
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {CANFLY_COLORS.map(color => {
            const active = color.id === activeColor.id
            return (
              <li key={color.id}>
                <button
                  type="button"
                  onClick={() => pickColor(color.id)}
                  className="group block w-full text-left transition-transform hover:-translate-y-0.5"
                  aria-pressed={active}
                >
                  <span
                    className="block aspect-square w-full border-2"
                    style={{
                      backgroundColor: color.hex,
                      borderColor: active ? color.hex : 'transparent',
                      boxShadow: active ? `0 0 0 2px var(--cf-bg)` : undefined,
                    }}
                  />
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3 group-hover:text-cf-text-1">
                    {color.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <SectionLabel id="visibility">{LABEL_BY_FIELD.visibility}</SectionLabel>
        <div className="mt-6 space-y-4">
          <label className="flex cursor-pointer items-start gap-3 border border-cf-text-1/10 bg-cf-bg-2 p-4">
            <input
              type="checkbox"
              checked={profilePublic}
              onChange={e => applyVisibility(e.target.checked, showReading)}
              className="mt-1 h-4 w-4 accent-cf-accent"
            />
            <span>
              <span className="block text-sm text-cf-text-1">Профиль открыт</span>
              <span className="block text-xs text-cf-text-3">
                Кто угодно видит canfly.bio/{user.handle}. Если выключить — 404 для всех, кроме тебя.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 border border-cf-text-1/10 bg-cf-bg-2 p-4">
            <input
              type="checkbox"
              checked={showReading}
              onChange={e => applyVisibility(profilePublic, e.target.checked)}
              className="mt-1 h-4 w-4 accent-cf-accent"
            />
            <span>
              <span className="block text-sm text-cf-text-1">Показывать чтение</span>
              <span className="block text-xs text-cf-text-3">
                Полка «читает» и керн видны публично. Сам профиль остаётся открытым.
              </span>
            </span>
          </label>
        </div>
      </section>
    </>
  )
}