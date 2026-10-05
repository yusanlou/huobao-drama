export class ContractError extends Error { code: string; constructor(code: string, message: string) }
export class ContinuityError extends Error { code: string; constructor(message: string) }
export type Requirements = { version: 1; target_duration_seconds?: number; narrative_mode: 'general' | 'archive_narration' | 'character_drama'; adaptation_scope: string; must_keep: string[]; avoid: string[]; speech_mode: 'native' | 'none' }
export const REQUIREMENTS_OPEN: string
export const REQUIREMENTS_CLOSE: string
export function emptyRequirements(): Requirements
export function validateRequirements(value: unknown): Requirements
export function parseRequirements(description?: string): { requirements: Requirements | null; start: number; end: number }
export function mergeRequirements(description: string, value: Requirements): string
export function requirementsMessage(description?: string): string
export function agentMessage(kind: string, options?: { description?: string; storyboard_ids?: number[]; video_model?: string; storyboards?: Record<string, any>[]; project?: Record<string, any>; style_prompt?: string }): string
export const VIDEO_PROMPT_POLICY: string
export function videoPromptCoverage(shot: Record<string, any>): { status: string; missing_sections: string[]; missing_speech: string[]; semantic_approval: false }
export class PromptCompletionError extends Error { code: string; report: Record<string, any> }
export function completeVideoPrompts(options: { readContext: () => Promise<Record<string, any>>; generate: (id: number, context: Record<string, any>) => Promise<unknown>; storyboardIds?: number[]; force?: boolean; onProgress?: (progress: { total: number; completed: number }) => void }): Promise<Record<string, any>>
export function videoCapabilities(provider: string, model?: string): { provider: string; modes: string[]; min: number; max: number; images: number; videos: number; audios: number; total: number; audio: boolean; extend: boolean }
export function boundAssets(shot: Record<string, any>, context: Record<string, any>): { id: number; name: string; url: string }[]
export function resolveReferences(prompt: string, assets: { id: number; name: string; url: string }[], urls: string[], mode: string): string
export const videoParameterKeys: string[]
export function inspectVideoInput(input: Record<string, any>): Record<string, any>
export function productionChecks(shots: Record<string, any>[], requirements: Requirements | null, selectedId?: number, sourceScript?: string): Record<string, any>
export function validateContinuity(plan: Record<string, any>): Record<string, any>
export function parseContinuity(result?: string): { plan: Record<string, any> | null; text: string; start: number; end: number }
export function mergeContinuity(result: string, plan: Record<string, any>): string
export function continuityCheck(shots: Record<string, any>[], id: number): Record<string, any>
export function continuitySnapshot(context: Record<string, any>): string
export function assertContinuityInput(context: Record<string, any>, body: Record<string, any>, options: Record<string, any>): Record<string, any>
export function requiresContinuityFrame(check: Record<string, any>, options?: Record<string, any>): boolean
export function assertContinuityBatch(shots: Record<string, any>[], selectedIds: number[]): void
export function assertContinuityTasks(shots: Record<string, any>[], id: number, tasks: Record<string, any>[]): void
