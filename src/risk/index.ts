/**
 * Risk Calculator Module
 * 
 * Smart position sizing based on:
 * - Kelly Criterion
 * - Risk-adjusted sizing
 * - Volatility-based stop loss
 * - Take profit targets
 */

export {
  calculateRisk,
  formatRiskCalculation,
  quickPositionSize,
  calculateKellyCriterion,
  estimateWinProbability,
  POSITION_RULES,
  type RiskCalculationInput,
  type RiskCalculationResult,
  type StopLossLevel,
  type TakeProfitLevel
} from './calculator';
