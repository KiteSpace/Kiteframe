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
  FigmaSemanticRole,
  FigmaSemanticControlType,
  FigmaScreenType,
  FigmaStateType,
} from './figmaSemanticTypes';

const MAX_DEPTH = 10;
const MAX_ELEMENTS = 500;

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

  function walk(node: FigmaNode, parentId: string | null, depth: number): void {
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

    if (nodeType === 'TEXT') {
      const characters: string = node.characters || '';
      const type = classifyTextElement(node, characters);
      
      element = createSemanticElement(node.id, type, nodeName || characters.slice(0, 64), nodeType, bounds, parentId);
      element.text = characters;
      element.role = type === 'heading' ? 'heading' : type === 'label' ? 'context' : 'context';
    }
    else if (isButtonLike(node, nodeName, children)) {
      element = createSemanticElement(node.id, 'button', nodeName || 'Button', nodeType, bounds, parentId);
      element.isPrimaryAction = isPrimaryButton(node, nodeName);
      element.isSecondaryAction = isSecondaryButton(nodeName);
      element.role = 'action';
      element.controlType = 'button';
      
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
    else if (isInputLike(node, nodeName)) {
      element = createSemanticElement(node.id, 'input', nodeName || 'Input', nodeType, bounds, parentId);
      element.isRequiredField = isRequiredField(nodeName);
      element.role = 'input';
      element.controlType = inferControlType(nodeName);
    }
    else if (isLinkLike(node, nodeName)) {
      element = createSemanticElement(node.id, 'link', nodeName || 'Link', nodeType, bounds, parentId);
      element.role = 'navigation';
      element.controlType = 'link';
      element.screenRefName = inferNavigationTarget(nodeName, extractTextFromChildren(children));
      
      const linkText = extractTextFromChildren(children) || nodeName;
      element.text = linkText;
      
      navigationTargets.push({
        elementId: node.id,
        label: linkText || 'Link',
        inferredTargetName: inferNavigationTarget(nodeName, linkText),
      });
    }
    else if (isCheckboxLike(nodeName)) {
      element = createSemanticElement(node.id, 'checkbox', nodeName, nodeType, bounds, parentId);
      element.role = 'input';
      element.controlType = 'checkbox';
    }
    else if (isRadioLike(nodeName)) {
      element = createSemanticElement(node.id, 'radio', nodeName, nodeType, bounds, parentId);
      element.role = 'input';
      element.controlType = 'radio';
    }
    else if (isIconLike(node, nodeName)) {
      element = createSemanticElement(node.id, 'icon', nodeName, nodeType, bounds, parentId);
      element.role = 'decorative';
    }
    else if (isSectionLike(node, nodeName, nodeType)) {
      element = createSemanticElement(node.id, 'section', nodeName, nodeType, bounds, parentId);
      element.role = 'context';
    }
    else if (nodeType === 'RECTANGLE' && hasImageFill(node)) {
      element = createSemanticElement(node.id, 'image', nodeName || 'Image', nodeType, bounds, parentId);
      element.role = 'decorative';
    }

    if (element) {
      element.childrenIds = children.map((c: FigmaNode) => c.id);
      elements.push(element);
      elementCount++;
    }

    for (const child of children) {
      walk(child, node.id, depth + 1);
    }
  }

  walk(frameNode, null, 0);

  const forms = buildFormCandidates(elements, frameId, frameName);
  
  const screenType = inferScreenType(frameName, elements);
  const stateType = inferStateType(frameName, elements);
  
  const primaryActionIds = elements
    .filter(e => e.isPrimaryAction && e.role === 'action')
    .map(e => e.id);
  
  const secondaryActionIds = elements
    .filter(e => e.isSecondaryAction && e.role === 'action')
    .map(e => e.id);

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
    screenType,
    stateType,
    primaryActionIds: primaryActionIds.length > 0 ? primaryActionIds : undefined,
    secondaryActionIds: secondaryActionIds.length > 0 ? secondaryActionIds : undefined,
  };
}

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
  
  if (fontSize >= 20 || fontWeight >= 600) {
    return 'heading';
  }
  
  if (trimmed.length < 50 && trimmed === trimmed.toUpperCase() && trimmed.length > 2) {
    return 'heading';
  }
  
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
  
  if (lname.includes('button') || lname.includes('btn') || lname.includes('cta')) {
    return true;
  }
  
  if ((type === 'COMPONENT' || type === 'INSTANCE') && node.componentProperties) {
    const propKeys = Object.keys(node.componentProperties).join(' ').toLowerCase();
    if (propKeys.includes('button') || propKeys.includes('variant')) {
      return true;
    }
  }
  
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
    lname.includes('send') ||
    lname.includes('login') ||
    lname.includes('sign in') ||
    lname.includes('sign up') ||
    lname.includes('create') ||
    lname.includes('next')
  );
}

