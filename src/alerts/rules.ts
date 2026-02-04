/**
 * Custom Alert Rules Builder
 * Define custom trigger conditions with IF-THEN logic
 * 
 * Features:
 * - Custom conditions (score, risk, source, volume, etc.)
 * - Multiple actions (notify, auto-trade, webhook)
 * - AND/OR condition groups
 * - Rule templates for common patterns
 */

import crypto from 'crypto';
import { AggregatedSignal, SignalSource, RiskLevel } from '../types';
import { processSignalForAutoCopy, getAutoCopySettings } from '../trading/auto-copy';

// ==================== TYPES ====================

export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'greater_than' 
  | 'less_than' 
  | 'greater_or_equal' 
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in';

export type ConditionField = 
  | 'score'
  | 'riskLevel'
  | 'source'
  | 'sources_count'
  | 'symbol'
  | 'mcap'
  | 'liquidity'
  | 'volume5m'
  | 'volume1h'
  | 'priceChange5m'
  | 'priceChange1h'
  | 'age'
  | 'holders'
  | 'convictionLevel'
  | 'safetyScore'
  | 'hasNarrative';

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | string[];
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: RuleCondition[];
}

export type RuleActionType = 'notify' | 'auto_trade' | 'webhook' | 'telegram' | 'discord' | 'log';

export interface RuleAction {
  type: RuleActionType;
  config: Record<string, any>;
}

// Telegram action config
export interface TelegramActionConfig {
  chatId?: string;
  message?: string;
  includeChart?: boolean;
}

// Discord action config
export interface DiscordActionConfig {
  webhookUrl?: string;
  message?: string;
  embed?: boolean;
}

// Webhook action config
export interface WebhookActionConfig {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, any>;
}

// Auto-trade action config
export interface AutoTradeActionConfig {
  positionSizePercent?: number;
  maxPositionUSD?: number;
  slippageBps?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  
  // Condition groups (supports AND/OR logic)
  conditionGroups: ConditionGroup[];
  groupOperator: 'AND' | 'OR'; // How to combine condition groups
  
  // Actions to execute when rule triggers
  actions: RuleAction[];
  
  // Rate limiting
  cooldownMinutes: number;
  maxTriggersPerDay: number;
  
  // Stats
  stats: {
    triggeredCount: number;
    lastTriggered?: number;
    todayTriggers: number;
  };
  
  // Tags for organization
  tags?: string[];
}

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'smart-wallet' | 'risk-filter' | 'volume' | 'custom';
  conditionGroups: ConditionGroup[];
  groupOperator: 'AND' | 'OR';
  suggestedActions: RuleActionType[];
}

export interface RuleTriggerEvent {
  ruleId: string;
  ruleName: string;
  signalId: string;
  token: string;
  symbol: string;
  timestamp: number;
  actionsExecuted: string[];
  results: { action: string; success: boolean; error?: string }[];
}

// ==================== STATE ====================

const rules: Map<string, AlertRule> = new Map();
const triggerHistory: RuleTriggerEvent[] = [];
let lastDayReset = new Date().setHours(0, 0, 0, 0);

// Webhook callbacks
type RuleTriggerCallback = (event: RuleTriggerEvent, signal: AggregatedSignal) => void;
const triggerCallbacks: RuleTriggerCallback[] = [];

