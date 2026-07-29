import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Магазин выведен из эксплуатации: /shop и /cart редиректятся на /releases
// (proxy.ts), оформить заказ физически неоткуда. Ручка при этом принимала
// анонимный POST и считала сумму по цене из тела запроса — то есть заказ на
// любую сумму. Отключена по образцу /api/books.
//
// Если магазин вернётся, здесь нужны: авторизация, zod-схема и цены,
// поднятые с сервера по id товара, а не принятые от клиента.
export async function POST() {
  return NextResponse.json(
    {
      status: 'retired',
      message: 'Оформление заказов отключено: витрина переехала в /releases.',
      suggestion: '/releases',
    },
    { status: 410 },
  )
}