function isSecondaryButton(name: string): boolean {
  const lname = name.toLowerCase();
  return (
    lname.includes('secondary') ||
    lname.includes('cancel') ||
    lname.includes('back') ||
    lname.includes('close') ||
    lname.includes('skip') ||
    lname.includes('dismiss')
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

function inferControlType(name: string): FigmaSemanticControlType {
  const lname = name.toLowerCase();
  if (lname.includes('email')) return 'email';
  if (lname.includes('password')) return 'password';
  if (lname.includes('search')) return 'search';
  if (lname.includes('select') || lname.includes('dropdown')) return 'select';
  if (lname.includes('checkbox') || lname.includes('check')) return 'checkbox';
  if (lname.includes('radio')) return 'radio';
  return 'text';
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
  
  if (lname.includes('icon') || lname.includes('svg') || lname.includes('glyph')) {
    return true;
  }
  
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

function inferScreenType(frameName: string, elements: FigmaSemanticElement[]): FigmaScreenType {
  const lname = frameName.toLowerCase();
  const headings = elements.filter(e => e.type === 'heading').map(e => (e.text || e.name).toLowerCase());
  const combined = [lname, ...headings].join(' ');
  
  if (combined.includes('login') || combined.includes('sign in') || combined.includes('sign-in') ||
      combined.includes('signup') || combined.includes('sign up') || combined.includes('register') ||
      combined.includes('form')) {
    return 'form';
  }
  
  if (combined.includes('settings') || combined.includes('preferences') || combined.includes('config')) {
    return 'settings';
  }
  
  if (combined.includes('list') || combined.includes('table') || combined.includes('results') ||
      combined.includes('feed') || combined.includes('browse')) {
    return 'list';
  }
  
  if (combined.includes('detail') || combined.includes('view') || combined.includes('profile') ||
      combined.includes('about')) {
    return 'detail';
  }
  
  if (combined.includes('landing') || combined.includes('home') || combined.includes('welcome') ||
      combined.includes('hero')) {
    return 'landing';
  }
  
  const hasInputs = elements.some(e => e.role === 'input');
  if (hasInputs) {
    return 'form';
  }
  
  return 'unknown';
}

function inferStateType(frameName: string, elements: FigmaSemanticElement[]): FigmaStateType {
  const lname = frameName.toLowerCase();
  const allText = elements.filter(e => e.text).map(e => e.text!.toLowerCase()).join(' ');
  const combined = `${lname} ${allText}`;
  
  if (combined.includes('success') || combined.includes('done') || combined.includes('complete') ||
      combined.includes('confirmed') || combined.includes('thank you')) {
    return 'success';
  }
  
  if (combined.includes('error') || combined.includes('failed') || combined.includes('oops') ||
      combined.includes('invalid') || combined.includes('problem')) {
    return 'error';
  }
  
  if (combined.includes('empty') || combined.includes('no items') || combined.includes('no results') ||
      combined.includes('nothing here') || combined.includes('no data')) {
    return 'empty';
  }
  
  if (combined.includes('loading') || combined.includes('spinner') || combined.includes('please wait')) {
    return 'loading';
  }
  
  if (lname.includes('variant') || lname.includes('hover') || lname.includes('active') ||
      lname.includes('disabled') || lname.includes('selected')) {
    return 'variant';
  }
  
  return 'default';
}

function buildFormCandidates(
  elements: FigmaSemanticElement[],
  frameId: string,
  frameName: string
): FigmaSemanticFormCandidate[] {
  const inputs = elements.filter(e => e.role === 'input');
  const buttons = elements.filter(e => e.type === 'button');
  const labels = elements.filter(e => e.type === 'label');
  const headings = elements.filter(e => e.type === 'heading');
  
  if (inputs.length === 0) return [];
  
  const submitButtons = buttons.filter(b => b.isPrimaryAction);
  const cancelButtons = buttons.filter(b => b.isSecondaryAction);
  
  assignGroupIds(inputs, labels);
  
  return [{
    id: `form-${frameId}`,
    name: frameName,
    fieldIds: inputs.map(i => i.id),
    submitButtonIds: submitButtons.length > 0 
      ? submitButtons.map(b => b.id)
      : buttons.slice(0, 1).map(b => b.id),
    cancelButtonIds: cancelButtons.length > 0 ? cancelButtons.map(b => b.id) : undefined,
    descriptionElementIds: headings.length > 0 ? headings.slice(0, 2).map(h => h.id) : undefined,
  }];
}

function assignGroupIds(inputs: FigmaSemanticElement[], labels: FigmaSemanticElement[]): void {
  for (const input of inputs) {
    const inputY = input.bounds.y;
    const inputX = input.bounds.x;
    
    const nearbyLabel = labels.find(label => {
      const labelY = label.bounds.y;
      const labelX = label.bounds.x;
      const verticalDistance = Math.abs(labelY - inputY);
      const horizontalDistance = Math.abs(labelX - inputX);
      
      return verticalDistance < 60 && horizontalDistance < 300;
    });
    
    if (nearbyLabel) {
      const groupId = `group-${input.id}`;
      input.groupId = groupId;
      nearbyLabel.groupId = groupId;
    }
  }
}
