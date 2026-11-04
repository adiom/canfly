export async function workshopRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'Не удалось выполнить действие'), { status: response.status, unsavedText: body.unsavedText })
  return body.data as T
}
export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
