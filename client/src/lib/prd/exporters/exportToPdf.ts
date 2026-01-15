import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AssembledProjectPRD, WorkflowCanvasData, WorkflowIntentData } from '../assembleProjectPRD';
import type { Node, Edge } from '../../kiteframe/types';

function getNodeTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    'input': 'Input',
    'process': 'Process',
    'condition': 'Decision',
    'output': 'Output',
    'ai': 'AI',
    'experiment': 'Experiment',
    'image': 'Image',
    'form': 'Form',
    'table': 'Table',
    'code': 'Code',
    'webview': 'Webview',
    'compound': 'Compound',
    'shape': 'Shape',
    'text': 'Text'
  };
  return typeLabels[type] || type;
}

function buildFlowPath(nodes: Node[], edges: Edge[]): string[] {
  if (nodes.length === 0) return [];
  
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const outgoingEdges = new Map<string, Edge[]>();
  const incomingCount = new Map<string, number>();
  
  nodes.forEach(n => {
    outgoingEdges.set(n.id, []);
    incomingCount.set(n.id, 0);
  });
  
  edges.forEach(e => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      outgoingEdges.get(e.source)?.push(e);
      incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
    }
  });
  
  const entryNodes = nodes.filter(n => (incomingCount.get(n.id) || 0) === 0);
  if (entryNodes.length === 0 && nodes.length > 0) {
    entryNodes.push(nodes[0]);
  }
  
  const paths: string[] = [];
  const MAX_PATHS = 5;
  const MAX_DEPTH = 30;
  
  function traverse(nodeId: string, path: string[], visited: Set<string>, depth: number): void {
    if (paths.length >= MAX_PATHS) return;
    if (depth > MAX_DEPTH) return;
    if (visited.has(nodeId)) {
      if (path.length > 0) {
        paths.push(path.join(' → ') + ' → (cycle)');
      }
      return;
    }
    
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    const localVisited = new Set(visited);
    localVisited.add(nodeId);
    
    const label = node.data?.label || getNodeTypeLabel(node.type || 'process');
    const newPath = [...path, label];
    
    const outEdges = outgoingEdges.get(nodeId) || [];
    if (outEdges.length === 0) {
      paths.push(newPath.join(' → '));
    } else {
      outEdges.forEach(edge => {
        const edgeLabel = edge.label ? ` [${edge.label}]` : '';
        const pathWithLabel = [...newPath];
        if (edgeLabel) {
          pathWithLabel[pathWithLabel.length - 1] += edgeLabel;
        }
        traverse(edge.target, pathWithLabel, localVisited, depth + 1);
      });
    }
  }
  
  entryNodes.forEach(entry => traverse(entry.id, [], new Set(), 0));
  
  return paths;
}

