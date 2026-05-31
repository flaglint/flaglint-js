const LD = require('launchdarkly-node-server-sdk');
const client = LD.init(process.env.LD_SDK_KEY);

async function sendNotification(userId) {
  const ctx = { kind: 'user', key: userId };
  const enabled = await client.boolVariation('notifications-enabled', ctx, true);
  const template = await client.stringVariation('notification-template', ctx, 'default');
  return { enabled, template };
}
module.exports = { sendNotification };
