/**
 * ORACLE Alpha Telegram Module
 * Exports all telegram-related functionality
 */

// Bot functionality
export {
  // Message sending
  sendMessage,
  sendSignalAlert,
  broadcastSignal,
  editMessage,
  answerCallback,

  // Command handlers
  handleStart,
  handleHelp,
  handleSubscribe,
  handleUnsubscribe,
  handleSettings,
  handlePerformance,
  handleSources,
  handleTop,
  handlePortfolio,
  handleLatest,

  // Callback handler
  handleCallback,
  processUpdate,

  // Webhook management
  setupWebhook,
  removeWebhook,
  getWebhookInfo,

  // Polling mode
  startPolling,
  stopPolling,

  // Utility
  setSignalStore,
  RISK_EMOJI,
  SCORE_EMOJI,
  SOURCE_EMOJI
} from './bot';

// Subscriber management
export {
  // CRUD
  loadSubscribers,
  saveSubscribers,
  getSubscriber,
  addSubscriber,
  removeSubscriber,
  updateSubscriber,
  muteSubscriber,

  // Alerts
  recordAlert,
  getEligibleSubscribers,

  // Stats
  getSubscriberStats,
  getAllSubscribers,
  clearAllSubscribers,

  // Import/Export
  exportSubscribersData,
  importSubscribersData,

  // Types
  type Subscriber,
  type SubscriberPrefs,
  type SubscribersData
} from './subscribers';
