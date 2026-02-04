/**
 * ORACLE Alpha Integrations
 * External service integrations for notifications and alerts
 */

export {
  initDiscordBot,
  shutdownDiscordBot,
  setSignalStore,
  broadcastSignal,
  sendWebhookAlert,
  testWebhook,
  getBotStatus,
  getSubscription,
  getAllSubscriptions,
  DISCORD_WEBHOOK_URL,
  DISCORD_BOT_TOKEN
} from './discord-bot';
