import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../../scripts/deploy-production-config.mjs', import.meta.url))
const targets = [['prompts', 'script_rewriter'], ['prompts', 'storyboard_breaker'], ['prompts', 'prompt_generator'], ['skills', 'script-rewriter'], ['skills', 'storyboard-breaker'], ['skills', 'prompt-generator/video-prompt']]
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'huobao-config-deploy-'))
  const workspace = join(dir, 'candidate'), rows = new Map<string, Record<string, unknown>>(), writes: string[] = []
  for (const language of ['zh', 'en', 'ja', 'ko']) for (const [kind, id] of targets) {
    const key = `/${kind}/${id}?lang=${language}`
    rows.set(key, kind === 'prompts' ? { system_prompt: 'old', name: 'User name', model: 'user-model', is_default: false } : { content: 'old', is_default: false })
    const stem = kind === 'prompts' ? `prompts/${id}` : `skills/${id}/SKILL`
    const path = join(workspace, stem + (language === 'zh' ? '' : `.${language}`) + '.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, kind === 'prompts' ? '---\nname: Candidate name\nmodel: "candidate-model"\n---\n\nNew prompt\n' : 'New skill\n')
  }
  const server = createServer(async (req, res) => {
    const key = req.url!.replace('/api/v1', '')
    if (req.method === 'PUT') {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk)
      Object.assign(rows.get(key)!, JSON.parse(Buffer.concat(chunks).toString())); writes.push(key)
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ code: 200, data: key === '/settings/content-language' ? 'zh' : rows.get(key) }))
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  return { workspace, rows, writes,
    async run(extra: string[] = []) {
      const child = spawn(process.execPath, [script, '--base', `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`, '--workspace-dir', workspace, '--backup-dir', join(dir, 'backups'), '--apply', ...extra], { stdio: ['ignore', 'pipe', 'pipe'] })
      let output = ''; child.stdout.on('data', b => { output += b }); child.stderr.on('data', b => { output += b })
      const [code] = await once(child, 'exit'); return { code, output }
    },
    async close() { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(dir, { recursive: true, force: true }) },
  }
}

test('candidate deployment reads all languages before the first mutation', async () => {
  const f = await fixture()
  try {
    await rm(join(f.workspace, 'skills/prompt-generator/video-prompt/SKILL.ko.md'))
    const result = await f.run()
    assert.equal(result.code, 1); assert.match(result.output, /ENOENT/)
    assert.deepEqual(f.writes, [])
  } finally { await f.close() }
})

test('candidate configuration uses original APIs and preserves user model/name metadata', async () => {
  const f = await fixture()
  try {
    const result = await f.run()
    assert.equal(result.code, 0, result.output); assert.equal(f.writes.length, 24)
    const prompt = f.rows.get('/prompts/script_rewriter?lang=zh')!
    assert.equal(prompt.system_prompt, 'New prompt')
    assert.equal(prompt.name, 'User name'); assert.equal(prompt.model, 'user-model')
    assert.equal(f.rows.get('/skills/storyboard-breaker?lang=ko')!.content, 'New skill\n')
  } finally { await f.close() }
})

test('candidate deployment refuses edits made since the original snapshot', async () => {
  const f = await fixture()
  try {
    const snapshot = join(f.workspace, 'expected.json')
    await writeFile(snapshot, JSON.stringify({ entries: [...f.rows].map(([path, data]) => ({ path, data })) }))
    f.rows.get('/prompts/script_rewriter?lang=zh')!.system_prompt = 'User edit during development'
    const result = await f.run(['--expected-snapshot', snapshot])
    assert.equal(result.code, 1); assert.match(result.output, /changed since candidate preparation/)
    assert.deepEqual(f.writes, [])
  } finally { await f.close() }
})
