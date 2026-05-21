import React from 'react';
import { LDProvider } from 'launchdarkly-react-client-sdk';

export function TestWrapper({ children }) {
  return (
    <LDProvider clientSideID="abc">
      {children}
    </LDProvider>
  );
}
