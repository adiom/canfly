'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { unstable_rethrow } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Release, ReleaseDesignConfig } from '@/lib/releases-types'
import { updateReleaseDesignAction } from '@/lib/actions/studio'
import { RELEASE_BLOCK_LABELS, RELEASE_DESIGN_DEFAULTS, releaseBlockOrder, type ReleaseBlock } from '@/lib/release-design'
import { useUnsavedReleaseChanges } from '@/components/studio/use-unsaved-release-changes'
import { ReleaseSaveBar } from '@/components/studio/release-save-bar'
import { ReleaseHeroArt } from '@/components/release/release-hero-art'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const defaultConfig: Required<ReleaseDesignConfig> = {
  ...RELEASE_DESIGN_DEFAULTS,
  block_order: releaseBlockOrder(),
  hidden_blocks: [],
  cover_fit: 'cover',
  show_toc: true,
  show_characters: true,
  show_series: true,
}

const presets: { label: string; config: ReleaseDesignConfig }[] = [
  {
    label: 'Canfly',
    config: defaultConfig,
  },
  {
    label: 'Тёмный минимал',
    config: { accent_color: '#9db5c8', bg_color: '#0c0d0c', text_color: '#ded7cc', hero_style: 'minimal', hero_overlay: 'none', layout: 'narrow', show_toc: true, show_characters: false, show_series: false },
  },
  {
    label: 'Светлый',
    config: { accent_color: '#d52525', bg_color: '#f4efe5', text_color: '#111210', hero_style: 'centered', hero_overlay: 'none', layout: 'wide', show_toc: true, show_characters: true, show_series: true },
  },
  {
    label: 'Артхаус',
    config: { accent_color: '#f6d6a8', bg_color: '#1b1c19', text_color: '#d7c6ad', hero_style: 'full', hero_overlay: 'dark', layout: 'sidebar', show_toc: true, show_characters: true, show_series: true },
  },
]

const heroLabels = { full: 'Полный', centered: 'По центру', minimal: 'Минимальный' }
const artLabels = { none: 'Без графики', svg: 'Линии SVG', canvas: 'Линии Canvas' }
const overlayLabels = { dark: 'Тёмное', gradient: 'Градиент', none: 'Без затемнения' }
const layoutLabels = { wide: 'Широкая', narrow: 'Узкая', sidebar: 'С боковой колонкой' }
const colorFields = [
  { key: 'accent_color', label: 'Акцент', picker: 'Выбрать цвет акцента' },
  { key: 'bg_color', label: 'Фон', picker: 'Выбрать цвет фона' },
  { key: 'text_color', label: 'Текст', picker: 'Выбрать цвет текста' },
] as const
const sectionFields = [
  { key: 'show_toc', label: 'Оглавление' },
  { key: 'show_characters', label: 'Персонажи' },
  { key: 'show_series', label: 'Серия' },
] as const

type PreviewRelease = Pick<Release, 'title' | 'description' | 'annotation' | 'cover_image'>

