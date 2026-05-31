
import LaunchDarkly from 'launchdarkly-node-server-sdk';
const ldClient = LaunchDarkly.init(process.env.LD_SDK_KEY!);

export async function processCheckout(userId: string) {
  const ctx = { kind: 'user', key: userId };
  const newCheckout = await ldClient.boolVariation('checkout-v2', ctx, false);
  const provider = await ldClient.stringVariation('payment-provider', ctx, 'stripe');
  const retries = await ldClient.numberVariation('payment-max-retries', ctx, 3);
  return { newCheckout, provider, retries };
}
