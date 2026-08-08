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
  return body
    .replace(/<!--.*?-->/gs, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}/g, '')
    .replace(/`{1,3}/g, '')
    .trim()
    .slice(0, 300)
}

async function main() {
  const now = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const bugIssues = JSON.parse(run('gh issue list --label bug --json number,title,labels,state,body,updatedAt --limit 100 --state open'))
  const featureIssues = JSON.parse(run('gh issue list --label enhancement --json number,title,labels,state,body,updatedAt --limit 100 --state open'))

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
