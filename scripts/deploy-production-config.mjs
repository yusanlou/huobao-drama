// Deploy through the ORIGINAL prompt/Skill APIs. Never reset to old hardcoded defaults.
// node scripts/deploy-production-config.mjs --base http://localhost:5679/api/v1 --apply
// Add --workspace-dir <candidate-workspace> to test drafts before changing live files.
// --expected-snapshot <backup> refuses to overwrite edits made since drafting began.
// node scripts/deploy-production-config.mjs --base ... --restore .local-backups/<snapshot>.json
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
const repo = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const value = flag => args[args.indexOf(flag) + 1]
const base = args.includes('--base') ? value('--base').replace(/\/$/, '') : 'http://localhost:5679/api/v1'
const workspace = args.includes('--workspace-dir') ? resolve(value('--workspace-dir')) : join(repo, 'backend/workspace')
const sha = v => createHash('sha256').update(v).digest('hex')
async function api(path, method = 'GET', body) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw Error(`${method} ${path} failed (${r.status})`)
  const result = await r.json()
  if (result.code && ![200, 201].includes(result.code)) throw Error(`Native API rejected ${path}`)
  return result.data
}
const targets = [['prompts', 'script_rewriter'], ['prompts', 'storyboard_breaker'], ['prompts', 'prompt_generator'], ['skills', 'script-rewriter'], ['skills', 'storyboard-breaker'], ['skills', 'prompt-generator/video-prompt']]
const entries = []
for (const language of ['zh', 'en', 'ja', 'ko']) for (const [kind, id] of targets) {
  const path = `/${kind}/${id}?lang=${language}`, data = await api(path)
  entries.push({ path, kind, id, language, data, hash: sha(JSON.stringify(data)) })
}
if (args.includes('--expected-snapshot')) {
  const expected = JSON.parse(await readFile(resolve(value('--expected-snapshot')), 'utf8')).entries
  for (const current of entries) {
    const previous = expected?.find(e => e.path === current.path)
    const field = current.kind === 'prompts' ? 'system_prompt' : 'content'
    if (!previous || previous.data[field] !== current.data[field] || (current.kind === 'prompts' && (previous.data.name !== current.data.name || previous.data.model !== current.data.model))) throw Error(`Configuration changed since candidate preparation: ${current.path}`)
  }
}
const backupDir = args.includes('--backup-dir') ? resolve(value('--backup-dir')) : join(repo, '.local-backups')
await mkdir(backupDir, { recursive: true, mode: 0o700 })
const backup = join(backupDir, `production-config-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
await writeFile(backup, JSON.stringify({ captured_at: new Date().toISOString(), base, content_language: await api('/settings/content-language'), entries }, null, 2), { mode: 0o600 })
console.log(`Backed up ${entries.length} effective configurations: ${backup}`)
if (args.includes('--apply') || args.includes('--restore')) {
  const desired = args.includes('--restore') ? JSON.parse(await readFile(resolve(value('--restore')), 'utf8')).entries : entries
  // Validate/read the entire candidate first: a missing later language must not
  // leave a partially deployed configuration. Restore snapshots are data only.
  if (!Array.isArray(desired) || desired.length !== entries.length || new Set(desired.map(e => e.path)).size !== entries.length) throw Error('Expected a complete configuration snapshot.')
  const prepared = []
  for (const entry of desired) {
    const current = entries.find(e => e.path === entry.path)
    if (!current) throw Error('Snapshot contains an unsupported configuration path.')
    const stem = current.kind === 'prompts' ? `prompts/${current.id}` : `skills/${current.id}/SKILL`
    const file = join(workspace, stem + (current.language === 'zh' ? '' : `.${current.language}`) + '.md')
    let content = args.includes('--restore') ? (current.kind === 'prompts' ? entry.data.system_prompt : entry.data.content) : await readFile(file, 'utf8')
    if (current.kind === 'prompts' && !args.includes('--restore')) content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, '').trim()
    if (typeof content !== 'string' || !content.trim()) throw Error(`Empty configuration: ${current.path}`)
    prepared.push({ entry, current, content })
  }
  const results = []
  const writtenBase = new Map()
  for (const { entry, current, content } of prepared) {
    const fresh = await api(current.path)
    const field = current.kind === 'prompts' ? 'system_prompt' : 'content'
    const expected = current.language !== 'zh' && current.data.is_default && writtenBase.has(`${current.kind}/${current.id}`) ? writtenBase.get(`${current.kind}/${current.id}`) : current.data[field]
    if (fresh[field] !== expected || (current.kind === 'prompts' && current.language === 'zh' && (fresh.name !== current.data.name || fresh.model !== current.data.model))) throw Error(`Configuration changed concurrently: ${current.path}`)
    const metadata = args.includes('--restore') ? entry.data : fresh
    await api(current.path, 'PUT', current.kind === 'prompts' ? { system_prompt: content, name: metadata.name, model: metadata.model } : { content })
    const after = await api(current.path), saved = current.kind === 'prompts' ? after.system_prompt : after.content
    if (saved !== content) throw Error(`Readback mismatch: ${current.path}`)
    if (current.language === 'zh') writtenBase.set(`${current.kind}/${current.id}`, saved)
    results.push({ path: current.path, sha256: sha(saved), verified: true })
  }
  const report = join(backupDir, 'production-config-last-deployment.json')
  await writeFile(report, JSON.stringify({ deployed_at: new Date().toISOString(), base, backup, results }, null, 2))
  console.log(`Verified ${results.length} native API readbacks. Report: ${report}`)
} else console.log('Backup only. Use --apply or --restore <snapshot> to change configuration.')
