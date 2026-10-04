import { randomUUID, createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import { z } from 'zod'
import { Huobao, Ledger, requireValue, type Row } from './core.js'
const request_key = z.string().min(8).max(120)
const upload_id = z.string().uuid()
export const uploadSchemas = {
  hb_upload_begin: z.object({ request_key, kind: z.enum(['image', 'video', 'audio']), filename: z.string().min(1).max(200).regex(/^[^/\\\x00-\x1f]+$/), size_bytes: z.number().int().positive().max(50 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  hb_upload_chunk: z.object({ request_key, upload_id, offset: z.number().int().min(0), base64: z.string().min(4).max(349528) }).strict(),
  hb_upload_finish: z.object({ request_key, upload_id }).strict(),
  hb_upload_abort: z.object({ request_key, upload_id }).strict(),
}
export const uploadDescriptions = {
  hb_upload_begin: 'Begin bounded temporary file transfer for an original multipart upload. Returns upload_id and maximum chunk size. Video<=50 MiB, audio/image<=20 MiB; unfinished uploads expire after one hour or extension restart. SHA256 is required. No server-local file paths.',
  hb_upload_chunk: 'Append <=256 KiB of base64-decoded bytes at the expected offset. Same bytes/offset are safe to repeat. Use a unique stable request_key per chunk, not one key for the whole file.',
  hb_upload_finish: 'Verify size/hash, upload through the original Huobao multipart API, then delete the temporary transfer. Returns original URL/path. Binding to an asset or storyboard is explicit and separate. Never blindly retry an unknown completion.',
  hb_upload_abort: 'Discard this unfinished temporary transfer only; does not remove original Huobao media.',
}
export class Uploads {
  private files = new Map<string, Row>()
  private root: string
  constructor(readonly ledger: Ledger, readonly api: Huobao) {
    this.root = join(ledger.dir, 'uploads')
    // Transfers have no business persistence and must never survive as an asset store.
    rmSync(this.root, { recursive: true, force: true }); mkdirSync(this.root, { mode: 0o700 })
  }
  private cleanup() { for (const [id, row] of this.files) if (Date.now() - row.created > 3_600_000) this.remove(id) }
  private remove(id: string) { rmSync(join(this.root, id), { force: true }); this.files.delete(id) }
  async invoke(name: string, a: Row) {
    this.cleanup(); this.ledger.gate()
    if (name === 'hb_upload_begin') {
      requireValue(this.files.size < 4, 'UPLOAD_LIMIT', 'Finish or abort existing transfers first (maximum four).')
      requireValue(a.size_bytes <= (a.kind === 'video' ? 50 : 20) * 1024 * 1024, 'UPLOAD_LIMIT', 'File exceeds the transfer size limit.')
      const extensions: Row = { image: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'], video: ['.mp4', '.mov', '.webm', '.m4v'], audio: ['.mp3', '.wav', '.m4a', '.aac'] }
      requireValue(extensions[a.kind].includes(extname(a.filename).toLowerCase()), 'FILE_TYPE', 'Unsupported media extension.')
      const id = randomUUID()
      writeFileSync(join(this.root, id), '', { mode: 0o600 })
      this.files.set(id, { ...a, created: Date.now(), received: 0 })
      return { upload_id: id, max_chunk_bytes: 262144, next_offset: 0 }
    }
    const row = this.files.get(a.upload_id)
    requireValue(row, 'UPLOAD_EXPIRED', 'Transfer missing/expired; start a new transfer. An uncertain finish must be reconciled first.')
    if (name === 'hb_upload_abort') { this.remove(a.upload_id); return { aborted: true } }
    if (name === 'hb_upload_chunk') {
      requireValue(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.base64), 'INVALID_BASE64', 'Use standard padded base64.')
      const bytes = Buffer.from(a.base64, 'base64')
      requireValue(bytes.length > 0 && bytes.length <= 262144 && a.offset + bytes.length <= row.size_bytes, 'UPLOAD_LIMIT', 'Chunk exceeds the declared size or chunk limit.')
      if (a.offset < row.received) {
        const old = readFileSync(join(this.root, a.upload_id)).subarray(a.offset, a.offset + bytes.length)
        requireValue(old.equals(bytes), 'CHUNK_CONFLICT', 'Bytes at this offset differ.')
      } else {
        requireValue(a.offset === row.received, 'CHUNK_OFFSET', `Expected offset ${row.received}.`)
        appendFileSync(join(this.root, a.upload_id), bytes); row.received += bytes.length
      }
      return { upload_id: a.upload_id, next_offset: row.received }
    }
    requireValue(row.received === row.size_bytes, 'UPLOAD_INCOMPLETE', 'Not all bytes have arrived.')
    const bytes = readFileSync(join(this.root, a.upload_id))
    requireValue(createHash('sha256').update(bytes).digest('hex') === row.sha256, 'UPLOAD_HASH', 'SHA256 mismatch; abort and start again.')
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'application/octet-stream' }), row.filename)
    try { return await this.api.call(`/upload/${row.kind}`, 'POST', form, { timeout: 120_000 }) }
    finally { this.remove(a.upload_id) }
  }
  close() { for (const id of this.files.keys()) this.remove(id) }
}
