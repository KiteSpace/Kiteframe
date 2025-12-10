/**
 * Figma Semantic Extractor
 * 
 * Extracts semantic metadata from Figma frame node trees.
 * Uses heuristics to identify UI elements like headings, buttons, inputs, and sections.
 * 
 * NOT used for visual reconstruction - only for AI workflow generation and analysis.
 */

import type {
  FigmaSemanticMetadata,
  FigmaSemanticElement,
  FigmaSemanticElementType,
  FigmaSemanticFormCandidate,
  FigmaSemanticNavigationTarget,
  FigmaSemanticBounds,
} from './figmaSemanticTypes';

// Extraction limits to prevent performance issues on large files
const MAX_DEPTH = 10;
const MAX_ELEMENTS = 500;

// Loose type for Figma nodes - avoid over-fitting to specific Figma API versions
type FigmaNode = any;

/**
 * Extract semantic metadata from a Figma frame node tree.
 */
export function extractFigmaSemanticMetadata(
  frameNode: FigmaNode,
  pageName: string
): FigmaSemanticMetadata {
  const elements: FigmaSemanticElement[] = [];
  const navigationTargets: FigmaSemanticNavigationTarget[] = [];
  
  let elementCount = 0;
  let truncated = false;
  let truncationReason: string | undefined;

  const frameId = frameNode.id;
  const frameName = frameNode.name || 'Untitled Frame';
  const box = frameNode.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 };

  /**
   * Recursive node tree traversal with depth and element limits.
   */
  function walk(node: FigmaNode, parentId: string | null, depth: number): void {
    // Check limits
    if (depth > MAX_DEPTH) {
      if (!truncated) {
        truncated = true;
        truncationReason = `Max depth (${MAX_DEPTH}) exceeded`;
      }
      return;
    }
    
    if (elementCount >= MAX_ELEMENTS) {
      if (!truncated) {
        truncated = true;
        truncationReason = `Max elements (${MAX_ELEMENTS}) exceeded`;
      }
      return;
    }

    const nodeType: string = node.type || '';
    const nodeName: string = node.name || '';
    const bounds = node.absoluteBoundingBox;
    const children: FigmaNode[] = node.children || [];

    let element: FigmaSemanticElement | null = null;

    // TEXT nodes
    if (nodeType === 'TEXT') {
      const characters: string = node.characters || '';
      const type = classifyTextElement(node, characters);
      
      element = createSemanticElement(node.id, type, nodeName || characters.slice(0, 64), nodeType, bounds, parentId);
      element.text = characters;
    }
    // Button-like elements
    else if (isButtonLike(node, nodeName, children)) {
      element = createSemanticElement(node.id, 'button', nodeName || 'Button', nodeType, bounds, parentId);
      element.isPrimaryAction = isPrimaryButton(node, nodeName);
      
      // Extract text from child TEXT nodes for button label
      const buttonText = extractTextFromChildren(children);
      if (buttonText) {
        element.text = buttonText;
      }
      
      navigationTargets.push({
        elementId: node.id,
        label: buttonText || nodeName || 'Button',
        inferredTargetName: inferNavigationTarget(nodeName, buttonText),
      });
    }
    // Input-like elements
    else if (isInputLike(node, nodeName)) {
      element = createSemanticElement(node.id, 'input', nodeName || 'Input', nodeType, bounds, parentId);
      element.isRequiredField = isRequiredField(nodeName);
    }
    // Link-like elements
    else if (isLinkLike(node, nodeName)) {
      element = createSemanticElement(node.id, 'link', nodeName || 'Link', nodeType, bounds, parentId);
      
      const linkText = extractTextFromChildren(children) || nodeName;
      element.text = linkText;
      
      navigationTargets.push({
        elementId: node.id,
        label: linkText || 'Link',
        inferredTargetName: inferNavigationTarget(nodeName, linkText),
      });
    }
    // Checkbox/Radio elements
    else if (isCheckboxLike(nodeName)) {
      element = createSemanticElement(node.id, 'checkbox', nodeName, nodeType, bounds, parentId);
    }
    else if (isRadioLike(nodeName)) {
      element = createSemanticElement(node.id, 'radio', nodeName, nodeType, bounds, parentId);
    }
    // Icon elements
    else if (isIconLike(node, nodeName)) {
      element = createSemanticElement(node.id, 'icon', nodeName, nodeType, bounds, parentId);
    }
    // Section/Container elements
    else if (isSectionLike(node, nodeName, nodeType)) {
      element = createSemanticElement(node.id, 'section', nodeName, nodeType, bounds, parentId);
    }
    // Image elements (not the frame thumbnail, but images within)
    else if (nodeType === 'RECTANGLE' && hasImageFill(node)) {
      element = createSemanticElement(node.id, 'image', nodeName || 'Image', nodeType, bounds, parentId);
    }

    if (element) {
      element.childrenIds = children.map((c: FigmaNode) => c.id);
      elements.push(element);
      elementCount++;
    }

    // Recurse into children
    for (const child of children) {
      walk(child, node.id, depth + 1);
    }
  }

  // Start traversal
  walk(frameNode, null, 0);

  // Build form candidates from detected inputs and buttons
  const forms = buildFormCandidates(elements, frameId, frameName);

  return {
    frameId,
    frameName,
    pageName,
    size: {
      width: box.width || 0,
      height: box.height || 0,
    },
    elements,
    forms,
    navigationTargets,
    extractedAt: new Date().toISOString(),
    truncated: truncated || undefined,
    truncationReason,
  };
}

