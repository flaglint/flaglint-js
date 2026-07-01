// Custom hooks that share names with the LD React SDK — not from LaunchDarkly.
// The scanner must NOT detect these as LD usage; import source must be verified.
import { useFlags, useLDClient } from '@company/feature-flags'
import { withLDConsumer } from '@internal/hocs'
import { LDProvider } from '@company/providers'

const flags = useFlags()
const client = useLDClient()

export const WrappedComponent = withLDConsumer()(MyComponent)
const App = () => <LDProvider clientSideID="xxx"><Component /></LDProvider>