// ==================== TEMPLATES ====================

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'elite-wallet-high-score',
    name: 'Elite Wallet + High Score',
    description: 'Alert when elite wallet buys with score > 85',
    category: 'smart-wallet',
    conditionGroups: [
      {
        operator: 'AND',
        conditions: [
          { field: 'source', operator: 'contains', value: 'smart-wallet-elite' },
          { field: 'score', operator: 'greater_than', value: 85 }
        ]
      }
    ],
    groupOperator: 'AND',
    suggestedActions: ['notify', 'telegram']
  },
  {
    id: 'low-risk-auto-trade',
    name: 'Low Risk Auto-Trade',
    description: 'Auto-trade LOW risk signals above 80',
    category: 'risk-filter',
    conditionGroups: [
      {
        operator: 'AND',
        conditions: [
          { field: 'riskLevel', operator: 'equals', value: 'LOW' },
          { field: 'score', operator: 'greater_or_equal', value: 80 }
        ]
      }
    ],
    groupOperator: 'AND',
    suggestedActions: ['auto_trade', 'notify']
  },
  {
    id: 'extreme-risk-warning',
    name: 'Extreme Risk Warning',
    description: 'Webhook to Discord for EXTREME risk warnings',
    category: 'risk-filter',
    conditionGroups: [
      {
        operator: 'AND',
        conditions: [
          { field: 'riskLevel', operator: 'equals', value: 'EXTREME' },
          { field: 'score', operator: 'greater_than', value: 70 }
        ]
      }
    ],
    groupOperator: 'AND',
    suggestedActions: ['webhook', 'discord']
  },
  {
    id: 'high-confluence',
    name: 'High Confluence Signal',
    description: 'Multiple sources confirm (3+)',
    category: 'custom',
    conditionGroups: [
      {
        operator: 'AND',
        conditions: [
          { field: 'sources_count', operator: 'greater_or_equal', value: 3 },
          { field: 'score', operator: 'greater_or_equal', value: 75 }
        ]
      }
    ],
    groupOperator: 'AND',
    suggestedActions: ['notify', 'auto_trade']
  },
  {
    id: 'volume-spike-alert',
    name: 'Volume Spike Alert',
    description: 'High volume with good score',
    category: 'volume',
    conditionGroups: [
      {
        operator: 'AND',
        conditions: [
          { field: 'volume5m', operator: 'greater_than', value: 50000 },
          { field: 'score', operator: 'greater_than', value: 65 }
        ]
      }
    ],
    groupOperator: 'AND',
    suggestedActions: ['notify']
  },
  {
    id: 'safe-play',
    name: 'Safe Play',
    description: 'High safety score + good signal',
    category: 'risk-filter',
    conditionGroups: [
      {
        operator: 'AND',
        conditions: [
          { field: 'safetyScore', operator: 'greater_or_equal', value: 70 },
          { field: 'score', operator: 'greater_or_equal', value: 75 },
          { field: 'riskLevel', operator: 'in', value: ['LOW', 'MEDIUM'] }
        ]
      }
    ],
    groupOperator: 'AND',
    suggestedActions: ['auto_trade', 'notify']
  },
  {
    id: 'ultra-conviction',
    name: 'Ultra Conviction',
    description: 'ULTRA conviction level signals only',
    category: 'smart-wallet',
    conditionGroups: [
      {
        operator: 'AND',
        conditions: [
          { field: 'convictionLevel', operator: 'equals', value: 'ULTRA' }
        ]
      }
    ],
    groupOperator: 'AND',
    suggestedActions: ['auto_trade', 'notify', 'telegram']
  }
];

// ==================== CONDITION EVALUATION ====================

/**
 * Get field value from signal
 */
