import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AssembledProjectPRD, WorkflowIntentData } from '../assembleProjectPRD';

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
    light: [236, 240, 241] as [number, number, number],
    link: [52, 152, 219] as [number, number, number]
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

  function addLink(label: string, url: string): void {
    addNewPageIfNeeded(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${label}: `, margin, yPosition);
    
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.link);
    doc.textWithLink(url, margin + labelWidth, yPosition, { url });
    yPosition += 7;
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
      
      if (workflow.shareUrl) {
        addLink('View Workflow', workflow.shareUrl);
      }
      
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
