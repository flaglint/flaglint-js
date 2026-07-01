// Fixture: same function name as a configured wrapper, but imported from a different package.
// The scanner must NOT detect these calls — import source must match exactly.
import { useFeatureFlag } from '@other-company/flags'
import { evaluate } from '@analytics/events'

export const click = useFeatureFlag('click-tracking')
export const pageView = evaluate(ctx, 'page-view-experiment', false)
