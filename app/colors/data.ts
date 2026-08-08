// Коллекция переехала в lib/canfly-colors.ts: её читает не только /colors,
// но и панель неба на /login. Здесь остался реэкспорт, чтобы не править импорты.
export { CANFLY_COLORS, type CanflyColor } from '@/lib/canfly-colors'