export function exportToPdf(assembled: AssembledProjectPRD): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  const colors = {
    primary: [41, 128, 185] as [number, number, number],
    secondary: [52, 73, 94] as [number, number, number],
    accent: [46, 204, 113] as [number, number, number],
    muted: [127, 140, 141] as [number, number, number],
    light: [236, 240, 241] as [number, number, number]
  };

  function addNewPageIfNeeded(requiredSpace: number = 30): void {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  }

  function addTitle(text: string): void {
    addNewPageIfNeeded(20);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    doc.text(text, margin, yPosition);
    yPosition += 12;
  }

  function addHeading(text: string, level: number = 1): void {
    addNewPageIfNeeded(15);
    const fontSize = level === 1 ? 18 : level === 2 ? 14 : 12;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.secondary);
    doc.text(text, margin, yPosition);
    yPosition += fontSize * 0.5 + 4;
  }

  function addParagraph(text: string): void {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      addNewPageIfNeeded(6);
      doc.text(line, margin, yPosition);
      yPosition += 5;
    }
    yPosition += 3;
  }

  function addQuote(text: string): void {
    addNewPageIfNeeded(15);
    doc.setFillColor(...colors.light);
    const lines = doc.splitTextToSize(text, contentWidth - 10);
    const blockHeight = lines.length * 5 + 6;
    doc.rect(margin, yPosition - 4, contentWidth, blockHeight, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...colors.muted);
    for (const line of lines) {
      doc.text(line, margin + 5, yPosition);
      yPosition += 5;
    }
    yPosition += 5;
  }

  function addSeparator(): void {
    addNewPageIfNeeded(10);
    doc.setDrawColor(...colors.light);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
  }

  addTitle(assembled.project.name);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.muted);
  doc.text(`Generated: ${new Date(assembled.generatedAt).toLocaleDateString()}`, margin, yPosition);
  yPosition += 10;

  if (assembled.project.description) {
    addHeading('Project Description', 1);
    addParagraph(assembled.project.description);
    addSeparator();
  }

  if (assembled.projectPRD && assembled.projectPRD.sections.length > 0) {
    addHeading('Project Documentation', 1);
    
    for (const section of assembled.projectPRD.sections) {
      if (section.content) {
        addHeading(section.title, 2);
        addParagraph(section.content);
      }
    }
    addSeparator();
  }

  if (assembled.workflows.length > 0) {
    addHeading('Workflows', 1);
    addParagraph(`${assembled.workflows.length} workflow(s) included in this export`);
    yPosition += 3;
    
    for (const workflow of assembled.workflows) {
      addNewPageIfNeeded(40);
      addHeading(workflow.workflowName, 2);
      
      if (workflow.semanticSummary) {
        addQuote(workflow.semanticSummary);
      }

      if (workflow.intent && (workflow.intent.primaryGoal || workflow.intent.userType || workflow.intent.successSignal)) {
        addHeading('Workflow Intent', 3);
        
        const intentData: (string | string[])[][] = [];
        if (workflow.intent.primaryGoal) {
          intentData.push(['Primary Goal', workflow.intent.primaryGoal]);
        }
        if (workflow.intent.userType) {
          intentData.push(['Target User', workflow.intent.userType]);
        }
        if (workflow.intent.successSignal) {
          intentData.push(['Success Signal', workflow.intent.successSignal]);
        }
        if (workflow.intent.failureModes && workflow.intent.failureModes.length > 0) {
          intentData.push(['Failure Modes', workflow.intent.failureModes.join('; ')]);
        }
        const maturityLabels: Record<string, string> = { 'draft': 'Draft', 'reviewed': 'Reviewed', 'stable': 'Stable' };
        intentData.push(['Maturity', maturityLabels[workflow.intent.maturity] || workflow.intent.maturity]);
        intentData.push(['Confirmed', workflow.intent.confirmed ? 'Yes' : 'No']);
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Aspect', 'Details']],
          body: intentData,
          margin: { left: margin, right: margin },
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: colors.primary, textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 8;
      }

      if (workflow.canvas && workflow.canvas.nodes.length > 0) {
        const { nodes, edges } = workflow.canvas;
        
        addHeading('Workflow Structure', 3);
        
        const stepCount = nodes.length;
        const connectionCount = edges.length;
        const decisionCount = nodes.filter(n => n.type === 'condition').length;
        
        const incomingCount = new Map<string, number>();
        const outgoingCount = new Map<string, number>();
        nodes.forEach(n => {
          incomingCount.set(n.id, 0);
          outgoingCount.set(n.id, 0);
        });
        edges.forEach(e => {
          if (incomingCount.has(e.target)) {
            incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
          }
          if (outgoingCount.has(e.source)) {
            outgoingCount.set(e.source, (outgoingCount.get(e.source) || 0) + 1);
          }
        });
        
        const entryPoints = nodes.filter(n => (incomingCount.get(n.id) || 0) === 0);
        const exitPoints = nodes.filter(n => (outgoingCount.get(n.id) || 0) === 0);
        
        const structureData: string[][] = [
          ['Total Steps', String(stepCount)],
          ['Connections', String(connectionCount)],
        ];
        if (decisionCount > 0) structureData.push(['Decision Points', String(decisionCount)]);
        if (entryPoints.length > 0) structureData.push(['Entry Points', entryPoints.map(n => n.data?.label || 'Start').join(', ')]);
        if (exitPoints.length > 0) structureData.push(['Exit Points', exitPoints.map(n => n.data?.label || 'End').join(', ')]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Metric', 'Value']],
          body: structureData,
          margin: { left: margin, right: margin },
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: colors.secondary, textColor: [255, 255, 255] },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 8;

        const flowPaths = buildFlowPath(nodes, edges);
        if (flowPaths.length > 0) {
          addHeading('Flow Paths', 3);
          for (let i = 0; i < flowPaths.length; i++) {
            addNewPageIfNeeded(8);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            const pathText = flowPaths.length > 1 ? `Path ${i + 1}: ${flowPaths[i]}` : flowPaths[i];
            const pathLines = doc.splitTextToSize(pathText, contentWidth);
            for (const line of pathLines) {
              addNewPageIfNeeded(5);
              doc.text(line, margin, yPosition);
              yPosition += 4.5;
            }
            yPosition += 2;
          }
          yPosition += 3;
        }

        addHeading('Steps', 3);
        const nodeTableData = nodes.map(node => [
          node.data?.label || 'Untitled',
          getNodeTypeLabel(node.type || 'process'),
          (node.data?.description || '—').substring(0, 60) + ((node.data?.description?.length || 0) > 60 ? '...' : ''),
          node.data?.status === 'done' ? 'Done' : node.data?.status === 'inprogress' ? 'In Progress' : 'To-do'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Step', 'Type', 'Description', 'Status']],
          body: nodeTableData,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: colors.primary, textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: { 
            0: { cellWidth: 35 },
            1: { cellWidth: 25 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 22 }
          }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 8;

        if (edges.length > 0) {
          addHeading('Connections', 3);
          const nodeMap = new Map(nodes.map(n => [n.id, n]));
          const edgeTableData = edges.map(edge => [
            nodeMap.get(edge.source)?.data?.label || 'Node',
            nodeMap.get(edge.target)?.data?.label || 'Node',
            edge.label || '—'
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['From', 'To', 'Label']],
            body: edgeTableData,
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: colors.secondary, textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [245, 247, 250] }
          });
          yPosition = (doc as any).lastAutoTable.finalY + 8;
        }
      }

      if (workflow.prdSections.length > 0) {
        const sectionsWithContent = workflow.prdSections.filter(s => s.content);
        if (sectionsWithContent.length > 0) {
          addHeading('PRD Details', 3);
          
          for (const section of sectionsWithContent) {
            addNewPageIfNeeded(20);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.secondary);
            doc.text(section.title, margin, yPosition);
            yPosition += 6;
            
            addParagraph(section.content);
          }
        }
      }
      
      addSeparator();
    }
  }

  addHeading('Success Metrics', 2);
  const metrics = [
    'Adoption: TBD (e.g. % of projects using the feature)',
    'Efficiency: TBD (e.g. reduced clarification time)',
    'Quality: TBD (e.g. fewer unresolved questions)',
    'Satisfaction: TBD (qualitative feedback)'
  ];
  for (const metric of metrics) {
    addNewPageIfNeeded(6);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`• ${metric}`, margin + 3, yPosition);
    yPosition += 5;
  }
  yPosition += 5;

  addSeparator();
  addHeading('Definition of Done', 2);
  const dod = [
    'Feature works end-to-end for at least one workflow',
    'Collaboration scenarios validated',
    'Empty states and basic accessibility covered',
    'Exported artifacts reflect final behavior'
  ];
  for (const item of dod) {
    addNewPageIfNeeded(6);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`• ${item}`, margin + 3, yPosition);
    yPosition += 5;
  }
  yPosition += 8;

  addNewPageIfNeeded(15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...colors.muted);
  doc.text(`Exported from Kiteframe v${assembled.version}`, margin, yPosition);

  return doc.output('blob');
}

export function downloadPdf(assembled: AssembledProjectPRD): void {
  const blob = exportToPdf(assembled);
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-prd.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