function getFieldValue(signal: AggregatedSignal, field: ConditionField): any {
  switch (field) {
    case 'score':
      return signal.score;
    case 'riskLevel':
      return signal.riskLevel;
    case 'source':
      return signal.sources.map(s => s.source);
    case 'sources_count':
      return signal.confluence?.uniqueSources || signal.sources.length;
    case 'symbol':
      return signal.symbol;
    case 'mcap':
      return signal.marketData?.mcap || 0;
    case 'liquidity':
      return signal.marketData?.liquidity || 0;
    case 'volume5m':
      return signal.marketData?.volume5m || 0;
    case 'volume1h':
      return signal.marketData?.volume1h || 0;
    case 'priceChange5m':
      return signal.marketData?.priceChange5m || 0;
    case 'priceChange1h':
      return signal.marketData?.priceChange1h || 0;
    case 'age':
      return signal.marketData?.age || 0;
    case 'holders':
      return signal.marketData?.holders || 0;
    case 'convictionLevel':
      return signal.confluence?.convictionLevel || 'STANDARD';
    case 'safetyScore':
      return signal.safety?.safetyScore || 0;
    case 'hasNarrative':
      return (signal.analysis?.narrative?.length || 0) > 0;
    default:
      return null;
  }
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(signal: AggregatedSignal, condition: RuleCondition): boolean {
  const fieldValue = getFieldValue(signal, condition.field);
  const conditionValue = condition.value;
  
  switch (condition.operator) {
    case 'equals':
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(conditionValue);
      }
      return fieldValue === conditionValue;
      
    case 'not_equals':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(conditionValue);
      }
      return fieldValue !== conditionValue;
      
    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > (conditionValue as number);
      
    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < (conditionValue as number);
      
    case 'greater_or_equal':
      return typeof fieldValue === 'number' && fieldValue >= (conditionValue as number);
      
    case 'less_or_equal':
      return typeof fieldValue === 'number' && fieldValue <= (conditionValue as number);
      
    case 'contains':
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(v => 
          typeof v === 'string' && v.toLowerCase().includes((conditionValue as string).toLowerCase())
        );
      }
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes((conditionValue as string).toLowerCase());
      }
      return false;
      
    case 'not_contains':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some(v => 
          typeof v === 'string' && v.toLowerCase().includes((conditionValue as string).toLowerCase())
        );
      }
      if (typeof fieldValue === 'string') {
        return !fieldValue.toLowerCase().includes((conditionValue as string).toLowerCase());
      }
      return true;
      
    case 'in':
      if (Array.isArray(conditionValue)) {
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v => conditionValue.includes(v));
        }
        return conditionValue.includes(fieldValue);
      }
      return false;
      
    case 'not_in':
      if (Array.isArray(conditionValue)) {
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some(v => conditionValue.includes(v));
        }
        return !conditionValue.includes(fieldValue);
      }
      return true;
      
    default:
      return false;
  }
}

/**
 * Evaluate a condition group
 */
function evaluateConditionGroup(signal: AggregatedSignal, group: ConditionGroup): boolean {
  if (group.conditions.length === 0) return true;
  
  if (group.operator === 'AND') {
    return group.conditions.every(c => evaluateCondition(signal, c));
  } else {
    return group.conditions.some(c => evaluateCondition(signal, c));
  }
}

/**
 * Evaluate all condition groups for a rule
 */
function evaluateRule(signal: AggregatedSignal, rule: AlertRule): boolean {
  if (rule.conditionGroups.length === 0) return true;
  
  if (rule.groupOperator === 'AND') {
    return rule.conditionGroups.every(g => evaluateConditionGroup(signal, g));
  } else {
    return rule.conditionGroups.some(g => evaluateConditionGroup(signal, g));
  }
}

// ==================== ACTION EXECUTION ====================

/**
 * Execute a rule action
 */
