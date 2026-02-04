/**
 * Discovery Module
 * 
 * Token discovery and similarity search features
 */

export * from './token-similarity';

// Re-export main functions for convenience
export {
  findSimilarTokens,
  getSimilarityFactors,
  getTrendingSimilarGroups,
  getTokensByNarrative,
  buildProfileFromSignal,
  calculateSimilarity,
  clearSimilarityCache,
  getCacheStats,
  DEFAULT_WEIGHTS,
  NARRATIVES
} from './token-similarity';