// ============ HELPER FUNCTIONS ============

function createSemanticElement(
  id: string,
  type: FigmaSemanticElementType,
  name: string,
  figmaNodeType: string,
  bounds: any,
  parentId: string | null
): FigmaSemanticElement {
  return {
    id,
    type,
    name,
    figmaNodeType,
    bounds: bounds
      ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      : { x: 0, y: 0, width: 0, height: 0 },
    parentId: parentId ?? undefined,
    childrenIds: [],
  };
}

function classifyTextElement(node: FigmaNode, text: string): FigmaSemanticElementType {
  const style = node.style || {};
  const fontSize = style.fontSize || 0;
  const fontWeight = style.fontWeight || 400;
  const trimmed = text.trim();
  
  // Heading heuristics: large font, bold, or all caps
  if (fontSize >= 20 || fontWeight >= 600) {
    return 'heading';
  }
  
  // Short uppercase text often indicates headings
  if (trimmed.length < 50 && trimmed === trimmed.toUpperCase() && trimmed.length > 2) {
    return 'heading';
  }
  
  // Label heuristics: short text ending with colon or near input fields
  if (trimmed.length < 30 && trimmed.endsWith(':')) {
    return 'label';
  }
  
  return 'text';
}

function isButtonLike(node: FigmaNode, name: string, children: FigmaNode[]): boolean {
  const type = node.type || '';
  const containerTypes = ['RECTANGLE', 'FRAME', 'COMPONENT', 'INSTANCE', 'GROUP'];
  
  if (!containerTypes.includes(type)) return false;
  
  const lname = name.toLowerCase();
  
  // Name-based detection
  if (lname.includes('button') || lname.includes('btn') || lname.includes('cta')) {
    return true;
  }
  
  // Component/Instance with button-like properties
  if ((type === 'COMPONENT' || type === 'INSTANCE') && node.componentProperties) {
    const propKeys = Object.keys(node.componentProperties).join(' ').toLowerCase();
    if (propKeys.includes('button') || propKeys.includes('variant')) {
      return true;
    }
  }
  
  // Structure-based: container with single TEXT child and rounded corners
  if (children.length === 1 && children[0].type === 'TEXT') {
    const cornerRadius = node.cornerRadius || 0;
    const fills = node.fills || [];
    const hasFill = fills.some((f: any) => f.type === 'SOLID' && f.visible !== false);
    
    if (cornerRadius > 0 && hasFill) {
      return true;
    }
  }
  
  return false;
}

function isPrimaryButton(node: FigmaNode, name: string): boolean {
  const lname = name.toLowerCase();
  return (
    lname.includes('primary') ||
    lname.includes('submit') ||
    lname.includes('continue') ||
    lname.includes('confirm') ||
    lname.includes('save') ||
    lname.includes('send')
  );
}

function isInputLike(node: FigmaNode, name: string): boolean {
  const lname = name.toLowerCase();
  return (
    lname.includes('input') ||
    lname.includes('field') ||
    lname.includes('textbox') ||
    lname.includes('text box') ||
    lname.includes('email') ||
    lname.includes('password') ||
    lname.includes('search') ||
    lname.includes('textarea')
  );
}

