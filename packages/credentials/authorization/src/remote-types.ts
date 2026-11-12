/** JSON values carried by the authorization Remote service. */
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials/types'
import type { AuthorizationNotice, AuthorizationPromptOption, AuthorizationStatus } from './types.ts'

/** Safe diagnostic categories exposed when an authorization flow fails. */
export type AuthorizationRemoteDiagnostic = 'DNS_LOOKUP' | 'CONNECTION_REFUSED' | 'NETWORK_TIMEOUT'
  | 'CONNECTION_RESET' | 'TLS_FAILURE' | 'HTTP_UNAUTHORIZED' | 'HTTP_FORBIDDEN'
  | 'HTTP_RATE_LIMITED' | 'HTTP_SERVER_ERROR' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN'

/** Stable refusals exposed by the Remote conversation owner. */
export type AuthorizationRemoteFailureCode = 'NO_FLOW' | 'UNKNOWN_METHOD' | 'ALREADY_IN_FLIGHT'
  | 'NOT_COMMITTED' | 'NO_ATTEMPT' | 'NOT_OWNER' | 'STALE_PROMPT' | 'INVALID_ANSWER' | 'FLOW_FAILED'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Authorization refusal; raw provider messages and credential values are never included. */
    'authorization/rejected': {
      readonly code: AuthorizationRemoteFailureCode
      readonly diagnostic?: AuthorizationRemoteDiagnostic
    }
  }
}

/** Opaque identity of one question within a running authorization attempt. */
export type AuthorizationPromptId = Branded<'AuthorizationPromptId'>

/** A human question with its process-local cancellation signal removed. */
export type AuthorizationRemotePrompt = {
  kind: 'text' | 'secret'
  message: string
  placeholder?: string
} | {
  kind: 'select'
  message: string
  options: readonly AuthorizationPromptOption[]
}

/** Ordered progress for the stream that owns one attempt. */
export type AuthorizationRemoteEvent =
  | { type: 'notice'; notice: AuthorizationNotice }
  | { type: 'prompt'; id: AuthorizationPromptId; prompt: AuthorizationRemotePrompt }
  | { type: 'prompt-withdrawn'; id: AuthorizationPromptId }
  | { type: 'settled'; status: AuthorizationStatus }

/** Credential availability without a grant payload or masked secret. */
export interface AuthorizationRemoteStatus {
  key: CredentialKey
  configured: boolean
  writable: boolean
  inFlight: boolean
}
