import { redirect } from 'next/navigation'
import { ClientMagicLinkSection } from './client-magic-link-section'

type PageProps = {
  params: Promise<{ token: string }>
}

// Токен здесь НЕ гасится: погашение происходит только в Credentials.authorize,
// то есть по явному POST от пользователя. Иначе ссылку съедал бы первый же
// префетчер — почтовый клиент, антивирус-сканер или unfurl в мессенджере.
export default async function MagicLinkPage({ params }: PageProps) {
  const { token } = await params

  if (!token) {
    redirect('/login?error=invalid_token')
  }

  return (
    <main className="min-h-screen bg-[#111210] text-[#f4efe5] flex items-center justify-center">
      <div className="border border-[#f4efe5]/10 bg-[#1b1c19] p-8 text-center max-w-md">
        <h1 className="text-2xl font-black uppercase tracking-[0.06em]">Вход в canfly</h1>
        <p className="mt-4 text-sm text-[#ded7cc]">
          Подтверждаем ссылку и открываем профиль.
        </p>
        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-[#ded7cc]/60">
          Секунду...
        </p>
      </div>
      <ClientMagicLinkSection token={token} />
    </main>
  )
}