function isRequiredField(name: string): boolean {
  const lname = name.toLowerCase();
  return lname.includes('required') || lname.includes('*');
}

function isLinkLike(node: FigmaNode, name: string): boolean {
  const lname = name.toLowerCase();
  return (
    lname.includes('link') ||
    lname.includes('href') ||
    lname.includes('forgot') ||
    lname.includes('sign up') ||
    lname.includes('signup') ||
    lname.includes('learn more') ||
    lname.includes('read more')
  );
}

function isCheckboxLike(name: string): boolean {
  const lname = name.toLowerCase();
  return lname.includes('checkbox') || lname.includes('check box') || lname.includes('toggle');
}

function isRadioLike(name: string): boolean {
  const lname = name.toLowerCase();
  return lname.includes('radio') || lname.includes('option');
}

function isIconLike(node: FigmaNode, name: string): boolean {
  const lname = name.toLowerCase();
  const type = node.type || '';
  
  // Named as icon
  if (lname.includes('icon') || lname.includes('svg') || lname.includes('glyph')) {
    return true;
  }
  
  // Small vector nodes are often icons
  if (type === 'VECTOR' || type === 'BOOLEAN_OPERATION') {
    const bounds = node.absoluteBoundingBox;
    if (bounds && bounds.width < 48 && bounds.height < 48) {
      return true;
    }
  }
  
  return false;
}

function isSectionLike(node: FigmaNode, name: string, type: string): boolean {
  if (!['FRAME', 'GROUP', 'SECTION'].includes(type)) return false;
  
  const lname = name.toLowerCase();
  return (
    lname.includes('section') ||
    lname.includes('card') ||
    lname.includes('panel') ||
    lname.includes('container') ||
    lname.includes('header') ||
    lname.includes('footer') ||
    lname.includes('sidebar') ||
    lname.includes('modal') ||
    lname.includes('dialog') ||
    lname.includes('form') ||
    lname.includes('nav')
  );
}

function hasImageFill(node: FigmaNode): boolean {
  const fills = node.fills || [];
  return fills.some((f: any) => f.type === 'IMAGE');
}

function extractTextFromChildren(children: FigmaNode[]): string | undefined {
  for (const child of children) {
    if (child.type === 'TEXT' && child.characters) {
      return child.characters;
    }
    // Recurse one level
    if (child.children) {
      const nested = extractTextFromChildren(child.children);
      if (nested) return nested;
    }
  }
  return undefined;
}

function inferNavigationTarget(name: string, text?: string): string | undefined {
  const combined = `${name} ${text || ''}`.toLowerCase();
  
  if (combined.includes('forgot')) return 'Forgot Password';
  if (combined.includes('sign up') || combined.includes('signup') || combined.includes('register')) return 'Sign Up';
  if (combined.includes('log in') || combined.includes('login') || combined.includes('sign in')) return 'Login';
  if (combined.includes('home')) return 'Home';
  if (combined.includes('profile')) return 'Profile';
  if (combined.includes('settings')) return 'Settings';
  if (combined.includes('dashboard')) return 'Dashboard';
  if (combined.includes('checkout')) return 'Checkout';
  if (combined.includes('cart')) return 'Cart';
  
  return undefined;
}

function buildFormCandidates(
  elements: FigmaSemanticElement[],
  frameId: string,
  frameName: string
): FigmaSemanticFormCandidate[] {
  const inputs = elements.filter(e => e.type === 'input' || e.type === 'checkbox' || e.type === 'radio');
  const buttons = elements.filter(e => e.type === 'button');
  
  if (inputs.length === 0) return [];
  
  // Simple heuristic: if we have inputs and buttons in the same frame, treat as a form
  // Group by spatial proximity in future iterations
  const submitButtons = buttons.filter(b => b.isPrimaryAction);
  
  return [{
    id: `form-${frameId}`,
    name: frameName,
    fieldIds: inputs.map(i => i.id),
    submitButtonIds: submitButtons.length > 0 
      ? submitButtons.map(b => b.id)
      : buttons.slice(0, 1).map(b => b.id), // Fallback to first button
  }];
}