async function executeAction(
  action: RuleAction, 
  signal: AggregatedSignal,
  rule: AlertRule
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'notify':
      case 'log':
        console.log(`[RULE:${rule.name}] TRIGGERED for $${signal.symbol} (Score: ${signal.score}, Risk: ${signal.riskLevel})`);
        return { success: true };
        
      case 'auto_trade':
        const copySettings = getAutoCopySettings();
        if (copySettings.enabled) {
          await processSignalForAutoCopy(signal);
          return { success: true };
        } else {
          return { success: false, error: 'Auto-copy is disabled' };
        }
        
      case 'webhook':
        const webhookConfig = action.config as WebhookActionConfig;
        if (webhookConfig.url) {
          const body = webhookConfig.body || {
            rule: rule.name,
            signal: {
              id: signal.id,
              symbol: signal.symbol,
              token: signal.token,
              score: signal.score,
              riskLevel: signal.riskLevel,
              timestamp: signal.timestamp
            }
          };
          
          const response = await fetch(webhookConfig.url, {
            method: webhookConfig.method || 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...webhookConfig.headers
            },
            body: JSON.stringify(body)
          });
          
          if (!response.ok) {
            return { success: false, error: `Webhook failed: ${response.status}` };
          }
          return { success: true };
        }
        return { success: false, error: 'No webhook URL configured' };
        
      case 'telegram':
        // Telegram notification (placeholder - integrate with telegram bot)
        const telegramConfig = action.config as TelegramActionConfig;
        console.log(`[RULE:${rule.name}] Would send Telegram: $${signal.symbol} to ${telegramConfig.chatId || 'default'}`);
        return { success: true };
        
      case 'discord':
        const discordConfig = action.config as DiscordActionConfig;
        if (discordConfig.webhookUrl) {
          const embed = {
            title: `🔮 ORACLE Alert: ${rule.name}`,
            description: discordConfig.message || `$${signal.symbol} triggered rule "${rule.name}"`,
            color: signal.riskLevel === 'LOW' ? 0x22c55e : signal.riskLevel === 'MEDIUM' ? 0xeab308 : 0xef4444,
            fields: [
              { name: 'Symbol', value: `$${signal.symbol}`, inline: true },
              { name: 'Score', value: signal.score.toString(), inline: true },
              { name: 'Risk', value: signal.riskLevel, inline: true },
              { name: 'Token', value: `\`${signal.token.slice(0, 20)}...\``, inline: false }
            ],
            timestamp: new Date().toISOString()
          };
          
          const payload = discordConfig.embed !== false 
            ? { embeds: [embed] }
            : { content: discordConfig.message || `$${signal.symbol} triggered "${rule.name}"` };
          
          const response = await fetch(discordConfig.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
            return { success: false, error: `Discord webhook failed: ${response.status}` };
          }
          return { success: true };
        }
        return { success: false, error: 'No Discord webhook URL configured' };
        
      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== RULE MANAGEMENT ====================

/**
 * Create a new rule
 */
export function createRule(
  name: string,
  conditionGroups: ConditionGroup[],
  actions: RuleAction[],
  options?: {
    description?: string;
    groupOperator?: 'AND' | 'OR';
    cooldownMinutes?: number;
    maxTriggersPerDay?: number;
    tags?: string[];
    enabled?: boolean;
  }
): AlertRule {
  const id = `rule_${crypto.randomBytes(8).toString('hex')}`;
  
  const rule: AlertRule = {
    id,
    name: name.trim(),
    description: options?.description,
    enabled: options?.enabled ?? true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    conditionGroups,
    groupOperator: options?.groupOperator || 'AND',
    actions,
    cooldownMinutes: options?.cooldownMinutes ?? 5,
    maxTriggersPerDay: options?.maxTriggersPerDay ?? 50,
    stats: {
      triggeredCount: 0,
      todayTriggers: 0
    },
    tags: options?.tags
  };
  
  rules.set(id, rule);
  console.log(`[RULES] Created rule: ${name} (${id})`);
  
  return rule;
}

/**
 * Create rule from template
 */
export function createRuleFromTemplate(
  templateId: string,
  name: string,
  actions: RuleAction[],
  options?: {
    description?: string;
    cooldownMinutes?: number;
    maxTriggersPerDay?: number;
    tags?: string[];
  }
): AlertRule | null {
  const template = RULE_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;
  
  return createRule(name, template.conditionGroups, actions, {
    ...options,
    groupOperator: template.groupOperator,
    description: options?.description || template.description
  });
}

/**
 * Get all rules
 */
export function getAllRules(): AlertRule[] {
  return Array.from(rules.values());
}

/**
 * Get enabled rules
 */
export function getEnabledRules(): AlertRule[] {
  return Array.from(rules.values()).filter(r => r.enabled);
}

/**
 * Get a specific rule
 */
export function getRule(id: string): AlertRule | undefined {
  return rules.get(id);
}

/**
 * Update a rule
 */
