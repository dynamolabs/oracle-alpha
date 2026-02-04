/**
 * AI Module - Signal Analysis & Explanation
 */

export {
  generateExplanation,
  formatExplanationText,
  formatExplanationHtml,
  DetailedExplanation,
  SourceExplanation,
  MarketContextExplanation,
  RiskFactor
} from './explainer';

export {
  predictPrice,
  recordPrice,
  recordPrediction,
  resolvePendictions,
  getGlobalAccuracy,
  formatPrediction,
  getPredictionBadge,
  PricePrediction,
  PredictionDirection,
  PredictionFactor,
  TechnicalIndicators,
  SocialMomentum,
  TimeHorizon
} from './price-predictor';
