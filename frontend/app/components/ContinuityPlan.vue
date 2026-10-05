<template>
  <details class="continuity-plan" open>
    <summary>{{ t('continuity.title') }}</summary>
    <p>{{ t('continuity.hint') }}</p>
    <p v-if="parseError" role="alert">{{ parseError }}</p>
    <template v-else>
      <label>{{ t('continuity.transition') }}<select v-model="draft.transition" class="input"><option v-for="key in ['start', 'continuous', 'cut', 'time_cut']" :key="key" :value="key">{{ t('continuity.' + key) }}</option></select></label>
      <label v-for="key in ['reason', 'space', 'camera']" :key="key">{{ t('continuity.' + key) }}<textarea v-model="draft[key]" class="textarea" rows="2" /></label>
      <p>{{ t('continuity.statesHint') }}</p>
      <div class="add-character"><select v-model="addId" class="input"><option value="">{{ t('continuity.addCharacter') }}</option><option v-for="c in characters.filter(c => !draft.start.some(s => s.id === Number(c.id)))" :key="c.id" :value="c.id">{{ c.name }}</option></select><button class="btn btn-sm" :disabled="!addId" @click="addCharacter">{{ t('continuity.add') }}</button></div>
      <div v-for="key in ['start', 'end']" :key="key">
        <strong>{{ t('continuity.state_' + key) }}</strong>
        <div v-for="state in draft[key]" :key="state.id" class="character-state">
          <div><strong>{{ characters.find(c => Number(c.id) === state.id)?.name || state.id }}</strong><button class="btn btn-sm" @click="removeCharacter(state.id)">{{ t('continuity.remove') }}</button></div>
          <label class="check"><input v-model="state.visible" type="checkbox" />{{ t('continuity.visible') }}</label>
          <label v-for="field in ['position', 'pose', 'appearance']" :key="field">{{ t('continuity.' + field) }}<input v-model="state[field]" class="input" /></label>
        </div>
      </div>
      <button class="btn btn-sm" :disabled="saving || !dirty" @click="$emit('save', { plan: draft, originalResult: shot.result || '' })">{{ t('continuity.save') }}{{ dirty ? ' *' : '' }}</button>
    </template>
    <ul v-if="check.issues.length"><li v-for="(issue, i) in check.issues" :key="i" role="alert">{{ issue.message }}</li></ul>
    <p v-else>{{ t('continuity.structureOnly') }}</p>
    <template v-if="check.needs_frame">
      <p>{{ t(check.plan.transition === 'continuous' ? 'continuity.sameCameraHint' : needsFirstFrame ? 'continuity.cutHint' : 'continuity.cutReferenceHint') }}</p>
      <div class="frame-pair">
        <div><strong>{{ t('continuity.previousVideo') }}</strong><video v-if="check.previous?.video_url" ref="previousVideo" :src="mediaUrl(check.previous.video_url)" controls crossorigin="anonymous" preload="metadata" /><p v-else>{{ t('continuity.previousMissing') }}</p>
          <button v-if="check.plan.transition === 'continuous' && check.previous?.video_url" class="btn btn-sm" @click="capture">{{ t('continuity.capture') }}</button>
        </div>
        <div v-if="needsFirstFrame"><strong>{{ t('continuity.nextFrame') }}</strong><img v-if="frameUrl" :src="mediaUrl(frameUrl)" :alt="t('continuity.nextFrame')" /><p v-else>{{ t('continuity.uploadHint') }}</p></div>
      </div>
      <p v-if="captureError" role="alert">{{ captureError }}</p>
      <label v-if="needsFirstFrame" class="check"><input type="checkbox" :checked="reviewed" :disabled="dirty || !frameUrl || !check.previous?.video_url || !!check.issues.length" @change="$emit('review', $event.target.checked)" />{{ t('continuity.review') }}</label>
      <p v-if="needsFirstFrame">{{ t('continuity.reviewHint') }}</p>
    </template>
  </details>
</template>
<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseContinuity, requiresContinuityFrame } from '../../shared-production'
const props = defineProps({ shot: { type: Object, required: true }, check: { type: Object, required: true }, characters: { type: Array, default: () => [] }, mode: { type: String, default: 'reference' }, frameUrl: String, reviewed: Boolean, saving: Boolean })
const emit = defineEmits(['save', 'review', 'capture', 'dirty'])
const { t } = useI18n()
const draft = ref({}), addId = ref(''), parseError = ref(''), previousVideo = ref(null), captureError = ref('')
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.check.plan))
const needsFirstFrame = computed(() => requiresContinuityFrame(props.check, { mode: props.mode }))
watch(dirty, value => { emit('dirty', value); if (value) emit('review', false) }, { immediate: true })
const copy = value => JSON.parse(JSON.stringify(value))
watch(() => [props.shot.id, props.shot.result], () => {
  parseError.value = ''; captureError.value = ''; addId.value = ''
  try {
    const plan = parseContinuity(props.shot.result || '').plan
    const previous = props.check.previous?.plan
    const states = previous?.end ? copy(previous.end) : (props.shot.character_ids || props.shot.characterIds || []).map(id => ({ id: Number(id), visible: true, position: '', pose: '', appearance: '' }))
    draft.value = plan || { version: 1, transition: props.check.previous ? 'cut' : 'start', reason: '', space: previous?.space || '', camera: previous?.camera || '', start: states, end: copy(states) }
  } catch (e) { parseError.value = e.message }
}, { immediate: true })
function addCharacter() { const state = { id: Number(addId.value), visible: false, position: '', pose: '', appearance: '' }; draft.value.start.push(state); draft.value.end.push(copy(state)); addId.value = '' }
function removeCharacter(id) { for (const key of ['start', 'end']) draft.value[key] = draft.value[key].filter(s => s.id !== id) }
function mediaUrl(url) { return /^https?:\/\//.test(url) ? url : '/' + url.replace(/^\/+/, '') }
async function capture() {
  captureError.value = ''
  const shotId = props.shot.id
  try {
    const video = previousVideo.value
    if (!video?.videoWidth || video.readyState < 2 || video.seeking) throw Error(t('continuity.seekFirst'))
    video.pause()
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw Error(t('continuity.captureFailed'))
    emit('capture', { file: new File([blob], 'continuity-frame.png', { type: 'image/png' }), shotId })
  } catch (e) { captureError.value = e.message }
}
</script>
<style scoped>
.continuity-plan { padding: 12px 0; border-top: 1px solid var(--border); font-size: 12px; line-height: 1.6; }summary { font-weight: 600; cursor: pointer; }p { color: var(--text-secondary); }label { display: grid; gap: 6px; margin: 8px 0; }.check,.add-character { display: flex; align-items: center; gap: 8px; }.character-state { padding: 10px; margin: 8px 0; border: 1px solid var(--border); border-radius: 6px; }.character-state > div { display: flex; justify-content: space-between; }.frame-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }video,img { display: block; width: 100%; max-height: 220px; object-fit: contain; margin: 8px 0; }[role=alert] { color: var(--danger, #c75a53); }
</style>
