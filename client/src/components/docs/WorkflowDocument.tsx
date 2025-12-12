interface WorkflowDocumentProps {
  children: React.ReactNode;
}

export function WorkflowDocument({ children }: WorkflowDocumentProps) {
  return (
    <div className="px-4 py-4 space-y-6 max-w-[720px]">
      {children}
    </div>
  );
}
