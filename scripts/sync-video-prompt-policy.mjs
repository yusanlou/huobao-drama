// Keep both native Agents' runtime Skills aligned with the shared client policy.
// Use --workspace-dir for staging before deploying through the original APIs.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
import { VIDEO_PROMPT_POLICY } from '../shared/video-prompts.mjs'
const args = process.argv.slice(2)
const workspace = args.includes('--workspace-dir') ? resolve(args[args.indexOf('--workspace-dir') + 1]) : fileURLToPath(new URL('../backend/workspace', import.meta.url))
const open = '<!-- huobao-video-prompt-policy:v1 -->', close = '<!-- /huobao-video-prompt-policy:v1 -->'
const block = `${open}\n${VIDEO_PROMPT_POLICY}\n${close}\n`
for (const id of ['storyboard-breaker', 'prompt-generator/video-prompt']) for (const lang of ['', '.en', '.ja', '.ko']) {
  const path = join(workspace, `skills/${id}/SKILL${lang}.md`)
  const previous = await readFile(path, 'utf8')
  const start = previous.indexOf(open), end = previous.indexOf(close)
  if ((start < 0) !== (end < 0) || (start >= 0 && end < start)) throw Error(`Invalid generated section: ${path}`)
  const next = start < 0 ? previous.trimEnd() + '\n\n' + block : previous.slice(0, start) + block + previous.slice(end + close.length).replace(/^\n/, '')
  if (args.includes('--check')) { if (previous !== next) throw Error(`Video prompt policy out of sync: ${path}`) }
  else await writeFile(path, next)
}
console.log(args.includes('--check') ? '8 runtime Skill policies match the shared specification.' : 'Updated 8 runtime Skill policies.')
