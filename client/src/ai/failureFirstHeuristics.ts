import type { Node, Edge } from '../lib/kiteframe/types';
import { createInsight, type AIInsight } from './insights';

export interface FailureAnalysisResult {
  hasFailurePath: boolean;
  singleEdgeConditions: string[];
  terminalsWithoutErrorAlternative: string[];
  insights: AIInsight[];
}

export function analyzeWorkflowForFailures(
  workflowId: string,
  nodes: Node[],
  edges: Edge[]
): FailureAnalysisResult {
  const insights: AIInsight[] = [];
  const singleEdgeConditions: string[] = [];
  const terminalsWithoutErrorAlternative: string[] = [];
  
  const edgesBySource = new Map<string, Edge[]>();
  const edgesByTarget = new Map<string, Edge[]>();
  
  edges.forEach(edge => {
    const sourceEdges = edgesBySource.get(edge.source) || [];
    sourceEdges.push(edge);
    edgesBySource.set(edge.source, sourceEdges);
    
    const targetEdges = edgesByTarget.get(edge.target) || [];
    targetEdges.push(edge);
    edgesByTarget.set(edge.target, targetEdges);
  });
  
  let hasFailurePath = false;
  const errorIndicators = ['error', 'fail', 'invalid', 'reject', 'exception', 'retry', 'fallback', 'cancel', 'abort'];
  
  edges.forEach(edge => {
    const label = (edge.label || '').toLowerCase();
    if (errorIndicators.some(indicator => label.includes(indicator))) {
      hasFailurePath = true;
    }
  });
  
  nodes.forEach(node => {
    const nodeType = (node.type || '').toLowerCase();
    const nodeLabel = (node.data?.label || '').toLowerCase();
    
    if (errorIndicators.some(indicator => nodeLabel.includes(indicator) || nodeType.includes(indicator))) {
      hasFailurePath = true;
    }
    
    if (nodeType === 'output' && (nodeLabel.includes('error') || nodeLabel.includes('fail'))) {
      hasFailurePath = true;
    }
  });
  
  nodes.forEach(node => {
    if (node.type === 'condition') {
      const outgoingEdges = edgesBySource.get(node.id) || [];
      if (outgoingEdges.length === 1) {
        singleEdgeConditions.push(node.id);
        const nodeLabel = node.data?.label || 'Condition';
        insights.push(createInsight({
          level: 'warning',
          chipType: 'risk',
          message: `"${nodeLabel}" has only one path - conditions should branch`,
          targetType: 'node',
          targetId: node.id,
          source: 'heuristic',
        }));
      }
    }
  });
  
  const terminalNodes = nodes.filter(node => {
    const outgoingEdges = edgesBySource.get(node.id) || [];
    return outgoingEdges.length === 0;
  });
  
  const outputNodes = terminalNodes.filter(node => 
    node.type === 'output' || 
    (node.data?.label || '').toLowerCase().includes('output') ||
    (node.data?.label || '').toLowerCase().includes('result') ||
    (node.data?.label || '').toLowerCase().includes('complete') ||
    (node.data?.label || '').toLowerCase().includes('success')
  );
  
  outputNodes.forEach(outputNode => {
    const nodeLabel = (outputNode.data?.label || '').toLowerCase();
    const isAlreadyError = errorIndicators.some(indicator => nodeLabel.includes(indicator));
    
    if (!isAlreadyError) {
      const incomingEdges = edgesByTarget.get(outputNode.id) || [];
      const parentNodes = incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean) as Node[];
      
      const hasErrorSibling = parentNodes.some(parentNode => {
        const siblingEdges = edgesBySource.get(parentNode.id) || [];
        return siblingEdges.some(se => {
          const siblingNode = nodes.find(n => n.id === se.target);
          const siblingLabel = (siblingNode?.data?.label || '').toLowerCase();
          return errorIndicators.some(indicator => siblingLabel.includes(indicator));
        });
      });
      
      if (!hasErrorSibling && parentNodes.length > 0) {
        terminalsWithoutErrorAlternative.push(outputNode.id);
        const label = outputNode.data?.label || 'Output';
        insights.push(createInsight({
          level: 'warning',
          chipType: 'suggestion',
          message: `"${label}" has no error alternative - consider adding a failure path`,
          targetType: 'node',
          targetId: outputNode.id,
          source: 'heuristic',
        }));
      }
    }
  });
  
  if (!hasFailurePath && nodes.length > 2) {
    insights.push(createInsight({
      level: 'risk',
      chipType: 'risk',
      message: 'Workflow has no failure path - add at least one error handling node',
      targetType: 'workflow',
      targetId: workflowId,
      source: 'heuristic',
    }));
  }
  
  return {
    hasFailurePath,
    singleEdgeConditions,
    terminalsWithoutErrorAlternative,
    insights,
  };
}

export function getFailureFirstWarnings(
  workflowId: string,
  nodes: Node[],
  edges: Edge[]
): string[] {
  const warnings: string[] = [];
  const result = analyzeWorkflowForFailures(workflowId, nodes, edges);
  
  if (!result.hasFailurePath && nodes.length > 2) {
    warnings.push('This workflow has no failure handling. Consider adding error paths.');
  }
  
  result.singleEdgeConditions.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    const label = node?.data?.label || 'A condition node';
    warnings.push(`${label} only has one outgoing path. Conditions should branch.`);
  });
  
  result.terminalsWithoutErrorAlternative.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    const label = node?.data?.label || 'An output node';
    warnings.push(`${label} has no error alternative path.`);
  });
  
  return warnings;
}

export function generateFailureAnalysisSummary(
  nodes: Node[],
  edges: Edge[]
): string {
  const conditionNodes = nodes.filter(n => n.type === 'condition');
  const outputNodes = nodes.filter(n => n.type === 'output');
  
  const edgesBySource = new Map<string, Edge[]>();
  edges.forEach(edge => {
    const sourceEdges = edgesBySource.get(edge.source) || [];
    sourceEdges.push(edge);
    edgesBySource.set(edge.source, sourceEdges);
  });
  
  const branchingConditions = conditionNodes.filter(n => 
    (edgesBySource.get(n.id) || []).length >= 2
  ).length;
  
  const errorIndicators = ['error', 'fail', 'invalid', 'reject', 'exception', 'retry', 'fallback'];
  const errorOutputs = outputNodes.filter(n => 
    errorIndicators.some(ind => (n.data?.label || '').toLowerCase().includes(ind))
  ).length;
  
  return `Failure Analysis: ${branchingConditions}/${conditionNodes.length} conditions branch properly, ${errorOutputs}/${outputNodes.length} outputs handle errors.`;
}
