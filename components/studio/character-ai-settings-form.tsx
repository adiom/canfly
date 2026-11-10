'use client'

import { useActionState } from 'react'
import { Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CHARACTER_AI_LIMITS,
  APPROVED_MODEL_IDS,
} from '@/lib/ai/character-chat/config'
import type { CharacterAiSettingsSchemaStatus } from '@/lib/server/character-ai-settings'
import {
  saveCharacterAiSettingsAction,
  type CharacterAiSettingsFormState,
} from '@/lib/actions/studio-character-ai'

const INITIAL_CHARACTER_AI_FORM_STATE: CharacterAiSettingsFormState = {
  status: 'idle',
  message: '',
}

export interface CharacterAiSettingsFormValues {
  modelId: string
  temperature: number
  maxOutputTokens: number
  totalTimeoutMs: number
  chunkTimeoutMs: number
  userTurnsPerHour: number
}

interface CharacterAiSettingsFormProps {
  characterId: string
  initial: CharacterAiSettingsFormValues
  canManage: boolean
  schema: CharacterAiSettingsSchemaStatus
  updatedAt: string | null
}

function formatDateTime(value: string | null): string {
  if (!value) return 'нет данных'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'нет данных'
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

/**
 * Технические параметры хода. Модель показана только для чтения: список
 * утверждённых моделей намеренно узкий, а смена production-модели — отдельное
 * решение, а не поле формы.
 */
export function CharacterAiSettingsForm({
  characterId,
  initial,
  canManage,
  schema,
  updatedAt,
}: CharacterAiSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    saveCharacterAiSettingsAction,
    INITIAL_CHARACTER_AI_FORM_STATE,
  )

  const disabled = !canManage || pending
  const schemaMissing = schema !== 'available'

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="modelId" value={initial.modelId} />

      <div className="rounded-2xl border border-white/70 bg-white/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              Модель
            </p>
            <p className="mt-1 font-mono text-sm text-gray-800">{initial.modelId}</p>
          </div>
          <p className="max-w-xs text-xs leading-5 text-gray-500">
            Утверждённые модели: {APPROVED_MODEL_IDS.join(', ')}. Смена модели
            выполняется отдельным решением, не этой формой.
          </p>
        </div>
      </div>

      {schemaMissing && (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-800">
          Схема <code className="font-mono">character_ai_settings</code> не установлена.
          Runtime использует defaults, а сохранение станет доступно после применения
          аддитивной миграции <code className="font-mono">postgres/033_character_ai_settings.sql</code>.
        </p>
      )}

      {!canManage && (
        <p className="rounded-xl border border-gray-200/80 bg-gray-50/80 px-4 py-3 text-sm leading-6 text-gray-600">
          Просмотр доступен автору и администратору, изменение технических
          параметров — только администратору. Авторская инструкция правится в
          карточке персонажа.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="temperature"
          label="Temperature"
          hint={`от ${CHARACTER_AI_LIMITS.temperature.min} до ${CHARACTER_AI_LIMITS.temperature.max}`}
          name="temperature"
          value={initial.temperature}
          min={CHARACTER_AI_LIMITS.temperature.min}
          max={CHARACTER_AI_LIMITS.temperature.max}
          step={0.1}
          disabled={disabled}
        />
        <Field
          id="maxOutputTokens"
          label="Max output, токенов"
          hint={`от ${CHARACTER_AI_LIMITS.maxOutputTokens.min} до ${CHARACTER_AI_LIMITS.maxOutputTokens.max}`}
          name="maxOutputTokens"
          value={initial.maxOutputTokens}
          min={CHARACTER_AI_LIMITS.maxOutputTokens.min}
          max={CHARACTER_AI_LIMITS.maxOutputTokens.max}
          step={1}
          disabled={disabled}
        />
        <Field
          id="totalTimeoutMs"
          label="Общий timeout, мс"
          hint={`от ${CHARACTER_AI_LIMITS.totalTimeoutMs.min} до ${CHARACTER_AI_LIMITS.totalTimeoutMs.max}`}
          name="totalTimeoutMs"
          value={initial.totalTimeoutMs}
          min={CHARACTER_AI_LIMITS.totalTimeoutMs.min}
          max={CHARACTER_AI_LIMITS.totalTimeoutMs.max}
          step={1000}
          disabled={disabled}
        />
        <Field
          id="chunkTimeoutMs"
          label="Пауза между чанками, мс"
          hint={`меньше общего timeout, от ${CHARACTER_AI_LIMITS.chunkTimeoutMs.min}`}
          name="chunkTimeoutMs"
          value={initial.chunkTimeoutMs}
          min={CHARACTER_AI_LIMITS.chunkTimeoutMs.min}
          max={CHARACTER_AI_LIMITS.chunkTimeoutMs.max}
          step={1000}
          disabled={disabled}
        />
        <Field
          id="userTurnsPerHour"
          label="Ходов на пользователя в час"
          hint={`от ${CHARACTER_AI_LIMITS.userTurnsPerHour.min} до ${CHARACTER_AI_LIMITS.userTurnsPerHour.max}; это не денежный бюджет`}
          name="userTurnsPerHour"
          value={initial.userTurnsPerHour}
          min={CHARACTER_AI_LIMITS.userTurnsPerHour.min}
          max={CHARACTER_AI_LIMITS.userTurnsPerHour.max}
          step={1}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          Обновлено: {formatDateTime(updatedAt)}
        </p>
        {canManage && (
          <Button
            type="submit"
            disabled={pending || schemaMissing}
            className="h-10 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600"
          >
            <Save className="mr-2 h-4 w-4" />
            {pending ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        )}
      </div>

      {state.status !== 'idle' && state.message && (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`rounded-xl px-4 py-3 text-sm leading-6 ${
            state.status === 'error'
              ? 'border border-red-200/80 bg-red-50/80 text-red-700'
              : 'border border-emerald-200/80 bg-emerald-50/80 text-emerald-700'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  name,
  value,
  min,
  max,
  step,
  disabled,
}: {
  id: string
  label: string
  hint: string
  name: string
  value: number
  min: number
  max: number
  step: number
  disabled: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-gray-700">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type="number"
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="h-10 rounded-xl border-white/70 bg-white/70"
      />
      <p className="text-[11px] leading-4 text-gray-400">{hint}</p>
    </div>
  )
}
