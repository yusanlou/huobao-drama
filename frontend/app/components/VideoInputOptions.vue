<template>
  <details class="video-input-options">
    <summary>{{ t('professional.videoOptions') }}</summary>
    <p class="hint">{{ t('professional.requestOnly') }}</p>
    <label>{{ t('professional.mode') }}<select class="input" :value="modelValue.mode" @change="changeMode($event.target.value)"><option v-for="mode in capabilities?.modes || ['text', 'reference']" :key="mode" :value="mode">{{ t('professional.mode_' + mode) }}</option></select></label>
    <label v-if="capabilities?.audio" class="check"><input type="checkbox" :checked="modelValue.generate_audio ?? defaultAudio" @change="set('generate_audio', $event.target.checked)" />{{ t('professional.generateAudio') }}</label>
    <p v-else class="hint">{{ t('professional.audioFixed') }}</p>
    <label v-if="capabilities?.extend" class="check"><input type="checkbox" :checked="modelValue.prompt_extend ?? true" @change="set('prompt_extend', $event.target.checked)" />{{ t('professional.extend') }}</label>
    <template v-if="['first_frame', 'first_last'].includes(modelValue.mode)">
      <label>{{ t('professional.firstFrame') }}<input class="input" :value="modelValue.first_frame_url || ''" @input="set('first_frame_url', $event.target.value)" /></label>
      <button class="btn btn-sm" @click="$emit('upload', 'first_frame_url')">{{ t('professional.uploadImage') }}</button>
      <template v-if="modelValue.mode === 'first_last'"><label>{{ t('professional.lastFrame') }}<input class="input" :value="modelValue.last_frame_url || ''" @input="set('last_frame_url', $event.target.value)" /></label><button class="btn btn-sm" @click="$emit('upload', 'last_frame_url')">{{ t('professional.uploadImage') }}</button></template>
    </template>
    <template v-if="modelValue.mode === 'reference'">
      <label>{{ t('professional.videoRefs') }}<textarea class="textarea" rows="2" :value="(modelValue.reference_video_urls || []).join('\n')" @input="urls('reference_video_urls', $event.target.value)" /></label>
      <button class="btn btn-sm" @click="$emit('upload', 'reference_video_urls')">{{ t('professional.uploadVideo') }}</button>
      <label>{{ t('professional.audioRefs') }}<textarea class="textarea" rows="2" :value="(modelValue.reference_audio_urls || []).join('\n')" @input="urls('reference_audio_urls', $event.target.value)" /></label>
      <button class="btn btn-sm" @click="$emit('upload', 'reference_audio_urls')">{{ t('professional.uploadAudio') }}</button>
    </template>
    <template v-if="capabilities?.extend"><label>{{ t('professional.seed') }}<input class="input" type="number" min="-1" max="2147483647" :value="modelValue.seed ?? ''" @input="seed($event.target.value)" /></label><label class="check"><input type="checkbox" :checked="modelValue.watermark ?? false" @change="set('watermark', $event.target.checked)" />{{ t('professional.watermark') }}</label></template>
  </details>
</template>
<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({ modelValue: { type: Object, required: true }, capabilities: Object, defaultAudio: Boolean })
const emit = defineEmits(['update:modelValue', 'upload'])
function set(key, value) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
function urls(key, value) { set(key, value.split('\n').map(v => v.trim()).filter(Boolean)) }
function seed(value) { const next = { ...props.modelValue }; if (value === '') delete next.seed; else next.seed = Number(value); emit('update:modelValue', next) }
function changeMode(mode) {
  const { first_frame_url, last_frame_url, reference_image_urls, reference_video_urls, reference_audio_urls, continuity_review, ...rest } = props.modelValue
  emit('update:modelValue', { ...rest, mode })
}
</script>
<style scoped>
.video-input-options { padding: 12px 0; border-top: 1px solid var(--border); font-size: 12px; }summary { cursor: pointer; font-weight: 600; }label { display: grid; gap: 6px; margin: 10px 0; }.check { display: flex; align-items: center; }.hint { color: var(--text-secondary); line-height: 1.5; margin: 8px 0; }
</style>
