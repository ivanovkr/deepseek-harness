/** Browser-side bounds for directory discovery and text retention. */
import z from '@deepseek-ai/schemastery'

/** Deployment-adjustable read budgets. */
export interface Config { maxChanges: number; maxSpecFiles: number; maxDocumentBytes: number; maxDocumentPages: number }

/** Validate all budgets before opening resources. */
export const Config = z.object({
  maxChanges: z.number().step(1).min(1).max(2000).default(100),
  maxSpecFiles: z.number().step(1).min(1).max(2000).default(100),
  maxDocumentBytes: z.number().step(1).min(1).max(8388608).default(524288),
  maxDocumentPages: z.number().step(1).min(1).max(100).default(10),
})
