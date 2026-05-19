import { useFlags, useLDClient, LDProvider, withLDConsumer } from 'launchdarkly-react-client-sdk'
const flags = useFlags()
const client = useLDClient()
const App = () => <LDProvider clientSideID="xxx"><Component /></LDProvider>
export default withLDConsumer()(MyComponent)
