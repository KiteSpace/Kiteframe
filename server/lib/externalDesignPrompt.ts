// Prompt template for external agents that submit designs through
// POST /api/external/designs and /api/designs/generate. Both routes validate the
// legacy flat format (`designJsonSchema`), and the shared design viewer
// (client/src/pages/DesignCanvasViewer.tsx) renders exactly that format, so the
// template describes it too. Craft.js state is only for the design editor.

/** Components the viewer can render (client/src/components/astryx COMPONENT_REGISTRY). */
export const EXTERNAL_DESIGN_COMPONENTS: Record<string, string> = {
  Navbar: 'logo, links (comma-separated), actions (comma-separated)',
  Sidebar: 'logo, items (comma-separated), active',
  Breadcrumb: 'items (comma-separated)',
  Heading: 'children (text), size: sm|md|lg|xl|2xl',
  Text: 'children (text), size: xs|sm|md|lg, muted (boolean)',
  Button: 'children (label), variant: primary|secondary|outline|ghost, size: sm|md|lg, disabled',
  TextInput: 'label, placeholder, value, disabled',
  TextArea: 'label, placeholder, rows',
  Select: 'placeholder, options (comma-separated)',
  Checkbox: 'label, checked (boolean)',
  RadioGroup: 'options (comma-separated), selected',
  Switch: 'label, checked (boolean)',
  Slider: 'value, min, max',
  Card: 'children (text), variant: elevated|outlined|ghost',
  Badge: 'children (text), color: blue|green|amber|red|gray',
  Banner: 'children (text), variant: info|success|warning|error',
  Avatar: 'name, size: sm|md|lg',
  Divider: 'label',
  Table: 'headers (array of strings), cellData (array of rows, each an array of strings), rows (max 10), columns (max 6)',
  Tabs: 'tabs (comma-separated), active',
  Accordion: 'items (comma-separated), open',
  List: '',
  ListItem: 'label, description, meta',
  ProgressBar: 'value (0-100), color',
  StatusDot: 'status: online|offline|busy|away',
  EmptyState: 'title, description',
  Icon: 'name',
  BarChart: 'title, data ("Label:value" pairs, comma-separated)',
  LineChart: 'title, data ("Label:value" pairs, comma-separated)',
  PieChart: 'title, data ("Label:value" pairs, comma-separated)',
  CodeBlock: 'code, language',
  Spinner: '',
  Skeleton: '',
};

export const EXTERNAL_DESIGN_SYSTEM_PROMPT = `You are turning a feature description into a single UI screen for Kiteframe. ONLY return JSON. No text before or after, no markdown code fences.

Output schema:
{
  "title": "Short screen title",
  "components": [
    { "id": "c1", "astryxComponent": "Heading", "x": 64, "y": 48, "props": { "children": "Sign in", "size": "xl" } }
  ]
}

Rules:
- "components" is a flat list (1-150 items). No nesting: every component is placed absolutely on the canvas at its own "x"/"y" in pixels, origin top-left.
- Lay the screen out on a canvas about 1200px wide. Leave at least 16px between components and never overlap them. Stack form fields vertically roughly 64px apart.
- "id" must be unique. Only "id", "astryxComponent", "x", "y" and "props" are allowed on a component; only "title" and "components" at the top level.
- "astryxComponent" must be one of the components below. Put visible text in "props.children" where listed; list-like props are comma-separated strings.
- Use realistic copy for the feature, not lorem ipsum.

Components and their props:
${Object.entries(EXTERNAL_DESIGN_COMPONENTS).map(([name, props]) => `- ${name}${props ? `: ${props}` : ''}`).join('\n')}`;

export const EXTERNAL_DESIGN_FEW_SHOT_EXAMPLES = [
  {
    input: 'A sign-in page with email and password, a Google option and a link to create an account.',
    output: {
      title: 'Sign in',
      components: [
        { id: 'c1', astryxComponent: 'Heading', x: 440, y: 80, props: { children: 'Sign in to Kiteframe', size: 'xl' } },
        { id: 'c2', astryxComponent: 'Text', x: 440, y: 124, props: { children: 'Welcome back. Use your work email.', muted: true } },
        { id: 'c3', astryxComponent: 'TextInput', x: 440, y: 180, props: { label: 'Email', placeholder: 'you@company.com' } },
        { id: 'c4', astryxComponent: 'TextInput', x: 440, y: 244, props: { label: 'Password', placeholder: '••••••••' } },
        { id: 'c5', astryxComponent: 'Button', x: 440, y: 316, props: { children: 'Sign in', variant: 'primary' } },
        { id: 'c6', astryxComponent: 'Divider', x: 440, y: 364, props: { label: 'or' } },
        { id: 'c7', astryxComponent: 'Button', x: 440, y: 396, props: { children: 'Continue with Google', variant: 'outline' } },
        { id: 'c8', astryxComponent: 'Text', x: 440, y: 452, props: { children: 'New here? Create an account', size: 'sm' } },
      ],
    },
  },
];
