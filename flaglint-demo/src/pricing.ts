import LaunchDarkly from 'launchdarkly-node-server-sdk';
const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY!);

export async function getPricing(userId: string) {
  const ctx = { kind: 'user', key: userId };
  const newPricing = await ldClient.boolVariation('new-pricing-page', ctx, false);
  const variant = await ldClient.stringVariation('pricing-variant', ctx, 'control');
  return { newPricing, variant };
}
