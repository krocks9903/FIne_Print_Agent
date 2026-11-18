/**
 * Browser-side re-export so copy/export paths can scrub PII without pulling the whole agent.
 * Keep in sync with `@fineprint/shared` redact rules.
 */
export {
  redactSensitiveText,
  redactFindingFields,
  type RedactionResult,
} from "@fineprint/shared";
