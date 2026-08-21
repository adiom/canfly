import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).trim()
}

function prioritySort(labels) {
  const map = { 'priority-high': 0, 'priority-medium': 1, 'priority-low': 2 }
  const p = labels?.find(l => l.name?.startsWith('priority'))
  return p ? (map[p.name] ?? 99) : 99
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function priorityLabel(labels) {
  const p = labels?.find(l => l.name?.startsWith('priority'))
  return p ? p.name : '—'
}

function stripBody(body) {
  if (!body) return ''
  const text = body
    .replace(/<!--.*?-->/gs, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}/g, '')
    .replace(/`{1,3}/g, '')
    .trim()

  const LIMIT = 600
  if (text.length <= LIMIT) return text

  // Резать по границе слова, иначе описание обрывается на полуслове
  const cut = text.slice(0, LIMIT)
  const breakAt = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '))
  return `${cut.slice(0, breakAt > 0 ? breakAt : LIMIT).trimEnd()}…`
}

async function main() {
  const now = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // Один листинг вместо двух запросов с --label: серверный фильтр по лейблу идёт
  // через search API, индекс которого для этого репозитория пуст после
  // переименования (v0-canfly → canfly) — `--label bug` отдаёт [] при живых
  // issues, и docs молча перезаписывались пустыми. Делим по лейблам на клиенте.
  const allIssues = JSON.parse(run('gh issue list --json number,title,labels,state,body,updatedAt --limit 200 --state open'))
  const hasLabel = (issue, name) => issue.labels?.some(l => l.name === name)

  const bugIssues = allIssues.filter(i => hasLabel(i, 'bug'))
  const featureIssues = allIssues.filter(i => hasLabel(i, 'enhancement'))

  // Issue без bug/enhancement не попадает ни в один документ и становится
  // невидимой — так три недели пролежала #17.
  const unlabeled = allIssues.filter(i => !hasLabel(i, 'bug') && !hasLabel(i, 'enhancement'))
  if (unlabeled.length > 0) {
    console.warn(`⚠ Без лейбла bug/enhancement (не попадут в docs): ${unlabeled.map(i => `#${i.number}`).join(', ')}`)
  }

  bugIssues.sort((a, b) => prioritySort(a.labels) - prioritySort(b.labels))
  featureIssues.sort((a, b) => prioritySort(a.labels) - prioritySort(b.labels))

  const root = resolve(import.meta.dirname, '..')

  // BUGS.md
  let bugs = `# Баги

Авто-сгенерировано из GitHub Issues. Не редактировать вручную.
Синхронизировано: ${now}

---

`
  for (const issue of bugIssues) {
    bugs += `### Bug: #${issue.number} — ${issue.title}
- Приоритет: \`${priorityLabel(issue.labels)}\`
- Статус: \`${issue.state.toLowerCase()}\`
- Обновлено: ${formatDate(issue.updatedAt)}

${stripBody(issue.body)}

---

`
  }

  if (bugIssues.length === 0) {
    bugs += '_Нет открытых багов._\n'
  }

  writeFileSync(resolve(root, 'docs', 'BUGS.md'), bugs, 'utf-8')
  console.log(`✓ docs/BUGS.md — ${bugIssues.length} багов`)

  // TASKS.md
  let tasks = `# Задачи (Features)

Авто-сгенерировано из GitHub Issues. Не редактировать вручную.
Синхронизировано: ${now}

---

`
  for (const issue of featureIssues) {
    tasks += `### Feature: #${issue.number} — ${issue.title}
- Приоритет: \`${priorityLabel(issue.labels)}\`
- Статус: \`${issue.state.toLowerCase()}\`
- Обновлено: ${formatDate(issue.updatedAt)}

${stripBody(issue.body)}

---

`
  }

  if (featureIssues.length === 0) {
    tasks += '_Нет открытых задач._\n'
  }

  writeFileSync(resolve(root, 'docs', 'TASKS.md'), tasks, 'utf-8')
  console.log(`✓ docs/TASKS.md — ${featureIssues.length} задач`)
}

main().catch(err => {
  console.error('Ошибка:', err.message)
  process.exit(1)
})
