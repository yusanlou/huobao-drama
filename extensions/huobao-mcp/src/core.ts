import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, fsyncSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ContractError, videoParameterKeys } from '../../../shared/production.mjs'

export type Row = Record<string, any>
export const now = () => new Date().toISOString()
export const token = () => randomBytes(32).toString('base64url')
export const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export class Fault extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message) }
}
export const failure = (e: unknown) => e instanceof Fault || e instanceof ContractError
  ? { code: e.code, message: e.message }
  : { code: 'INTERNAL_ERROR', message: 'Extension operation failed; inspect local service health.' }
export function requireValue(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new Fault(code, message)
}
export function sanitize(value: any): any {
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/api.?key|authorization|secret|token|password|base.?url|settings|headers|error.?msg|params/i.test(key))
    .map(([key, v]) => [key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`), sanitize(v)]))
  return value
}

export interface State {
  version: 1; binding: string; enabled: boolean; revision: number; clientToken: string
  plans: Record<string, Row>; runs: Record<string, Row>; requests: Record<string, Row>
  briefs: Record<string, Row>; reviews: Record<string, Row>
}
// Synchronous atomic checkpoints serialize dispatch permits with the control switch.
// The directory belongs only to this extension; no original database is accessed.
export class Ledger {
  state: State
  private file: string
  private lock: string
  closed = false
  stopping = false
  constructor(readonly dir: string, binding: string) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    this.file = join(dir, 'state.json'); this.lock = join(dir, 'service.lock')
    try { mkdirSync(this.lock) } catch {
      let pid: number
      try { pid = Number(readFileSync(join(this.lock, 'pid'), 'utf8')) } catch {
        throw new Fault('LOCKED', 'Data directory is locked; verify no other instance before removing service.lock.')
      }
      try { process.kill(pid, 0); throw new Fault('LOCKED', 'Another extension owns this data directory.') }
      catch (e: any) { if (e.code !== 'ESRCH') throw e }
      rmSync(this.lock, { recursive: true }); mkdirSync(this.lock)
    }
    writeFileSync(join(this.lock, 'pid'), String(process.pid), { mode: 0o600 })
    try {
      try { this.state = JSON.parse(readFileSync(this.file, 'utf8')) }
      catch (e: any) {
        if (e.code !== 'ENOENT') throw e
        this.state = { version: 1, binding, enabled: false, revision: 0, clientToken: token(), plans: {}, runs: {}, requests: {}, briefs: {}, reviews: {} }
      }
      requireValue(this.state.version === 1 && this.state.binding === binding, 'BINDING_MISMATCH', 'Use a separate data directory for a different Huobao backend.')
      for (const request of Object.values(this.state.requests)) if (['queued', 'dispatching'].includes(request.status)) request.status = 'submission_unknown'
      for (const run of Object.values(this.state.runs)) {
        if (run.status === 'running') run.status = 'paused'
        for (const step of run.steps) if (step.status === 'dispatching') step.status = 'submission_unknown'
      }
      this.save()
    } catch (e) { this.close(); throw e }
  }
  save() {
    requireValue(!this.closed, 'STOPPING', 'Storage is closed.')
    const tmp = `${this.file}.tmp`
    const fd = openSync(tmp, 'w', 0o600)
    try { writeFileSync(fd, JSON.stringify(this.state)); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(tmp, this.file)
    const dirFd = openSync(join(this.file, '..'), 'r')
    try { fsyncSync(dirFd) } finally { closeSync(dirFd) }
  }
  gate() { if (this.stopping) throw new Fault('STOPPING', 'Extension is shutting down.', 503); if (!this.state.enabled) throw new Fault('MCP_DISABLED', 'Enable MCP in Huobao settings before calling tools.', 403) }
  close() { this.closed = true; try { unlinkSync(join(this.lock, 'pid')); rmSync(this.lock, { recursive: true }) } catch {} }
}

export function taskRecord(value: any): any {
  if (Array.isArray(value)) return value.map(taskRecord)
  const row = sanitize(value)
  let params = value?.params
  try { if (typeof params === 'string') params = JSON.parse(params) } catch { params = {} }
  const safe: Row = {}
  for (const key of [...videoParameterKeys, 'model', 'config_id', 'size', 'reference_images']) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    const v = params?.[key] ?? params?.[camel]
    if (['string', 'number', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every(x => typeof x === 'string'))) safe[key] = v
  }
  return { ...row, submission: safe, provider_internal_prompt: 'unknown' }
}
export interface CallOptions { timeout?: number; signal?: AbortSignal; agent?: boolean; project?: (value: any) => any }
export class Huobao {
  constructor(readonly base: string, readonly timeout = 30_000, readonly agentTimeout = 300_000) {}
  async call(path: string, method = 'GET', body?: unknown, options: CallOptions = {}): Promise<any> {
    const write = method !== 'GET'
    let response: Response
    try {
      response = await fetch(`${this.base}${path}`, {
        method, headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
        signal: AbortSignal.any([AbortSignal.timeout(options.timeout ?? (path === '/health' ? Math.min(this.timeout, 3000) : options.agent ? this.agentTimeout : this.timeout)), ...(options.signal ? [options.signal] : [])]), redirect: 'error',
      })
    } catch { throw new Fault(write ? 'SUBMISSION_UNKNOWN' : 'UPSTREAM_UNAVAILABLE', write ? 'Upstream may have accepted the request. Do not retry with a new request key; reconcile first.' : 'Huobao is unreachable.', 502) }
    let envelope: Row
    try { envelope = await response.json() as Row } catch { throw new Fault(write ? 'SUBMISSION_UNKNOWN' : 'UPSTREAM_INVALID', 'Unexpected Huobao response.', 502) }
    if (!response.ok || (envelope.code && ![200, 201].includes(envelope.code))) {
      // Error bodies may contain provider credentials. Never relay them to clients or the ledger.
      throw new Fault(write && (response.status >= 500 || options.agent) ? 'SUBMISSION_UNKNOWN' : 'UPSTREAM_REJECTED', `Huobao rejected ${method} ${path.split('?')[0]} (HTTP ${response.status}). Check prerequisites in the webpage.`, 502)
    }
    const data = envelope.data === undefined ? envelope : envelope.data
    return options.project ? options.project(data) : sanitize(data)
  }
  async project(id: number) {
    const project = await this.call(`/dramas/${id}`)
    requireValue(project && !project.deleted_at, 'NOT_FOUND', 'Project is missing or deleted.')
    for (const key of ['characters', 'scenes', 'props', 'episodes']) project[key] = (project[key] || []).filter((r: Row) => !r.deleted_at)
    return project
  }
  async context(projectId: number, episodeId?: number) {
    const project = await this.project(projectId)
    if (!episodeId) return { project }
    const episode = project.episodes.find((ep: Row) => ep.id === episodeId)
    requireValue(episode, 'NOT_FOUND', 'Episode does not belong to this project.')
    const [characters, scenes, props, storyboards] = await Promise.all(['characters', 'scenes', 'props', 'storyboards'].map(k => this.call(`/episodes/${episodeId}/${k}`)))
    return { project, episode, characters, scenes, props, storyboards }
  }
}
