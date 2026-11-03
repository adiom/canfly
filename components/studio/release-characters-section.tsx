'use client'

import { useState, type FormEvent } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ReleaseCharacter, ReleaseCharacterRole } from '@/lib/releases-types'
import { updateReleaseCharactersAction } from '@/lib/actions/studio'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ReleaseSaveBar } from '@/components/studio/release-save-bar'

interface Character {
  id: string
  name: string
  slug: string
  avatar: string | null
}

type CharacterLink = Pick<ReleaseCharacter, 'character_id' | 'role'>
const ROLE_LABELS: Record<ReleaseCharacterRole, string> = { main: 'Главный', supporting: 'Второстепенный', cameo: 'Камео' }

function signature(links: CharacterLink[]) {
  return JSON.stringify([...links].sort((left, right) => left.character_id.localeCompare(right.character_id)))
}

export function ReleaseCharactersSection({ releaseId, characters, releaseCharacters }: {
  releaseId: string
  characters: Character[]
  releaseCharacters: ReleaseCharacter[]
}) {
  const [selected, setSelected] = useState<CharacterLink[]>(() => releaseCharacters.map(({ character_id, role }) => ({ character_id, role })))
  const [baseline, setBaseline] = useState(() => signature(selected))
  const [candidate, setCandidate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const available = characters.filter(character => !selected.some(link => link.character_id === character.id))
  const dirty = signature(selected) !== baseline

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !dirty) return
    const submitted = selected
    setSaving(true)
    setError(null)
    try {
      await updateReleaseCharactersAction(releaseId, submitted)
      setBaseline(signature(submitted))
      setSaved(true)
      toast.success('Персонажи сохранены')
    } catch (cause) {
      unstable_rethrow(cause)
      setError('Не удалось сохранить персонажей. Попробуйте ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} aria-label="Персонажи релиза" aria-busy={saving}>
      <div className="paper-section-heading">
        <div><h2>Персонажи</h2><p className="paper-help">Общий состав для всех изданий этого релиза.</p></div>
        <span className="paper-help">Выбрано: {selected.length}</span>
      </div>
      <fieldset disabled={saving}>
        <div className="paper-character-list">
          {selected.length === 0 && <p className="paper-empty">Пока нет связанных персонажей.</p>}
          {selected.map(link => {
            const character = characters.find(item => item.id === link.character_id)
            if (!character) return null
            return (
              <div className="paper-character" key={link.character_id}>
                <Avatar className="paper-avatar">
                  {character.avatar && <AvatarImage src={character.avatar} alt="" />}
                  <AvatarFallback>{character.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="paper-character-name"><h3>{character.name}</h3><p>/{character.slug}</p></div>
                <Select value={link.role} disabled={saving} onValueChange={value => {
                  setSelected(previous => previous.map(item => item.character_id === link.character_id ? { ...item, role: value as ReleaseCharacterRole } : item))
                  setError(null)
                }}>
                  <SelectTrigger className="paper-role" aria-label={`Роль: ${character.name}`}><SelectValue /></SelectTrigger>
                  <SelectContent className="paper-theme paper-select">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon-sm" className="paper-unlink" aria-label={`Отвязать персонажа ${character.name}`} onClick={() => {
                  setSelected(previous => previous.filter(item => item.character_id !== link.character_id))
                  setError(null)
                }}><X className="size-4" aria-hidden="true" /></Button>
              </div>
            )
          })}
        </div>
        <div className="paper-character-picker">
          <div className="paper-field">
            <Label htmlFor="release-character">Связать персонажа</Label>
            <Select value={candidate} onValueChange={setCandidate} disabled={saving || available.length === 0}>
              <SelectTrigger id="release-character"><SelectValue placeholder={available.length ? 'Выберите из существующих' : 'Нет доступных персонажей'} /></SelectTrigger>
              <SelectContent className="paper-theme paper-select">
                {available.map(character => <SelectItem key={character.id} value={character.id}>{character.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" className="paper-button" disabled={!candidate || saving} onClick={() => {
            if (!candidate || selected.some(link => link.character_id === candidate)) return
            setSelected(previous => [...previous, { character_id: candidate, role: 'supporting' }])
            setCandidate('')
            setError(null)
          }}><Plus className="size-4" aria-hidden="true" />Связать</Button>
        </div>
      </fieldset>
      <ReleaseSaveBar dirty={dirty} saving={saving} saved={saved} error={error} label="Сохранить персонажей" />
    </form>
  )
}
