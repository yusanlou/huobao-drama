export class ContractError extends Error { code: string; constructor(code: string, message: string) }
export type Requirements = { version: 1; target_duration_seconds?: number; narrative_mode: 'general' | 'archive_narration' | 'character_drama'; adaptation_scope: string; must_keep: string[]; avoid: string[]; speech_mode: 'native' | 'none' }
export const REQUIREMENTS_OPEN: string
export const REQUIREMENTS_CLOSE: string
export function emptyRequirements(): Requirements
export function validateRequirements(value: unknown): Requirements
export function parseRequirements(description?: string): { requirements: Requirements | null; start: number; end: number }
export function mergeRequirements(description: string, value: Requirements): string
export function requirementsMessage(description?: string): string
export function agentMessage(kind: string, options?: { description?: string; storyboard_ids?: number[]; video_model?: string }): string
export function videoCapabilities(provider: string, model?: string): { provider: string; modes: string[]; min: number; max: number; images: number; videos: number; audios: number; total: number; audio: boolean; extend: boolean }
export function boundAssets(shot: Record<string, any>, context: Record<string, any>): { id: number; name: string; url: string }[]
export function resolveReferences(prompt: string, assets: { id: number; name: string; url: string }[], urls: string[], mode: string): string
export const videoParameterKeys: string[]
export function inspectVideoInput(input: Record<string, any>): Record<string, any>
export function productionChecks(shots: Record<string, any>[], requirements: Requirements | null, selectedId?: number): Record<string, any>
