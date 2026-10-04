import { randomUUID } from 'node:crypto'
import { agentMessage } from '../../../shared/production.mjs'
import { failure, hash, Huobao, Ledger, now, requireValue, type Row } from './core.js'

// Receipts for existing synchronous HTTP calls, not a second production workflow.
export class AgentCalls {
  private active = new Map<string, AbortController>()
  constructor(readonly ledger: Ledger, readonly api: Huobao) {}
  snapshot(c: Row, kind: string, ids: number[] = []) {
    if (kind === 'asset_prompt') return { assets_hash: hash([c.characters, c.scenes, c.props]), prompts: [...c.characters, ...c.scenes, ...c.props].map((r: Row) => ({ id: r.id, prompt_hash: hash(r.final_prompt || '') })) }
    if (kind === 'rewrite') return { content_hash: hash(c.episode.content || ''), script_hash: hash(c.episode.script_content || '') }
    const rows = c.storyboards.filter((s: Row) => !ids.length || ids.includes(s.id))
    return { script_hash: hash(c.episode.script_content || c.episode.content || ''), storyboards_hash: hash(rows), storyboards: rows.map((s: Row) => ({ id: s.id, video_prompt_hash: hash(s.video_prompt || ''), has_video_prompt: !!s.video_prompt?.trim() })) }
  }
  async start(kind: 'rewrite' | 'breakdown' | 'video_prompt' | 'asset_prompt', args: Row) {
    const c = await this.api.context(args.project_id, args.episode_id)
    const source = kind === 'rewrite' ? c.episode.content || '' : c.episode.script_content || c.episode.content || ''
    if (kind === 'rewrite' || kind === 'breakdown') {
      requireValue(source.trim(), 'PRECONDITION', 'Source text is empty.')
      requireValue(hash(source) === args.expected_hash, 'CONFLICT', 'Source changed. Read the original content again.')
    }
    if (kind === 'video_prompt') requireValue(args.storyboard_ids.length === 1 && args.storyboard_ids.every((id: number) => c.storyboards.some((s: Row) => s.id === id)), 'PRECONDITION', 'Single mode requires exactly one storyboard in this episode.')
    requireValue(!Object.values(this.ledger.state.requests).some(r => r.kind === 'agent_call' && r.episode_id === args.episode_id && ['queued', 'dispatching'].includes(r.status)), 'CALL_IN_FLIGHT', 'An MCP Agent call is still running for this episode. This does not lock the webpage.')
    if (kind === 'asset_prompt') requireValue((c as Row)[args.kind]?.some((r: Row) => r.id === args.target_id), 'NOT_FOUND', 'Asset is not linked to the episode.')
    const message = kind === 'asset_prompt' ? '' : agentMessage(kind, { description: c.episode.description || '', storyboard_ids: args.storyboard_ids, video_model: args.video_model })
    this.ledger.gate()
    const id = randomUUID()
    const receipt: Row = { id, kind: 'agent_call', operation: kind, project_id: args.project_id, episode_id: args.episode_id, storyboard_ids: args.storyboard_ids || [], status: 'queued', created_at: now(), before: this.snapshot(c, kind, args.storyboard_ids), native_job_id: null, server_cas: false }
    this.ledger.state.requests[`call:${id}`] = receipt
    this.ledger.save()
    // Do not hold the MCP response or the short-write mutex while the native Agent runs.
    setImmediate(() => { void this.dispatch(receipt, args, message) })
    return { call_id: id, status: 'queued', query_tool: 'hb_get_call', overwrites_native_content: true }
  }
  private async dispatch(receipt: Row, args: Row, message: string) {
    if (this.ledger.stopping || this.ledger.closed) return
    if (!this.ledger.state.enabled) { receipt.status = 'not_dispatched'; this.ledger.save(); return }
    const controller = new AbortController()
    this.active.set(receipt.id, controller)
    receipt.status = 'dispatching'; receipt.dispatched_at = now(); this.ledger.save()
    try {
      const type = { rewrite: 'script_rewriter', breakdown: 'storyboard_breaker', video_prompt: 'prompt_generator' }[receipt.operation as string]
      await this.api.call(receipt.operation === 'asset_prompt' ? `/${args.kind}/${args.target_id}/generate-prompt` : `/agent/${type}/chat`, 'POST', receipt.operation === 'asset_prompt' ? { episode_id: args.episode_id, force: args.force, text_model: args.text_model, text_config_id: args.text_config_id } : { drama_id: args.project_id, episode_id: args.episode_id, message, model: args.model, config_id: args.config_id }, { agent: true, signal: controller.signal, project: () => null })
      if (this.ledger.stopping || this.ledger.closed) return
      receipt.status = 'response_received'
      // A successful response is not proof that the model saved the intended content.
      receipt.verification = 'Inspect native content; changes alone do not prove this call saved correctly.'
    } catch (e) {
      if (this.ledger.stopping || this.ledger.closed) return
      receipt.status = 'submission_unknown'; receipt.error = failure(e)
    } finally { this.active.delete(receipt.id) }
    if (this.ledger.stopping || this.ledger.closed) return
    receipt.finished_at = now(); this.ledger.save()
    try {
      const c = await this.api.context(args.project_id, args.episode_id)
      if (this.ledger.stopping || this.ledger.closed) return
      receipt.after = this.snapshot(c, receipt.operation, receipt.storyboard_ids)
      receipt.observed_at = now(); this.ledger.save()
    } catch { /* Native content remains readable independently via hb_read_content. */ }
  }
  get(id: string) {
    const receipt = this.ledger.state.requests[`call:${id}`]
    requireValue(receipt?.kind === 'agent_call', 'NOT_FOUND', 'Agent call receipt not found.')
    return receipt
  }
  stop() {
    for (const receipt of Object.values(this.ledger.state.requests)) if (receipt.kind === 'agent_call' && ['queued', 'dispatching'].includes(receipt.status)) {
      receipt.status = receipt.status === 'queued' ? 'not_dispatched' : 'submission_unknown'
      receipt.finished_at = now()
    }
    this.ledger.save()
    for (const controller of this.active.values()) controller.abort()
    this.active.clear()
  }
}
