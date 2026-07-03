import Link from 'next/link'
import { BookOpen, Newspaper, ArrowLeft } from 'lucide-react'
import { requireStudioSession } from '@/lib/server/studio-auth'
import { createDraftAction, type DraftType } from '@/lib/actions/studio-create'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Новый объект | Studio — canfly',
}

export default async function NewObjectHubPage() {
  const session = await requireStudioSession()
  if (!session) redirect('/login')

  const types: {
    type: DraftType
    title: string
    description: string
    icon: React.ReactNode
    accent: string
  }[] = [
    {
      type: 'release',
      title: 'Релиз',
      description: 'Книга, комикс, аудио, журнал или альбом',
      icon: <BookOpen className="h-7 w-7" />,
      accent: 'text-cf-warm',
    },
    {
      type: 'news',
      title: 'Новость',
      description: 'Заметка, анонс или маршрут из вселенной canfly',
      icon: <Newspaper className="h-7 w-7" />,
      accent: 'text-cf-blue',
    },
  ]

  return (
    <div className="min-h-screen bg-cf-bg">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-8 md:py-14">
        <Link
          href="/studio"
          className="mb-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cf-text-3 hover:text-cf-text-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в Studio
        </Link>

        <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-cf-accent">
          создать новый объект
        </p>
        <h1 className="font-[family-name:var(--font-cormorant)] text-5xl font-bold italic leading-[0.9] text-cf-text-heading md:text-6xl">
          Что создаём?
        </h1>
        <p className="mt-4 text-sm text-cf-text-caption">
          Выберите тип контента — будет создан пустой черновик, и вы перейдёте в редактор.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {types.map((item) => (
            <form key={item.type} action={createDraftAction}>
              <input type="hidden" name="type" value={item.type} />
              <button
                type="submit"
                className="group flex w-full flex-col gap-4 border border-cf-text-1/10 bg-cf-bg-2 p-6 text-left transition-colors hover:border-cf-warm/45"
              >
                <span className={`${item.accent}`}>{item.icon}</span>
                <span className="text-xl font-black uppercase tracking-[0.04em] text-cf-text-heading group-hover:text-cf-accent transition-colors">
                  {item.title}
                </span>
                <span className="text-sm leading-6 text-cf-text-caption">
                  {item.description}
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  )
}
