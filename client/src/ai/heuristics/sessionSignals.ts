export interface ProposalSignal {
  insightId: string;
  timestamp: number;
  action: 'accepted' | 'canceled';
  variantChosen?: 'proposed' | 'alternative';
  undoneImmediately?: boolean;
}

export interface ExperimentSignal {
  insightId: string;
  experimentId: string;
  timestamp: number;
  action: 'accepted' | 'discarded';
  undoneImmediately?: boolean;
}

export interface SessionSignals {
  acceptedProposals: ProposalSignal[];
  canceledProposals: ProposalSignal[];
  alternativeChosenCount: number;
  proposedChosenCount: number;
  acceptedExperiments: ExperimentSignal[];
  discardedExperiments: ExperimentSignal[];
  immediateUndoCount: number;
}

let sessionSignals: SessionSignals = {
  acceptedProposals: [],
  canceledProposals: [],
  alternativeChosenCount: 0,
  proposedChosenCount: 0,
  acceptedExperiments: [],
  discardedExperiments: [],
  immediateUndoCount: 0,
};

let lastAcceptTimestamp = 0;
const IMMEDIATE_UNDO_THRESHOLD_MS = 5000;

export function getSessionSignals(): Readonly<SessionSignals> {
  return { ...sessionSignals };
}

export function resetSessionSignals(): void {
  sessionSignals = {
    acceptedProposals: [],
    canceledProposals: [],
    alternativeChosenCount: 0,
    proposedChosenCount: 0,
    acceptedExperiments: [],
    discardedExperiments: [],
    immediateUndoCount: 0,
  };
  lastAcceptTimestamp = 0;
}

export function recordProposalAccepted(
  insightId: string,
  variantChosen: 'proposed' | 'alternative'
): void {
  const signal: ProposalSignal = {
    insightId,
    timestamp: Date.now(),
    action: 'accepted',
    variantChosen,
  };
  
  sessionSignals.acceptedProposals.push(signal);
  lastAcceptTimestamp = signal.timestamp;
  
  if (variantChosen === 'alternative') {
    sessionSignals.alternativeChosenCount++;
  } else {
    sessionSignals.proposedChosenCount++;
  }
}

export function recordProposalCanceled(insightId: string): void {
  sessionSignals.canceledProposals.push({
    insightId,
    timestamp: Date.now(),
    action: 'canceled',
  });
}

export function recordExperimentAccepted(
  insightId: string,
  experimentId: string
): void {
  const signal: ExperimentSignal = {
    insightId,
    experimentId,
    timestamp: Date.now(),
    action: 'accepted',
  };
  
  sessionSignals.acceptedExperiments.push(signal);
  lastAcceptTimestamp = signal.timestamp;
}

export function recordExperimentDiscarded(
  insightId: string,
  experimentId: string
): void {
  sessionSignals.discardedExperiments.push({
    insightId,
    experimentId,
    timestamp: Date.now(),
    action: 'discarded',
  });
}

export function recordUndo(): void {
  const now = Date.now();
  const timeSinceLastAccept = now - lastAcceptTimestamp;
  
  if (lastAcceptTimestamp > 0 && timeSinceLastAccept <= IMMEDIATE_UNDO_THRESHOLD_MS) {
    sessionSignals.immediateUndoCount++;
    
    const lastProposal = sessionSignals.acceptedProposals[sessionSignals.acceptedProposals.length - 1];
    if (lastProposal && lastProposal.timestamp === lastAcceptTimestamp) {
      lastProposal.undoneImmediately = true;
    }
    
    const lastExperiment = sessionSignals.acceptedExperiments[sessionSignals.acceptedExperiments.length - 1];
    if (lastExperiment && lastExperiment.timestamp === lastAcceptTimestamp) {
      lastExperiment.undoneImmediately = true;
    }
  }
}

export function getHeuristicBias(): {
  preferAlternative: boolean;
  reduceScope: boolean;
  increaseValidation: boolean;
} {
  const total = sessionSignals.proposedChosenCount + sessionSignals.alternativeChosenCount;
  const preferAlternative = total >= 3 && sessionSignals.alternativeChosenCount > sessionSignals.proposedChosenCount;
  
  const cancelRate = sessionSignals.canceledProposals.length / 
    Math.max(1, sessionSignals.acceptedProposals.length + sessionSignals.canceledProposals.length);
  const reduceScope = cancelRate > 0.5 || sessionSignals.immediateUndoCount >= 2;
  
  const undoRate = sessionSignals.immediateUndoCount / 
    Math.max(1, sessionSignals.acceptedProposals.length + sessionSignals.acceptedExperiments.length);
  const increaseValidation = undoRate > 0.3;
  
  return {
    preferAlternative,
    reduceScope,
    increaseValidation,
  };
}
