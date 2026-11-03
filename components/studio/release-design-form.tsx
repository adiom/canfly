'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { unstable_rethrow } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Release, ReleaseDesignConfig } from '@/lib/releases-types'
import { updateReleaseDesignAction } from '@/lib/actions/studio'
import { ReleaseSaveBar } from '@/components/studio/release-save-bar'
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
  accent_color: '#d52525',
  bg_color: '#111210',
  text_color: '#f4efe5',
  hero_style: 'full',
  hero_overlay: 'gradient',
  layout: 'narrow',
  show_toc: true,
  show_characters: true,
  show_series: true,
}

const presets: { label: string; config: ReleaseDesignConfig }[] = [
  {
    label: 'canfly (default)',
    config: { accent_color: '#d52525', bg_color: '#111210', text_color: '#f4efe5', hero_style: 'full', hero_overlay: 'gradient', layout: 'narrow', show_toc: true, show_characters: true, show_series: true },
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
  const [baseline, setBaseline] = useState(config)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(config) !== JSON.stringify(baseline)

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

  return (
    <form onSubmit={save} aria-label="Оформление релиза" aria-busy={saving}>
      <div className="paper-section-heading">
        <div><h2>Оформление</h2><p className="paper-help">Как читатели увидят страницу релиза.</p></div>
      </div>
      <figure className="paper-design-preview">
        <figcaption><span>Предпросмотр страницы</span><span>Обновляется сразу</span></figcaption>
        <div className="paper-preview" data-hero={config.hero_style} data-layout={config.layout} style={{ backgroundColor: background, color: text }}>
          <div className="paper-preview-hero">
            {preview.cover_image && config.hero_style !== 'minimal' && (
              <div className="paper-preview-cover">
                <Image src={preview.cover_image} alt="" fill sizes="(max-width: 440px) 240px, 740px" className="object-cover" unoptimized />
                {config.hero_overlay !== 'none' && <span className="absolute inset-0" style={{ background: config.hero_overlay === 'dark' ? 'rgba(0, 0, 0, 0.5)' : `linear-gradient(to bottom, transparent, ${background})` }} />}
              </div>
            )}
            <div className="paper-preview-copy">
              <span className="paper-preview-eyebrow" style={{ color: accent }}>canfly · релиз</span>
              <h3>{preview.title || 'Без названия'}</h3>
              <p>{(preview.annotation || preview.description || 'Описание появится здесь.').slice(0, 180)}</p>
            </div>
          </div>
          <div className="paper-preview-sections" style={{ borderColor: accent }}>
            {sectionFields.filter(field => config[field.key]).map(field => <span key={field.key}>{field.label}</span>)}
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
              <span>{preset.label === 'canfly (default)' ? 'canfly' : preset.label}</span>
            </Button>
          ))}
        </div>
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
          </div>
        </details>
      </fieldset>
      <ReleaseSaveBar dirty={dirty} saving={saving} saved={saved} error={error} label="Сохранить оформление" />
    </form>
  )
}
