#!/usr/bin/env node
/**
 * Проверка инструментов Next.js для агента: версии, конфигурация
 * next-devtools-mcp и доступность /_next/mcp у запущенного `next dev`.
 * Базу данных не читает и не меняет.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const failures = []
const warnings = []

function execVersion(command, args = ['--version']) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0]
  } catch {
    return null
  }
}

function configuredDevtoolsVersion() {
  for (const file of ['opencode.json', '.mcp.json']) {
    const path = resolve(root, file)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    const match = /next-devtools-mcp@([0-9][^"'\s]*)/.exec(text)
    if (match) return `${match[1]} (${file})`
  }
  return null
}

function devPort() {
  const lock = resolve(root, '.next/dev/lock')
  if (existsSync(lock)) {
    try {
      const parsed = JSON.parse(readFileSync(lock, 'utf8'))
      if (parsed.port) return Number(parsed.port)
    } catch {
      // Ниже используется значение по умолчанию.
    }
  }
  return 3000
}

function decodeSse(text) {
  const line = text.split('\n').find(item => item.startsWith('data: '))
  if (!line) throw new Error('MCP вернул ответ без data: строки')
  return JSON.parse(line.slice(6))
}

async function rpc(url, body, sessionId) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return { message: decodeSse(await response.text()), sessionId: response.headers.get('mcp-session-id') }
}

const nextVersion = pkg.dependencies?.next ?? pkg.devDependencies?.next ?? 'не найден'
const opencodeVersion = execVersion('opencode') ?? 'не найден'
const agentBrowserVersion = execVersion('agent-browser') ?? 'не найден'
const devtoolsVersion = configuredDevtoolsVersion() ?? 'не настроен'

console.log(`Next.js:            ${nextVersion}`)
console.log(`OpenCode:           ${opencodeVersion}`)
console.log(`Turbopack:          встроен в Next.js 16 (проверяется через /_next/mcp)`)
console.log(`agent-browser:      ${agentBrowserVersion}`)
console.log(`next-devtools-mcp:  ${devtoolsVersion}`)

if (!String(nextVersion).match(/^(\^|~)?16\.(3|[4-9]|\d{2,})/)) failures.push('Нужен Next.js 16.3+ для /_next/mcp и get_compilation_issues')
if (agentBrowserVersion === 'не найден') {
  failures.push('agent-browser не установлен (npm i -g agent-browser@latest)')
} else {
  const [, major = '0', minor = '0', patch = '0'] = agentBrowserVersion.match(/(\d+)\.(\d+)\.(\d+)/) ?? []
  const version = [Number(major), Number(minor), Number(patch)]
  if (version[0] === 0 && (version[1] < 31 || (version[1] === 31 && version[2] < 1))) {
    failures.push('Нужен agent-browser >= 0.31.1')
  }
}
if (devtoolsVersion === 'не настроен') failures.push('next-devtools-mcp не указан в opencode.json или .mcp.json')

const port = devPort()
const url = process.env.NEXT_MCP_URL ?? `http://127.0.0.1:${port}/_next/mcp`
try {
  const init = await rpc(url, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'canfly-next-tools-check', version: '1.0.0' },
    },
  })
  const sessionId = init.sessionId
  const list = await rpc(url, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sessionId)
  const names = (list.message.result?.tools ?? []).map(tool => tool.name)
  console.log(`Next.js MCP:        ${url}`)
  console.log(`Доступные тулы:     ${names.join(', ') || 'нет'}`)

  if (!names.includes('get_compilation_issues')) {
    failures.push('В tools/list нет get_compilation_issues: Next.js ниже 16.3 или MCP не Turbopack')
  } else {
    const call = await rpc(url, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_compilation_issues', arguments: {} },
    }, sessionId)
    const text = call.message.result?.content?.[0]?.text ?? ''
    if (/Turbopack project is not available/i.test(text)) failures.push('Dev-сервер работает без Turbopack')
    else console.log(`Компиляция:         ${text.slice(0, 200)}`)
  }

  const routes = await rpc(url, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'get_routes', arguments: {} },
  }, sessionId)
  if (routes.message.error) warnings.push(`get_routes: ${routes.message.error.message}`)
} catch (error) {
  failures.push(`/_next/mcp недоступен по ${url}: ${error instanceof Error ? error.message : String(error)}`)
  warnings.push('Запустите `pnpm dev` и при необходимости задайте NEXT_MCP_URL')
}

if (warnings.length) {
  console.log('\nПредупреждения:')
  for (const warning of warnings) console.log(`- ${warning}`)
}
if (failures.length) {
  console.error('\nОшибки:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('\nИнструменты Next.js настроены.')
