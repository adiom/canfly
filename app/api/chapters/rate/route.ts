import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'retired',
    message: 'Рейтинги глав — артефакт прошлого. Теперь всё живет в Release с новой системой оценок.',
    suggestion: '/api/releases',
  }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({
    status: 'retired',
    message: 'Этот endpoint больше не принимает голоса. Старые книги отошли в историю.',
  }, { status: 410 })
}