export function updateRule(
  id: string, 
  updates: Partial<Omit<AlertRule, 'id' | 'createdAt' | 'stats'>>
): AlertRule | null {
  const rule = rules.get(id);
  if (!rule) return null;
  
  Object.assign(rule, updates, { updatedAt: Date.now() });
  return rule;
}

/**
 * Delete a rule
 */
export function deleteRule(id: string): boolean {
  return rules.delete(id);
}

/**
 * Toggle rule enabled status
 */
export function toggleRule(id: string): boolean {
  const rule = rules.get(id);
  if (!rule) return false;
  
  rule.enabled = !rule.enabled;
  rule.updatedAt = Date.now();
  return rule.enabled;
}

/**
 * Duplicate a rule
 */
export function duplicateRule(id: string, newName?: string): AlertRule | null {
  const original = rules.get(id);
  if (!original) return null;
  
  return createRule(
    newName || `${original.name} (Copy)`,
    JSON.parse(JSON.stringify(original.conditionGroups)),
    JSON.parse(JSON.stringify(original.actions)),
    {
      description: original.description,
      groupOperator: original.groupOperator,
      cooldownMinutes: original.cooldownMinutes,
      maxTriggersPerDay: original.maxTriggersPerDay,
      tags: original.tags,
      enabled: false // Start disabled
    }
  );
}

// ==================== RULE PROCESSING ====================

/**
 * Reset daily triggers if new day
 */
function checkDailyReset(): void {
  const today = new Date().setHours(0, 0, 0, 0);
  
  if (today > lastDayReset) {
    for (const rule of rules.values()) {
      rule.stats.todayTriggers = 0;
    }
    lastDayReset = today;
  }
}

/**
 * Check if rule can trigger (cooldown + daily limit)
 */
function canRuleTrigger(rule: AlertRule): boolean {
  checkDailyReset();
  
  // Check daily limit
  if (rule.stats.todayTriggers >= rule.maxTriggersPerDay) {
    return false;
  }
  
  // Check cooldown
  if (rule.stats.lastTriggered) {
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    if (Date.now() - rule.stats.lastTriggered < cooldownMs) {
      return false;
    }
  }
  
  return true;
}

/**
 * Process a signal against all enabled rules
 */
export async function processSignalAgainstRules(signal: AggregatedSignal): Promise<RuleTriggerEvent[]> {
  const events: RuleTriggerEvent[] = [];
  
  for (const rule of getEnabledRules()) {
    // Check if rule can trigger
    if (!canRuleTrigger(rule)) continue;
    
    // Evaluate rule
    if (!evaluateRule(signal, rule)) continue;
    
    // Rule triggered! Execute actions
    const results: { action: string; success: boolean; error?: string }[] = [];
    const actionsExecuted: string[] = [];
    
    for (const action of rule.actions) {
      const result = await executeAction(action, signal, rule);
      results.push({ action: action.type, ...result });
      if (result.success) {
        actionsExecuted.push(action.type);
      }
    }
    
    // Update rule stats
    rule.stats.triggeredCount++;
    rule.stats.todayTriggers++;
    rule.stats.lastTriggered = Date.now();
    
    // Create trigger event
    const event: RuleTriggerEvent = {
      ruleId: rule.id,
      ruleName: rule.name,
      signalId: signal.id,
      token: signal.token,
      symbol: signal.symbol,
      timestamp: Date.now(),
      actionsExecuted,
      results
    };
    
    events.push(event);
    triggerHistory.unshift(event);
    
    // Notify callbacks
    triggerCallbacks.forEach(cb => cb(event, signal));
    
    console.log(`[RULES] Rule "${rule.name}" triggered for $${signal.symbol}`);
  }
  
  return events;
}

/**
 * Test a rule against a signal (without executing actions)
 */
