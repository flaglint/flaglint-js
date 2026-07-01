// Fixture: import-verified wrapper detection.
// useFeatureFlag is imported from '@company/flags' — matches object-form wrapper config.
// evaluate puts the flag key at argument index 1 — tests flagKeyArgument.
import { useFeatureFlag } from '@company/flags'
import { useFeatureFlag as useFF } from '@company/flags'
import { evaluate } from '@company/experimentation'

export const showBanner = useFeatureFlag('show-banner')
export const darkMode = useFeatureFlag('dark-mode')
export const aliased = useFF('aliased-flag')
export const experiment = evaluate(userContext, 'price-experiment', false)
