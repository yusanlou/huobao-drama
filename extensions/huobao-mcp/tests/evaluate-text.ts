// Explicit, opt-in real TEXT-model evaluation. Uses disposable native backend data.
// npm run evaluate:text -- --run [--baseline snapshot] [--workspace-dir candidate] [--samples 2] [--output report.json]
// Never runs from npm test; no image/video generation is invoked.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createExtension } from '../src/server.js'
import { hash } from '../src/core.js'
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
if (!process.argv.includes('--run')) throw Error('Use --run to explicitly invoke the configured text model.')
const cases = JSON.parse(await readFile(join(repo, 'docs/fixtures/production-cases.json'), 'utf8'))
const arg = (name: string, fallback: string) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback
const samples = Number(arg('--samples', '1'))
if (!Number.isInteger(samples) || samples < 1 || samples > 3) throw Error('--samples must be 1–3')
const output = resolve(arg('--output', join(repo, 'docs/fixtures/production-text-evaluation.json')))
const workspace = resolve(arg('--workspace-dir', join(repo, 'backend/workspace')))
const active = (await (await fetch('http://localhost:5679/api/v1/ai-configs')).json()).data.filter((r: any) => r.service_type === 'text' && r.is_active).sort((a: any, b: any) => b.priority - a.priority)[0]
if (!active) throw Error('No active text configuration.')
const baselineFile = process.argv.includes('--baseline') ? process.argv[process.argv.indexOf('--baseline') + 1] : undefined
const baseline = baselineFile ? JSON.parse(await readFile(baselineFile, 'utf8')).entries : null
const dir = await mkdtemp(join(tmpdir(), 'huobao-text-eval-'))
await cp(workspace, join(dir, 'workspace'), { recursive: true })
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = (probe.address() as any).port; await new Promise<void>(r => probe.close(() => r()))
const child = spawn(process.execPath, [join(repo, 'backend/node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], { cwd: join(repo, 'backend'), env: { ...process.env, PORT: String(port), SQLITE_PATH: join(dir, 'test.sqlite3'), HUOBAO_DATA_DIR: dir, STORAGE_PATH: join(dir, 'static'), WORKSPACE_PATH: join(dir, 'workspace'), MYSQL_AUTO_IMPORT: 'false' }, stdio: 'ignore' })
const base = `http://127.0.0.1:${port}/api/v1`
async function api(path: string, body?: any, method = body ? 'POST' : 'GET') {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) throw Error(`Native ${path}: HTTP ${r.status}`)
  return (await r.json()).data
}
let app: ReturnType<typeof createExtension> | undefined
const results: any[] = []
try {
  for (let i = 0; i < 150; i++) { try { await api('/health'); break } catch { if (child.exitCode !== null) throw Error('Native test backend exited.'); await new Promise(r => setTimeout(r, 200)) } }
  const text = await api('/ai-configs', { ...active, name: 'Isolated text evaluation' })
  for (const [service_type, provider, model] of [['image', 'openai', ['unused']], ['video', 'aliyun', ['wan3.0-video']]]) await api('/ai-configs', { service_type, provider, model, name: 'No media calls', base_url: 'http://127.0.0.1:1', api_key: 'unused' })
  app = createExtension({ dataDir: join(dir, 'mcp'), apiBase: base, origins: [], publicUrl: 'http://localhost:5680/mcp', agentTimeout: 300000 })
  app.ledger.state.enabled = true; app.ledger.save()
  for (const variant of baseline ? ['enhanced', 'baseline'] : ['enhanced']) {
    if (variant === 'baseline') for (const entry of baseline.filter((e: any) => e.language === 'zh')) await api(entry.path, entry.kind === 'prompts' ? { system_prompt: entry.data.system_prompt, name: entry.data.name, model: entry.data.model } : { content: entry.data.content }, 'PUT')
    for (let sample = 1; sample <= samples; sample++) for (const [index, item] of cases.entries()) {
      const project = await api('/dramas', { title: `${variant}-${sample}-${item.name}`, aspect_ratio: '16:9' })
      const episode = await api('/episodes', { drama_id: project.id, title: item.name })
      const scope = { project_id: project.id, episode_id: episode.id }
      await api(`/episodes/${episode.id}`, { content: item.source }, 'PUT')
      // A/B isolates configuration changes: identical inputs and requirements on both sides.
      await app.workbench.invoke('hb_update_production_requirements', { ...scope, request_key: `${variant}-${sample}-${index}-requirements`, expected_hash: hash(''), requirements: item.requirements })
      for (const kind of ['characters', 'scenes', 'props']) for (const fields of item[kind]) await api(`/${kind}`, { ...fields, drama_id: project.id, episode_id: episode.id })
      const result: any = { variant, sample, name: item.name, coverage: item.coverage, calls: [] }
      for (const stage of ['rewrite', 'breakdown']) {
        const current = (await api(`/dramas/${project.id}`)).episodes[0]
        const receipt = await app.workbench.invoke(stage === 'rewrite' ? 'hb_rewrite_script' : 'hb_breakdown_storyboards', { ...scope, request_key: `${variant}-${sample}-${index}-${stage}`, config_id: text.id, expected_hash: hash(stage === 'rewrite' ? current.content : current.script_content || current.content), ...(stage === 'breakdown' ? { scope: 'replace_episode', video_model: 'wan3.0-video (2–30 seconds)' } : {}) })
        let observed: any
        while (true) { observed = await app.workbench.invoke('hb_get_call', { call_id: receipt.call_id }); if (!['queued', 'dispatching'].includes(observed.status)) break; await new Promise(r => setTimeout(r, 1000)) }
        result.calls.push({ stage, status: observed.status, error: observed.error, prompt_completion: observed.prompt_completion, started_at: observed.created_at, finished_at: observed.finished_at })
        console.log(`${variant} / sample ${sample} / ${index + 1} / ${stage}: ${observed.status}`)
        if (observed.status !== 'response_received') break
      }
      const current = (await api(`/dramas/${project.id}`)).episodes[0]
      result.script = current.script_content || ''
      result.storyboards = await api(`/episodes/${episode.id}/storyboards`)
      result.total_seconds = result.storyboards.reduce((s: number, r: any) => s + Number(r.duration || 0), 0)
      result.target_seconds = item.requirements.target_duration_seconds
      results.push(result)
      await writeFile(output, JSON.stringify({ evaluated_at: new Date().toISOString(), model: active.model?.[0], configuration_baseline: baselineFile ? 'provided snapshot' : null, samples_per_case: samples, identical_requirements: true, media_generated: false, semantic_approval: false, results }, null, 2))
    }
  }
} finally {
  await app?.close()
  if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit') }
  await rm(dir, { recursive: true, force: true })
}
