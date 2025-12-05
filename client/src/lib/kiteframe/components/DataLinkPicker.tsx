import { memo, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  X, 
  Table2, 
  Columns, 
  Rows, 
  ChevronRight,
  Link2,
  Check
} from 'lucide-react';
import type { DataTable, FormNodeField } from '../types';

interface DataLinkPickerProps {
  isOpen: boolean;
  onClose: () => void;
  tables: DataTable[];
  currentLink?: FormNodeField['dataLink'];
  onSelect: (link: FormNodeField['dataLink']) => void;
  position?: { x: number; y: number };
}

type PickerStep = 'table' | 'column' | 'row';

const DataLinkPickerComponent: React.FC<DataLinkPickerProps> = ({
  isOpen,
  onClose,
  tables,
  currentLink,
  onSelect,
  position,
}) => {
  const [step, setStep] = useState<PickerStep>('table');
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(currentLink?.tableId);
  const [selectedColumnId, setSelectedColumnId] = useState<string | undefined>(currentLink?.columnId);

  const selectedTable = useMemo(() => 
    tables.find(t => t.id === selectedTableId),
    [tables, selectedTableId]
  );

  const handleTableSelect = useCallback((tableId: string) => {
    setSelectedTableId(tableId);
    setSelectedColumnId(undefined);
    setStep('column');
  }, []);

  const handleColumnSelect = useCallback((columnId: string) => {
    setSelectedColumnId(columnId);
    setStep('row');
  }, []);

  const handleRowSelect = useCallback((rowId: string) => {
    if (!selectedTable || !selectedColumnId) return;

    const column = selectedTable.columns.find(c => c.id === selectedColumnId);
    const row = selectedTable.rows.find(r => r.id === rowId);
    const cellValue = row?.values[selectedColumnId];

    onSelect({
      tableId: selectedTable.id,
      columnId: selectedColumnId,
      rowId: rowId,
      displayValue: cellValue !== null && cellValue !== undefined ? String(cellValue) : '',
    });
    
    handleClose();
  }, [selectedTable, selectedColumnId, onSelect]);

  const handleClose = useCallback(() => {
    setStep('table');
    setSelectedTableId(currentLink?.tableId);
    setSelectedColumnId(currentLink?.columnId);
    onClose();
  }, [onClose, currentLink]);

  const handleBack = useCallback(() => {
    if (step === 'row') {
      setSelectedColumnId(undefined);
      setStep('column');
    } else if (step === 'column') {
      setSelectedTableId(undefined);
      setStep('table');
    }
  }, [step]);

  if (!isOpen) return null;

  const hasNoTables = tables.length === 0;
  const tableHasNoRows = selectedTable && selectedTable.rows.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div 
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[420px] max-h-[500px] overflow-hidden flex flex-col"
        style={position ? {
          position: 'absolute',
          left: position.x,
          top: position.y,
        } : undefined}
        data-testid="data-link-picker"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Link to Table Data
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            data-testid="data-link-picker-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-700/50">
          <button
            onClick={() => { setStep('table'); setSelectedTableId(undefined); setSelectedColumnId(undefined); }}
            className={cn(
              "px-2 py-1 rounded transition-colors",
              step === 'table' 
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium" 
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            Table
          </button>
          {selectedTableId && (
            <>
              <ChevronRight size={12} />
              <button
                onClick={() => { setStep('column'); setSelectedColumnId(undefined); }}
                className={cn(
                  "px-2 py-1 rounded transition-colors",
                  step === 'column' 
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                Column
              </button>
            </>
          )}
          {selectedColumnId && (
            <>
              <ChevronRight size={12} />
              <span className={cn(
                "px-2 py-1 rounded",
                step === 'row' 
                  ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium" 
                  : ""
              )}>
                Row
              </span>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {hasNoTables ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Table2 size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                No tables available
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Create a table node and import data first
              </p>
            </div>
          ) : step === 'table' ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                Select a table to link data from:
              </p>
              {tables.map(table => (
                <button
                  key={table.id}
                  onClick={() => handleTableSelect(table.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    selectedTableId === table.id
                      ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  )}
                  data-testid={`data-link-table-${table.id}`}
                >
                  <Table2 size={18} className={cn(
                    selectedTableId === table.id 
                      ? "text-indigo-500" 
                      : "text-gray-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {table.name || table.id}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {table.columns.length} columns · {table.rows.length} rows
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : step === 'column' && selectedTable ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                Select a column from "{selectedTable.name || selectedTable.id}":
              </p>
              {selectedTable.columns.map(column => (
                <button
                  key={column.id}
                  onClick={() => handleColumnSelect(column.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    selectedColumnId === column.id
                      ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  )}
                  data-testid={`data-link-column-${column.id}`}
                >
                  <Columns size={18} className={cn(
                    selectedColumnId === column.id 
                      ? "text-indigo-500" 
                      : "text-gray-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {column.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Type: {column.type}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : step === 'row' && selectedTable && selectedColumnId ? (
            tableHasNoRows ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Rows size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  No rows in table
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Import data into the table first
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                  Select a row to link:
                </p>
                {selectedTable.rows.map((row, index) => {
                  const cellValue = row.values[selectedColumnId];
                  const displayValue = cellValue !== null && cellValue !== undefined 
                    ? String(cellValue) 
                    : '(empty)';
                  const isCurrentLink = currentLink?.rowId === row.id && 
                    currentLink?.tableId === selectedTable.id && 
                    currentLink?.columnId === selectedColumnId;
                  
                  return (
                    <button
                      key={row.id}
                      onClick={() => handleRowSelect(row.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                        isCurrentLink
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-1 ring-green-400"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      )}
                      data-testid={`data-link-row-${row.id}`}
                    >
                      <div className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "text-sm font-medium truncate",
                          cellValue === null || cellValue === undefined
                            ? "text-gray-400 dark:text-gray-500 italic"
                            : "text-gray-900 dark:text-gray-100"
                        )}>
                          {displayValue}
                        </div>
                      </div>
                      {isCurrentLink && (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                          <Check size={14} />
                          <span>Current</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {step !== 'table' ? (
            <button
              onClick={handleBack}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              data-testid="data-link-picker-back"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            data-testid="data-link-picker-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export const DataLinkPicker = memo(DataLinkPickerComponent);
