export { 
  detectInsightPattern, 
  getGenerationBias, 
  getPatternGuidance,
  getNodeCountConstraints,
  type InsightPattern,
  type GenerationBias,
} from './insightPatterns';

export {
  calibrateProposalScope,
  getScopeGuidance,
  type ScopeConstraints,
} from './scopeCalibration';

export {
  selectExperimentDimensions,
  getExperimentDiversityGuidance,
  validateExperimentDiversity,
  type RiskDimension,
  type ExperimentDiversityConfig,
} from './experimentDiversity';

export {
  validateProposalOutput,
  validateExperimentOutput,
  sanitizeOutput,
  type ValidationResult,
} from './outputValidation';

export {
  getSessionSignals,
  resetSessionSignals,
  recordProposalAccepted,
  recordProposalCanceled,
  recordExperimentAccepted,
  recordExperimentDiscarded,
  recordUndo,
  getHeuristicBias,
  type ProposalSignal,
  type ExperimentSignal,
  type SessionSignals,
} from './sessionSignals';

export { ENABLE_PHASE_4_HEURISTICS } from './config';
