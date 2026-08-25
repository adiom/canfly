'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui/button'

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6">
        <Link
          href="/admin"
          className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl font-bold text-transparent"
        >
          Canfly Admin
        </Link>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
          Выход
        </Button>
      </div>
    </header>
  )
}
