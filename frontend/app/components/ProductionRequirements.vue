<template>
  <details class="production-requirements">
    <summary>{{ t('professional.requirements') }} <span>{{ modelValue.target_duration_seconds ? `${modelValue.target_duration_seconds}s` : t('professional.unspecified') }}{{ dirty ? ' · ' + t('professional.unsaved') : '' }}</span></summary>
    <div class="requirements-fields">
      <label>{{ t('professional.target') }}<input class="input" type="number" min="1" step="1" :value="modelValue.target_duration_seconds ?? ''" @input="duration($event)" /></label>
      <label>{{ t('professional.narrative') }}<select class="input" :value="modelValue.narrative_mode" @change="set('narrative_mode', $event.target.value)"><option v-for="mode in ['general', 'archive_narration', 'character_drama']" :key="mode" :value="mode">{{ t('professional.' + mode) }}</option></select></label>
      <label>{{ t('professional.speech') }}<select class="input" :value="modelValue.speech_mode" @change="set('speech_mode', $event.target.value)"><option value="native">{{ t('professional.native') }}</option><option value="none">{{ t('professional.none') }}</option></select></label>
      <label class="full">{{ t('professional.scope') }}<textarea class="textarea" rows="2" :value="modelValue.adaptation_scope" @input="set('adaptation_scope', $event.target.value)" /></label>
      <label>{{ t('professional.keep') }}<textarea class="textarea" rows="3" :value="modelValue.must_keep.join('\n')" @input="lines('must_keep', $event.target.value)" /></label>
      <label>{{ t('professional.avoid') }}<textarea class="textarea" rows="3" :value="modelValue.avoid.join('\n')" @input="lines('avoid', $event.target.value)" /></label>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="requirements-actions"><span>{{ t('professional.requirementsHint') }}</span><button class="btn btn-sm" type="button" @click="$emit('reload')">{{ t('professional.reload') }}</button><button class="btn btn-sm btn-primary" type="button" :disabled="saving || !!error || !dirty" @click="$emit('save')">{{ saving ? t('professional.saving') : t('common.save') }}</button></div>
  </details>
</template>
<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({ modelValue: { type: Object, required: true }, dirty: Boolean, saving: Boolean, error: String })
const emit = defineEmits(['update:modelValue', 'save', 'reload'])
function set(key, value) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
function lines(key, value) { set(key, value.split('\n')) }
function duration(event) { const next = { ...props.modelValue }; if (event.target.value === '') delete next.target_duration_seconds; else next.target_duration_seconds = Number(event.target.value); emit('update:modelValue', next) }
</script>
<style scoped>
.production-requirements { border-bottom: 1px solid var(--border); padding: 12px 20px; color: var(--text-primary); flex: 0 0 auto; max-height: 50vh; overflow: auto; }
summary { cursor: pointer; font-size: 13px; font-weight: 600; }
summary span, .requirements-actions span { font-size: 12px; color: var(--text-secondary); font-weight: 400; }
.requirements-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
label { display: grid; gap: 6px; font-size: 12px; }.full { grid-column: 1 / -1; }
.requirements-actions { display: flex; gap: 10px; align-items: center; margin-top: 12px; }.requirements-actions span { flex: 1; }
@media (max-width: 700px) { .requirements-fields { grid-template-columns: 1fr; } }
</style>
