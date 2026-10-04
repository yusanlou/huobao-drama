import { ref, computed, watch, type Ref } from 'vue'
import { dramaAPI, episodeAPI } from './useApi'
import { emptyRequirements, parseRequirements, mergeRequirements, type Requirements } from '../../shared-production'

export function useProductionRequirements(projectId: number, episode: Ref<any>) {
  const draft = ref<Requirements>(emptyRequirements())
  const original = ref(JSON.stringify(draft.value))
  const description = ref('')
  const error = ref(''), saving = ref(false)
  const dirty = computed(() => JSON.stringify(draft.value) !== original.value)
  function load(value: string) {
    try {
      draft.value = parseRequirements(value).requirements || emptyRequirements()
      description.value = value; original.value = JSON.stringify(draft.value); error.value = ''
    } catch (e: any) { error.value = e.message }
  }
  watch(() => episode.value?.description || '', value => { if (!dirty.value) load(value) }, { immediate: true })
  async function save() {
    if (error.value) throw new Error(error.value)
    if (!episode.value?.id) throw new Error('Episode is not loaded.')
    // Reread even when unedited, so the Agent sees current requirements from MCP.
    const current: any = await dramaAPI.get(projectId)
    const ep = current.episodes?.find((e: any) => e.id === episode.value.id)
    if (!ep) throw new Error('Episode no longer exists.')
    if (!dirty.value) { load(ep.description || ''); if (error.value) throw new Error(error.value); return description.value }
    if ((ep.description || '') !== description.value) throw new Error('制作要求已在其他入口修改，请重新加载后合并 / Requirements changed; reload before editing.')
    const next = mergeRequirements(ep.description || '', draft.value)
    saving.value = true
    try {
      await episodeAPI.update(ep.id, { description: next })
      const after: any = await dramaAPI.get(projectId)
      if (after.episodes?.find((e: any) => e.id === ep.id)?.description !== next) throw new Error('保存读回不一致，请刷新核对 / Readback differs; refresh to reconcile.')
      load(next); episode.value.description = next
      return next
    } finally { saving.value = false }
  }
  async function reload() {
    const current: any = await dramaAPI.get(projectId)
    const ep = current.episodes?.find((e: any) => e.id === episode.value?.id)
    if (ep) { load(ep.description || ''); episode.value.description = ep.description }
  }
  return { draft, dirty, saving, error, save, reload }
}
