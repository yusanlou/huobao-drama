import { randomUUID } from 'node:crypto'
import { Fault, failure, hash, Huobao, Ledger, now, requireValue, type Row } from './core.js'

export const capabilities = { atomic_batch: false, server_cas: false, provider_cancel: false, automatic_artifact_writeback: true }
export class Production {
  private queue: Promise<unknown> = Promise.resolve()
  private ticking = false
  constructor(readonly ledger: Ledger, readonly api: Huobao) {}
  serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn)
    this.queue = result.catch(() => {})
    return result
  }
  async write(key: string, path: string, method: string, body: Row) {
    const digest = hash({ path, method, body })
    const old = this.ledger.state.requests[key]
    if (old) {
      requireValue(old.digest === digest, 'IDEMPOTENCY_CONFLICT', 'Request key already has different input.')
      if (old.status === 'succeeded') return old.result
      throw new Fault(old.status === 'submission_unknown' || old.status === 'dispatching' ? 'SUBMISSION_UNKNOWN' : 'PREVIOUS_REQUEST_FAILED', 'This request was already attempted. Read context or run receipts before deciding whether to retry.')
    }
    this.ledger.gate()
    const entry = { digest, status: 'dispatching', created_at: now() } as Row
    this.ledger.state.requests[key] = entry
    this.ledger.save()
    try {
      const result = await this.api.call(path, method, body)
      entry.status = 'succeeded'; entry.result = result; this.ledger.save()
      return result
    } catch (e) {
      entry.status = e instanceof Fault && e.code === 'SUBMISSION_UNKNOWN' ? 'submission_unknown' : 'failed'
      entry.error = failure(e); this.ledger.save(); throw e
    }
  }
  async prepare(projectId: number, episodeId: number, action: Row) {
    const c = await this.api.context(projectId, episodeId)
    if (action.kind === 'merge') {
      const ids: number[] = action.storyboard_ids || c.storyboards.map((s: Row) => s.id)
      requireValue(ids.length > 0 && new Set(ids).size === ids.length, 'PRECONDITION', 'Choose at least one unique storyboard.')
      const shots = ids.map(id => c.storyboards.find((s: Row) => s.id === id))
      requireValue(shots.every((s: Row) => s?.video_url), 'PRECONDITION', 'All selected storyboards must have video; incomplete clips will not be silently skipped.')
      return { path: `/merge/episodes/${episodeId}/merge`, body: { storyboard_ids: ids }, fingerprint: hash(shots.map((s: Row) => [s.id, s.video_url, s.storyboard_number])), overwrites_current: false }
    }
    if (['character_image', 'scene_image', 'prop_image'].includes(action.kind)) {
      const route = { character_image: 'characters', scene_image: 'scenes', prop_image: 'props' }[action.kind as string]!
      const asset = (c as Row)[route].find((a: Row) => a.id === action.target_id)
      requireValue(asset, 'PRECONDITION', 'Asset must be linked to the selected episode.')
      return { path: `/${route}/${action.target_id}/generate-image`, body: { episode_id: episodeId, config_id: action.config_id ?? c.episode.image_config_id, model: action.model }, fingerprint: hash([asset, c.project.style, c.episode.image_config_id]), overwrites_current: true }
    }
    const shot = c.storyboards.find((s: Row) => s.id === action.target_id)
    requireValue(shot, 'PRECONDITION', 'Storyboard does not belong to this episode.')
    const video = action.kind === 'storyboard_video'
    const bound: Row[] = [
      ...c.scenes.filter((s: Row) => s.id === shot.scene_id),
      ...c.characters.filter((s: Row) => (shot.character_ids || []).includes(s.id)),
      ...c.props.filter((s: Row) => (shot.prop_ids || []).includes(s.id)),
    ]
    const references: string[] = [], names = new Map<string, number>()
    for (const asset of bound) {
      requireValue(asset.image_url, 'MISSING_REFERENCE', 'Generate images for all bound assets before producing this storyboard.')
      const name = asset.name || asset.location
      let index = references.indexOf(asset.image_url)
      if (index < 0) { references.push(asset.image_url); index = references.length - 1 }
      requireValue(!names.has(name) || names.get(name) === index + 1, 'AMBIGUOUS_REFERENCE', 'Bound assets have the same name but different images.')
      names.set(name, index + 1)
    }
    requireValue(references.length <= 9, 'REFERENCE_LIMIT', 'This initial adapter supports at most nine references; split or simplify the storyboard.')
    let prompt = String(video ? shot.video_prompt || '' : shot.image_prompt || shot.description || '')
    if (video) prompt = prompt.replace(/@([^\s@]+)/g, (match, raw: string) => {
      const name = [...names.keys()].sort((a, b) => b.length - a.length).find(n => raw.startsWith(n))
      requireValue(name, 'UNKNOWN_REFERENCE', `Unresolved mention: ${match}. Use a bound asset name.`)
      return `@图片${names.get(name)}${name}${raw.slice(name.length)}`
    })
    requireValue(prompt.trim() || (video && references.length), 'PRECONDITION', 'Add a generation prompt or video references first.')
    const body: Row = { type: video ? 'video' : 'image', storyboard_id: shot.id, drama_id: projectId, prompt, model: action.model, config_id: action.config_id ?? (video ? c.episode.video_config_id : c.episode.image_config_id) }
    if (video) Object.assign(body, { reference_image_urls: references, aspect_ratio: c.project.aspect_ratio || '16:9', duration: Number(shot.duration || 10), resolution: c.episode.resolution, generate_audio: true })
    else Object.assign(body, { reference_images: references, size: c.project.aspect_ratio === '9:16' ? '1080x1920' : '1920x1080' })
    return { path: '/tasks', body, fingerprint: hash([shot, bound, c.project.style, c.project.aspect_ratio, c.episode.image_config_id, c.episode.video_config_id, c.episode.resolution]), overwrites_current: true }
  }
  async plan(projectId: number, episodeId: number, actions: Row[]) {
    const steps = []
    for (const action of actions) steps.push({ action, ...await this.prepare(projectId, episodeId, action) })
    this.ledger.gate()
    const plan = { id: randomUUID(), project_id: projectId, episode_id: episodeId, created_at: now(), steps, cost: 'unknown', capabilities }
    this.ledger.state.plans[plan.id] = plan; this.ledger.save()
    return plan
  }
  start(planId: string, requestKey: string) {
    this.ledger.gate()
    const old = Object.values(this.ledger.state.runs).find(r => r.request_key === requestKey)
    if (old) { requireValue(old.plan_id === planId, 'IDEMPOTENCY_CONFLICT', 'Run key already belongs to another plan.'); return old }
    const plan = this.ledger.state.plans[planId]
    requireValue(plan, 'NOT_FOUND', 'Plan not found.')
    requireValue(!Object.values(this.ledger.state.runs).some(r => r.plan_id === planId), 'PLAN_ALREADY_STARTED', 'A plan can be executed once; query its existing run or prepare a new plan.')
    const run: Row = { id: randomUUID(), plan_id: planId, request_key: requestKey, project_id: plan.project_id, episode_id: plan.episode_id, created_at: now(), status: 'running', steps: plan.steps.map((s: Row, i: number) => ({ ...s, index: i, status: 'pending' })) }
    this.ledger.state.runs[run.id] = run; this.ledger.save(); return run
  }
  control(id: string, action: string) {
    const run = this.get(id)
    if (action === 'resume') {
      this.ledger.gate()
      requireValue(!run.steps.some((s: Row) => ['failed', 'submission_unknown', 'dispatching'].includes(s.status)), 'NEEDS_RECONCILIATION', 'Failed or uncertain steps cannot be retried automatically. Inspect receipts and create a new targeted plan.')
      requireValue(run.status !== 'completed', 'ALREADY_COMPLETED', 'Run already completed.')
    }
    run.status = action === 'resume' ? 'running' : 'paused'; this.ledger.save(); return run
  }
  async reconcile(id: string, index: number, upstreamId: number) {
    const run = this.get(id), step = run.steps[index]
    requireValue(step?.status === 'submission_unknown', 'PRECONDITION', 'Only uncertain submissions can be reconciled.')
    const result = step.action.kind === 'merge'
      ? (await this.api.call(`/merge/episodes/${run.episode_id}/merges`)).find((r: Row) => r.id === upstreamId)
      : await this.api.call(`/tasks/${upstreamId}`)
    const link = { character_image: 'character_id', scene_image: 'scene_id', prop_image: 'prop_id', storyboard_image: 'storyboard_id', storyboard_video: 'storyboard_id' }[step.action.kind as string]
    requireValue(result && result.drama_id === run.project_id, 'PRECONDITION', 'Existing task does not belong to this project.')
    if (link) requireValue(result[link] === step.action.target_id && result.type === (step.action.kind === 'storyboard_video' ? 'video' : 'image'), 'PRECONDITION', 'Existing task does not match this step target and media type.')
    else requireValue(result.episode_id === run.episode_id, 'PRECONDITION', 'Merge does not belong to this episode.')
    this.ledger.gate()
    step.upstream_id = upstreamId; step.result = result; step.error = undefined
    step.status = result.status === 'completed' ? 'succeeded' : result.status === 'failed' ? 'failed' : 'submitted'
    step.reconciled_at = now(); run.status = 'paused'; this.ledger.save()
    return run
  }
  get(id: string) { const run = this.ledger.state.runs[id]; requireValue(run, 'NOT_FOUND', 'Run not found.'); return run }
  async tick() {
    if (this.ticking || this.ledger.stopping) return
    if (!Object.values(this.ledger.state.runs).some(r => r.status === 'running' || r.steps.some((s: Row) => s.status === 'submitted'))) return
    this.ticking = true
    try { await this.serial(async () => {
      for (const run of Object.values(this.ledger.state.runs)) {
        for (const step of run.steps.filter((s: Row) => s.status === 'submitted')) {
          try {
            const result = step.action.kind === 'merge'
              ? (await this.api.call(`/merge/episodes/${run.episode_id}/merges`)).find((m: Row) => m.id === step.upstream_id)
              : await this.api.call(`/tasks/${step.upstream_id}`)
            if (!result) { step.observation = 'upstream_record_missing'; continue }
            step.observation = undefined; step.result = result
            if (result.status === 'completed') step.status = 'succeeded'
            else if (result.status === 'failed') { step.status = 'failed'; run.status = 'needs_attention' }
          } catch { step.observation = 'upstream_unavailable' }
        }
        if (run.steps.every((s: Row) => s.status === 'succeeded')) run.status = 'completed'
      }
      this.ledger.save()
      if (!this.ledger.state.enabled) return
      // One upstream production task at a time across this extension, not globally across Huobao.
      if (Object.values(this.ledger.state.runs).some(r => r.steps.some((s: Row) => ['submitted', 'dispatching'].includes(s.status)))) return
      const run = Object.values(this.ledger.state.runs).find(r => r.status === 'running')
      if (!run) return
      const step = run.steps.find((s: Row) => s.status === 'pending')
      if (!step) { run.status = 'needs_attention'; this.ledger.save(); return }
      try {
        const current = await this.prepare(run.project_id, run.episode_id, step.action)
        requireValue(current.fingerprint === step.fingerprint && hash(current.body) === hash(step.body), 'STALE_PLAN', 'Source changed after planning. Create a new plan for remaining targets.')
        this.ledger.gate()
        if (run.status !== 'running') return
        step.status = 'dispatching'; this.ledger.save()
        const result = await this.write(`run:${run.id}:${step.index}`, step.path, 'POST', step.body)
        const upstreamId = result?.id ?? result?.image_generation_id ?? result?.merge_id
        requireValue(upstreamId, 'SUBMISSION_UNKNOWN', 'Upstream accepted request without a trackable ID; reconcile before retrying.')
        step.upstream_id = upstreamId; step.status = 'submitted'
      } catch (e) {
        if (e instanceof Fault && e.code === 'MCP_DISABLED') { run.status = 'paused'; if (step.status === 'pending') return }
        else { step.status = e instanceof Fault && e.code === 'SUBMISSION_UNKNOWN' ? 'submission_unknown' : 'failed'; step.error = failure(e); run.status = 'needs_attention' }
      }
      this.ledger.save()
    }) } finally { this.ticking = false }
  }
}
