<template>
  <details class="production-checks">
    <summary>{{ t('professional.checks') }} · {{ checks.storyboard_seconds }}s<span v-if="checks.target_seconds"> / {{ checks.target_seconds }}s</span></summary>
    <p>{{ t('professional.estimateOnly') }}</p>
    <p v-if="checks.difference_seconds !== null">{{ t('professional.difference') }}: {{ checks.difference_seconds > 0 ? '+' : '' }}{{ checks.difference_seconds }}s</p>
    <p v-if="checks.missing_durations.length">{{ t('professional.durationMissing') }}: {{ checks.missing_durations.join(', ') }}</p>
    <p>{{ t('professional.dialogueHint') }}</p>
    <p v-if="checks.speech_estimate_seconds !== null">{{ t('professional.speechEstimate', { seconds: checks.speech_estimate_seconds }) }}<strong v-if="checks.speech_may_overrun"> {{ t('professional.speechOverrun') }}</strong></p>
    <ul v-if="checks.missing_quoted_text.length"><li v-for="line in checks.missing_quoted_text" :key="line">{{ line }}</li></ul>
    <dl><dt>{{ t('professional.previous') }}</dt><dd>{{ checks.previous_end || '—' }}</dd><dt>{{ t('professional.current') }}</dt><dd>{{ checks.current || '—' }}</dd><dt>{{ t('professional.next') }}</dt><dd>{{ checks.next || '—' }}</dd></dl>
    <details><summary>{{ t('professional.preview') }}</summary><p>{{ t('professional.previewHint') }}</p><p v-if="error" role="alert">{{ error }}</p><template v-else><ul><li v-for="warning in preview?.warnings || []" :key="warning">{{ warning }}</li></ul><dl><dt>{{ t('professional.previewRequest') }}</dt><dd>{{ preview?.body?.model }} · {{ preview?.body?.duration }}s · {{ preview?.body?.resolution }} · {{ preview?.body?.aspect_ratio }}</dd><dt>{{ t('professional.previewAdapter') }}</dt><dd>{{ preview?.predicted?.resolution }} · {{ preview?.predicted?.aspect_ratio }}</dd><dt>{{ t('professional.generateAudio') }} / {{ t('professional.extend') }}</dt><dd>{{ String(preview?.body?.generate_audio) }} / {{ preview?.body?.prompt_extend === undefined ? '—' : String(preview?.body?.prompt_extend) }}</dd><dt>{{ t('professional.previewPrompt') }}</dt><dd>{{ preview?.predicted?.prompt }}</dd><dt>{{ t('professional.previewMedia') }}</dt><dd v-for="ref in preview?.references || []" :key="ref.index">{{ ref.index }}. {{ ref.names.join(' / ') }} · {{ ref.url }}</dd></dl><details><summary>{{ t('professional.requestFields') }}</summary><pre>{{ JSON.stringify(preview?.body, null, 2) }}</pre></details></template></details>
    <details><summary>{{ t('professional.record') }}</summary><p>{{ t('professional.recordHint') }}</p><pre>{{ JSON.stringify(record, null, 2) }}</pre></details>
    <p>{{ t('professional.overwrite') }}</p>
    <label>{{ t('professional.reviewReason') }}<select v-model="reason" class="input"><option value="">—</option><option v-for="key in ['dialogue', 'style', 'action', 'continuity']" :key="key" :value="key">{{ t('professional.reason_' + key) }}</option></select></label>
    <p v-if="reason">{{ t('professional.review_' + reason) }}</p>
  </details>
</template>
<script setup>
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
const { t } = useI18n()
defineProps({ checks: { type: Object, required: true }, preview: Object, error: String, record: Object })
const reason = ref('')
</script>
<style scoped>
.production-checks { padding: 12px 0; font-size: 12px; line-height: 1.6; border-top: 1px solid var(--border); }summary { cursor: pointer; font-weight: 600; }p,dd { color: var(--text-secondary); white-space: pre-wrap; margin: 8px 0; }dt { margin-top: 10px; }pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 320px; overflow: auto; font-size: 11px; background: var(--bg-base); padding: 10px; }details { margin-top: 10px; }
</style>
