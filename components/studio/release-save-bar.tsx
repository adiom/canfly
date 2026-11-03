import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ReleaseSaveBar({
  dirty, saving, saved, error, label, disabled = false, uploading = false,
}: {
  dirty: boolean
  saving: boolean
  saved: boolean
  error: string | null
  label: string
  disabled?: boolean
  uploading?: boolean
}) {
  return (
    <footer className="paper-savebar">
      <div className="min-w-0">
        <p role="status" className="paper-help">
          {uploading ? 'Загружаю обложку…' : saving ? 'Сохраняю…' : dirty ? 'Есть несохранённые изменения' : saved ? 'Изменения сохранены' : 'Нет изменений'}
        </p>
        {error && <p role="alert" className="paper-error">{error}</p>}
      </div>
      <Button type="submit" className="paper-button paper-button-primary" disabled={!dirty || saving || uploading || disabled}>
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
        {label}
      </Button>
    </footer>
  )
}
