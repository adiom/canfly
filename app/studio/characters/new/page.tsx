import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CharacterForm } from '@/components/studio/character-form'

export default async function NewCharacterPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4 -ml-3 rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50/50">
          <Link href="/studio/characters">
            <ArrowLeft className="mr-2 h-4 w-4" />
            К списку
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Новый персонаж
        </h1>
      </div>
      <CharacterForm />
    </div>
  )
}
