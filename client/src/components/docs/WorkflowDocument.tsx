import type { DocDensity } from './types';

interface WorkflowDocumentProps {
  children: React.ReactNode;
  density?: DocDensity;
}

export function WorkflowDocument({ children, density = 'rail' }: WorkflowDocumentProps) {
  // The reader deliberately holds a ~400px measure regardless of how wide the
  // pane is dragged: past roughly 75 characters a line the eye loses its place
  // returning to the next one, so extra width buys nothing. Widening the pane
  // widens the margins and the contents nav, not the text.
  return (
    <div
      className={
        density === 'reader'
          ? 'py-7 space-y-9 max-w-[400px] mx-auto'
          : 'px-4 py-4 space-y-6 max-w-[720px]'
      }
      data-density={density}
    >
      {children}
    </div>
  );
}
