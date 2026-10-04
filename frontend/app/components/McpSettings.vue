<template>
  <div class="mcp-settings">
    <div class="settings-head">
      <h2 class="settings-title">{{ t('mcp.title') }}</h2>
      <p class="settings-desc">{{ t('mcp.description') }}</p>
    </div>
    <section class="card mcp-card">
      <div class="mcp-row">
        <div>
          <h3>{{ t('mcp.connection') }}</h3>
          <p role="status">{{ t(`mcp.${connection}`) }}</p>
        </div>
        <button class="btn btn-ghost" :disabled="busy || refreshing" @click="refresh">{{ t('mcp.refresh') }}</button>
      </div>
      <template v-if="connection === 'offline'">
        <p>{{ t('mcp.startHint') }}</p>
        <code>npm run dev:mcp</code>
      </template>
      <template v-if="status && connection === 'connected'">
        <div class="mcp-row mcp-switch-row">
          <div>
            <h3>{{ t('mcp.enable') }}</h3>
            <p>{{ t('mcp.switchHint') }}</p>
          </div>
          <button role="switch" :aria-checked="status.enabled" :aria-label="t('mcp.enable')" :class="['mcp-switch', { on: status.enabled }]" :disabled="busy" @click="toggle">
            <span />
          </button>
        </div>
        <dl>
          <dt>{{ t('mcp.backend') }}</dt><dd>{{ status.upstream }}</dd>
          <dt>{{ t('mcp.health') }}</dt><dd>{{ t(status.upstream_health === 'ok' ? 'mcp.healthy' : 'mcp.unhealthy') }}</dd>
          <dt>{{ t('mcp.endpoint') }}</dt><dd>{{ status.mcp_url }}</dd>
        </dl>
        <button class="btn btn-secondary" :disabled="busy" @click="copyConfig">{{ t('mcp.copyConfig') }}</button>
        <p class="mcp-note">{{ t('mcp.configHint') }}</p>
      </template>
      <p v-if="notice" class="mcp-notice" role="status">{{ notice }}</p>
      <p v-if="error" class="mcp-error" role="alert">{{ error }}</p>
    </section>
    <section v-if="connection === 'connected'" class="card mcp-card">
      <h3>{{ t('mcp.runs') }}</h3>
      <p v-if="!runs.length">{{ t('mcp.noRuns') }}</p>
      <article v-for="run in runs" :key="run.id" class="mcp-run">
        <div class="mcp-row">
          <div>
            <NuxtLink :to="`/drama/${run.project_id}`">{{ t('mcp.project') }} {{ run.project_id }}</NuxtLink>
            <p>{{ run.id }}</p>
          </div>
          <span>{{ t(`mcp.states.${run.status}`) }}</span>
          <button v-if="run.status === 'paused'" class="btn btn-secondary" :disabled="busy || !status?.enabled" @click="resume(run.id)">{{ t('mcp.resume') }}</button>
        </div>
        <p>{{ run.steps.filter((s: any) => s.status === 'succeeded').length }} / {{ run.steps.length }} {{ t('mcp.stepsDone') }}</p>
        <p v-if="run.steps.some((s: any) => s.status === 'submitted')">{{ t('mcp.inflight') }}</p>
        <p v-if="run.status === 'needs_attention'">{{ t('mcp.attentionHint') }}</p>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const { request } = useMcpExtension()
const status = ref<any>(null)
const runs = ref<any[]>([])
const connection = ref('offline')
const busy = ref(false), refreshing = ref(false), error = ref(''), notice = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let disposed = false
function errorMessage(e: any) {
  const messages: Record<string, string> = { REVISION_CONFLICT: 'conflict', UPSTREAM_UNAVAILABLE: 'unhealthy', NEEDS_RECONCILIATION: 'attentionHint', MCP_DISABLED: 'disabled' }
  return t(`mcp.${messages[e?.code] || 'operationFailed'}`)
}
async function refresh() {
  if (refreshing.value || disposed) return
  refreshing.value = true
  try {
    const value = await request('/status')
    if (disposed) return
    status.value = value; connection.value = 'connected'
    const result = await request('/runs')
    if (!disposed) runs.value = result.runs
  } catch (e: any) {
    if (!disposed) { status.value = null; connection.value = 'offline' }
  } finally { refreshing.value = false }
}
async function perform(fn: () => Promise<void>) {
  busy.value = true; error.value = ''; notice.value = ''
  try { await fn() } catch (e) { error.value = errorMessage(e) }
  finally { await refresh(); busy.value = false }
}
async function toggle() {
  if (!status.value) return
  const enabled = !status.value.enabled, expected_revision = status.value.revision
  await perform(async () => { await request('/enabled', 'PUT', { enabled, expected_revision }) })
}
async function copyConfig() {
  await perform(async () => {
    const value = await request('/client-config', 'POST', {})
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
    notice.value = t('mcp.copied')
  })
}
async function resume(id: string) { await perform(async () => { await request(`/runs/${id}/resume`, 'POST', {}) }) }
onMounted(() => { void refresh(); timer = setInterval(() => { if (!busy.value) void refresh() }, 10_000) })
onBeforeUnmount(() => { disposed = true; if (timer) clearInterval(timer) })
</script>

<style scoped>
.mcp-settings { padding: 28px; max-width: 960px; }
.settings-title { margin: 0 0 8px; font-size: 20px; }
.settings-desc, .mcp-card p { color: var(--text-secondary); font-size: 13px; line-height: 1.7; }
.mcp-card { padding: 22px; margin-top: 20px; }
.mcp-card h3 { font-size: 14px; margin: 0; }
.mcp-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.mcp-switch-row { margin: 20px 0; padding: 18px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.mcp-switch { width: 42px; height: 24px; flex-shrink: 0; border: none; border-radius: 20px; padding: 3px; background: var(--text-secondary); cursor: pointer; }
.mcp-switch span { display: block; width: 18px; height: 18px; border-radius: 50%; background: white; transition: transform .15s; }
.mcp-switch.on { background: var(--accent); }
.mcp-switch.on span { transform: translateX(18px); }
.mcp-switch:disabled { opacity: .5; cursor: wait; }
.mcp-switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
dl { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 12px; font-size: 13px; margin: 20px 0; }
dt { color: var(--text-secondary); } dd { margin: 0; overflow-wrap: anywhere; }
.mcp-run { border-top: 1px solid var(--border); padding-top: 16px; margin-top: 16px; }
.mcp-run p { overflow-wrap: anywhere; }
.mcp-error { color: #c44343 !important; }.mcp-notice { color: var(--accent) !important; }
@media (max-width: 640px) { .mcp-settings { padding: 16px; } .mcp-row { flex-wrap: wrap; } }
</style>