export function ReleaseDesignForm({ release, preview = release }: { release: Release; preview?: PreviewRelease }) {
  const [config, setConfig] = useState<Required<ReleaseDesignConfig>>(() => ({ ...defaultConfig, ...release.design_config }))
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [baseline, setBaseline] = useState(config)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(config) !== JSON.stringify(baseline)
  useUnsavedReleaseChanges(dirty)
  const order = releaseBlockOrder(config.block_order)

  function moveBlock(block: ReleaseBlock, shift: number) {
    const index = order.indexOf(block)
    const target = index + shift
    if (target < 0 || target >= order.length) return
    const next = [...order]
    next.splice(index, 1)
    next.splice(target, 0, block)
    update('block_order', next)
  }

  function update<K extends keyof ReleaseDesignConfig>(key: K, value: Required<ReleaseDesignConfig>[K]) {
    setConfig(previous => ({ ...previous, [key]: value }))
    setError(null)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !dirty) return
    const submitted = config
    setSaving(true)
    setError(null)
    try {
      await updateReleaseDesignAction(release.id, submitted)
      setBaseline(submitted)
      setSaved(true)
      toast.success('Оформление сохранено')
    } catch (cause) {
      unstable_rethrow(cause)
      setError('Не удалось сохранить оформление. Попробуйте ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  const validColor = (key: typeof colorFields[number]['key']) => /^#[\da-f]{6}$/i.test(config[key]) ? config[key] : defaultConfig[key]
  const accent = validColor('accent_color')
  const background = validColor('bg_color')
  const text = validColor('text_color')
  const art = config.hero_style !== 'minimal' && config.hero_art !== 'none' ? config.hero_art : null

  return (
    <form onSubmit={save} aria-label="Оформление релиза" aria-busy={saving} className="release-design-editor">
      <div className="paper-section-heading">
        <div><h2>Оформление</h2><p className="paper-help">Как читатели увидят страницу релиза.</p></div>
      </div>
      <figure className="paper-design-preview">
        <figcaption><span>Эскиз оформления</span><span>Обновляется сразу</span></figcaption>
        <div className="my-3 flex flex-wrap gap-2" aria-label="Размер эскиза">
          <Button type="button" variant="outline" size="sm" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>Компьютер</Button>
          <Button type="button" variant="outline" size="sm" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>Телефон</Button>
        </div>
        <div className="paper-preview mx-auto" data-hero={config.hero_style} data-layout={config.layout} style={{ backgroundColor: background, color: text, maxWidth: viewport === 'mobile' ? 360 : undefined }}>
          <div className="paper-preview-hero">
            {config.hero_style !== 'minimal' && (preview.cover_image || art) ? (
              <div className="paper-preview-cover isolate" style={{ backgroundColor: `color-mix(in srgb, ${background} 68%, #6a9ab8)` }}>
                {art ? <ReleaseHeroArt mode={art} interactive={false} /> : null}
                {preview.cover_image ? (
                  <div className="absolute inset-[12%]">
                    <Image src={preview.cover_image} alt="" fill sizes="(max-width: 440px) 100px, 160px" className={config.cover_fit === 'contain' ? 'object-contain' : 'object-cover'} unoptimized />
                    {config.hero_overlay !== 'none' ? <span className="absolute inset-0" style={{ background: config.hero_overlay === 'dark' ? 'rgba(0, 0, 0, 0.5)' : `linear-gradient(to bottom, transparent, ${background})` }} /> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="paper-preview-copy">
              <span className="paper-preview-eyebrow" style={{ color: accent }}>canfly · релиз</span>
              <h3>{preview.title || 'Без названия'}</h3>
              <p>{(preview.annotation || preview.description || 'Описание появится здесь.').slice(0, 180)}</p>
            </div>
          </div>
          <div className="paper-preview-sections" style={{ borderColor: accent }}>
            {order.filter(block => !config.hidden_blocks.includes(block) && (block !== 'characters' || config.show_characters) && (block !== 'series' || config.show_series))
              .map(block => <span key={block}>{RELEASE_BLOCK_LABELS[block]}</span>)}
          </div>
        </div>
      </figure>
      <fieldset disabled={saving}>
        <legend className="paper-field-label">Предустановки</legend>
        <div className="paper-presets">
          {presets.map(preset => (
            <Button type="button" key={preset.label} variant="outline" className="paper-preset" aria-pressed={JSON.stringify(config) === JSON.stringify({ ...defaultConfig, ...preset.config })} onClick={() => {
              setConfig({ ...defaultConfig, ...preset.config })
              setError(null)
            }}>
              <span className="paper-preset-swatch" style={{ background: preset.config.bg_color, borderLeftColor: preset.config.accent_color, color: preset.config.text_color }} aria-hidden="true">Aa</span>
              <span>{preset.label}</span>
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { setConfig(defaultConfig); setError(null) }}>Сбросить оформление</Button>
        <div className="paper-colors">
          {colorFields.map(field => (
            <div className="paper-field" key={field.key}>
              <Label htmlFor={`release-${field.key}`}>{field.label}</Label>
              <div className="paper-color-control">
                <Input type="color" value={validColor(field.key)} aria-label={field.picker} onChange={event => update(field.key, event.target.value)} />
                <Input id={`release-${field.key}`} value={config[field.key]} onChange={event => update(field.key, event.target.value)} pattern="#[a-fA-F0-9]{6}" title="Цвет в формате #RRGGBB" required spellCheck={false} />
              </div>
            </div>
          ))}
        </div>
        <details className="paper-details">
          <summary>Композиция и разделы<ChevronDown className="size-4" aria-hidden="true" /></summary>
          <div className="paper-details-body">
            <div className="paper-field-row">
              <div className="paper-field">
                <Label htmlFor="release-hero">Первый экран</Label>
                <Select value={config.hero_style} disabled={saving} onValueChange={value => update('hero_style', value as keyof typeof heroLabels)}>
                  <SelectTrigger id="release-hero"><SelectValue /></SelectTrigger>
                  <SelectContent className="paper-theme paper-select">{Object.entries(heroLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="paper-field">
                <Label htmlFor="release-overlay">Затемнение</Label>
                <Select value={config.hero_overlay} disabled={saving} onValueChange={value => update('hero_overlay', value as keyof typeof overlayLabels)}>
                  <SelectTrigger id="release-overlay"><SelectValue /></SelectTrigger>
                  <SelectContent className="paper-theme paper-select">{Object.entries(overlayLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="paper-field">
              <Label htmlFor="release-hero-art">Графика первого экрана</Label>
              <Select value={config.hero_art} disabled={config.hero_style === 'minimal'} onValueChange={value => update('hero_art', value as keyof typeof artLabels)}>
                <SelectTrigger id="release-hero-art"><SelectValue /></SelectTrigger>
                <SelectContent className="paper-theme paper-select">{Object.entries(artLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="paper-help">Линии отображаются статично. Читатель может запустить движение.</p>
            </div>
            <div className="paper-field">
              <Label htmlFor="release-design-layout">Ширина и структура</Label>
              <Select value={config.layout} disabled={saving} onValueChange={value => update('layout', value as keyof typeof layoutLabels)}>
                <SelectTrigger id="release-design-layout"><SelectValue /></SelectTrigger>
                <SelectContent className="paper-theme paper-select">{Object.entries(layoutLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="paper-checks">
              {sectionFields.map(field => (
                <label className="paper-check" key={field.key}>
                  <input type="checkbox" checked={config[field.key]} onChange={event => update(field.key, event.target.checked)} />{field.label}
                </label>
              ))}
            </div>
            <div className="paper-field">
              <Label htmlFor="release-cover-fit">Композиция обложки</Label>
              <Select value={config.cover_fit} onValueChange={value => update('cover_fit', value === 'contain' ? 'contain' : 'cover')}>
                <SelectTrigger id="release-cover-fit"><SelectValue /></SelectTrigger>
                <SelectContent className="paper-theme paper-select">
                  <SelectItem value="cover">Заполнить рамку</SelectItem>
                  <SelectItem value="contain">Показать целиком</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ol aria-label="Порядок разделов" className="grid gap-2">
              {order.map((block, index) => (
                <li key={block} className="flex flex-wrap items-center justify-between gap-2">
                  <label className="paper-check">
                    <input type="checkbox" checked={!config.hidden_blocks.includes(block)} onChange={event => update('hidden_blocks', event.target.checked
                      ? config.hidden_blocks.filter(item => item !== block)
                      : [...config.hidden_blocks, block])} />
                    {RELEASE_BLOCK_LABELS[block]}
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={index === 0} aria-label={`${RELEASE_BLOCK_LABELS[block]} выше`} onClick={() => moveBlock(block, -1)}>↑</Button>
                    <Button type="button" variant="outline" size="sm" disabled={index === order.length - 1} aria-label={`${RELEASE_BLOCK_LABELS[block]} ниже`} onClick={() => moveBlock(block, 1)}>↓</Button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </details>
      </fieldset>
      <ReleaseSaveBar dirty={dirty} saving={saving} saved={saved} error={error} label="Сохранить оформление" />
    </form>
  )
}