export function testRule(rule: AlertRule, signal: AggregatedSignal): {
  matches: boolean;
  conditionResults: { group: number; result: boolean; conditions: { condition: RuleCondition; result: boolean }[] }[];
} {
  const conditionResults: { group: number; result: boolean; conditions: { condition: RuleCondition; result: boolean }[] }[] = [];
  
  for (let i = 0; i < rule.conditionGroups.length; i++) {
    const group = rule.conditionGroups[i];
    const conditions = group.conditions.map(c => ({
      condition: c,
      result: evaluateCondition(signal, c)
    }));
    
    conditionResults.push({
      group: i,
      result: evaluateConditionGroup(signal, group),
      conditions
    });
  }
  
  return {
    matches: evaluateRule(signal, rule),
    conditionResults
  };
}

/**
 * Get trigger history
 */
export function getTriggerHistory(limit = 50): RuleTriggerEvent[] {
  return triggerHistory.slice(0, limit);
}

/**
 * Get rule stats summary
 */
export function getRuleStats(): {
  totalRules: number;
  enabledRules: number;
  totalTriggers: number;
  todayTriggers: number;
  topRules: { id: string; name: string; triggers: number }[];
} {
  checkDailyReset();
  
  const allRules = getAllRules();
  let totalTriggers = 0;
  let todayTriggers = 0;
  
  const ruleStats = allRules.map(r => {
    totalTriggers += r.stats.triggeredCount;
    todayTriggers += r.stats.todayTriggers;
    return { id: r.id, name: r.name, triggers: r.stats.triggeredCount };
  });
  
  return {
    totalRules: allRules.length,
    enabledRules: allRules.filter(r => r.enabled).length,
    totalTriggers,
    todayTriggers,
    topRules: ruleStats.sort((a, b) => b.triggers - a.triggers).slice(0, 5)
  };
}

/**
 * Register callback for rule triggers
 */
export function onRuleTrigger(callback: RuleTriggerCallback): void {
  triggerCallbacks.push(callback);
}

/**
 * Get available templates
 */
export function getTemplates(): RuleTemplate[] {
  return RULE_TEMPLATES;
}

/**
 * Get template by ID
 */
export function getTemplate(id: string): RuleTemplate | undefined {
  return RULE_TEMPLATES.find(t => t.id === id);
}

/**
 * Validate rule configuration
 */
export function validateRule(rule: Partial<AlertRule>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!rule.name || rule.name.trim().length === 0) {
    errors.push('Rule name is required');
  }
  
  if (!rule.conditionGroups || rule.conditionGroups.length === 0) {
    errors.push('At least one condition group is required');
  } else {
    for (const group of rule.conditionGroups) {
      if (!group.conditions || group.conditions.length === 0) {
        errors.push('Each condition group must have at least one condition');
      }
    }
  }
  
  if (!rule.actions || rule.actions.length === 0) {
    errors.push('At least one action is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Export rules to JSON
 */
export function exportRules(): string {
  const allRules = getAllRules().map(r => ({
    ...r,
    stats: { triggeredCount: 0, todayTriggers: 0 } // Reset stats on export
  }));
  return JSON.stringify(allRules, null, 2);
}

/**
 * Import rules from JSON
 */
export function importRules(json: string): { imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;
  
  try {
    const data = JSON.parse(json);
    
    if (!Array.isArray(data)) {
      return { imported: 0, errors: ['Invalid format: expected array'] };
    }
    
    for (const ruleData of data) {
      const validation = validateRule(ruleData);
      if (!validation.valid) {
        errors.push(`Rule "${ruleData.name || 'unknown'}": ${validation.errors.join(', ')}`);
        continue;
      }
      
      createRule(
        ruleData.name,
        ruleData.conditionGroups,
        ruleData.actions,
        {
          description: ruleData.description,
          groupOperator: ruleData.groupOperator,
          cooldownMinutes: ruleData.cooldownMinutes,
          maxTriggersPerDay: ruleData.maxTriggersPerDay,
          tags: ruleData.tags,
          enabled: ruleData.enabled
        }
      );
      imported++;
    }
  } catch (e) {
    errors.push(`Parse error: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
  
  return { imported, errors };
}
