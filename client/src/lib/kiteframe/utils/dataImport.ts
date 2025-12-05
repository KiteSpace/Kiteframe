import type { DataTable, DataTableColumn, DataTableRow, DataTableColumnType, DataTableMeta } from '../types';
import { sanitizeText } from './validation';

const MAX_ROWS = 50;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function inferColumnType(values: (string | number | boolean | null)[]): DataTableColumnType {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonNullValues.length === 0) return 'unknown';
  
  const sample = nonNullValues.slice(0, 10);
  
  if (sample.every(v => typeof v === 'boolean' || v === 'true' || v === 'false')) {
    return 'boolean';
  }
  
  if (sample.every(v => typeof v === 'number' || !isNaN(Number(v)))) {
    return 'number';
  }
  
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{4}\/\d{2}\/\d{2}$/,
  ];
  if (sample.every(v => typeof v === 'string' && datePatterns.some(p => p.test(v)))) {
    return 'date';
  }
  
  return 'string';
}

function parseValue(value: string | number | boolean | null | undefined, type: DataTableColumnType): string | number | boolean | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  switch (type) {
    case 'number':
      const num = Number(value);
      return isNaN(num) ? null : num;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
      }
      return !!value;
    case 'date':
    case 'string':
    default:
      return String(value);
  }
}

export function parseCSV(csvString: string, options?: {
  delimiter?: string;
  hasHeader?: boolean;
  trimValues?: boolean;
}): { columns: string[]; rows: string[][] } {
  const { delimiter = ',', hasHeader = true, trimValues = true } = options || {};
  
  const lines = csvString.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }
  
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(trimValues ? current.trim() : current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(trimValues ? current.trim() : current);
    return result;
  };
  
  const parsedRows = lines.map(parseRow);
  
  if (hasHeader && parsedRows.length > 0) {
    return {
      columns: parsedRows[0],
      rows: parsedRows.slice(1),
    };
  }
  
  const columnCount = Math.max(...parsedRows.map(r => r.length));
  const columns = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
  
  return { columns, rows: parsedRows };
}

export function parseJSON(jsonString: string): { columns: string[]; rows: Record<string, unknown>[] } {
  const data = JSON.parse(jsonString);
  
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { columns: [], rows: [] };
    }
    
    const allKeys = new Set<string>();
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    });
    
    const columns = Array.from(allKeys);
    return { columns, rows: data };
  }
  
  if (typeof data === 'object' && data !== null) {
    if (data.data && Array.isArray(data.data)) {
      return parseJSON(JSON.stringify(data.data));
    }
    
    if (data.rows && Array.isArray(data.rows)) {
      return parseJSON(JSON.stringify(data.rows));
    }
    
    return { columns: Object.keys(data), rows: [data] };
  }
  
  throw new Error('Invalid JSON format: expected an array or object');
}

export function createDataTableFromCSV(
  csvString: string,
  name?: string,
  fileName?: string,
  options?: { delimiter?: string; hasHeader?: boolean }
): DataTable {
  const { columns, rows } = parseCSV(csvString, options);
  
  const tableColumns: DataTableColumn[] = columns.map((col, index) => ({
    id: `col-${index}`,
    name: sanitizeText(col),
    type: 'unknown' as DataTableColumnType,
    width: Math.min(150, Math.max(80, col.length * 10)),
  }));
  
  const tableRows: DataTableRow[] = rows.slice(0, MAX_ROWS).map((row, rowIndex) => {
    const values: Record<string, string | number | boolean | null> = {};
    tableColumns.forEach((col, colIndex) => {
      values[col.id] = row[colIndex] ?? null;
    });
    return {
      id: `row-${rowIndex}`,
      values,
    };
  });
  
  tableColumns.forEach(col => {
    const columnValues = tableRows.map(row => row.values[col.id]);
    col.type = inferColumnType(columnValues);
  });
  
  tableRows.forEach(row => {
    tableColumns.forEach(col => {
      row.values[col.id] = parseValue(row.values[col.id], col.type || 'string');
    });
  });
  
  const meta: DataTableMeta = {
    primaryColumnId: tableColumns[0]?.id,
    sourceFileName: fileName,
    totalRowCount: rows.length,
    importedAt: new Date().toISOString(),
  };
  
  return {
    id: generateId(),
    name: name || fileName?.replace(/\.[^/.]+$/, '') || 'Imported Table',
    columns: tableColumns,
    rows: tableRows,
    meta,
  };
}

export function createDataTableFromJSON(
  jsonString: string,
  name?: string,
  fileName?: string
): DataTable {
  const { columns, rows } = parseJSON(jsonString);
  
  const tableColumns: DataTableColumn[] = columns.map((col, index) => ({
    id: `col-${index}`,
    name: sanitizeText(String(col)),
    type: 'unknown' as DataTableColumnType,
    width: Math.min(150, Math.max(80, String(col).length * 10)),
  }));
  
  const tableRows: DataTableRow[] = rows.slice(0, MAX_ROWS).map((row, rowIndex) => {
    const values: Record<string, string | number | boolean | null> = {};
    tableColumns.forEach((col, colIndex) => {
      const key = columns[colIndex];
      const value = (row as Record<string, unknown>)[key];
      values[col.id] = value === undefined ? null : (value as string | number | boolean | null);
    });
    return {
      id: `row-${rowIndex}`,
      values,
    };
  });
  
  tableColumns.forEach(col => {
    const columnValues = tableRows.map(row => row.values[col.id]);
    col.type = inferColumnType(columnValues);
  });
  
  tableRows.forEach(row => {
    tableColumns.forEach(col => {
      row.values[col.id] = parseValue(row.values[col.id], col.type || 'string');
    });
  });
  
  const meta: DataTableMeta = {
    primaryColumnId: tableColumns[0]?.id,
    sourceFileName: fileName,
    totalRowCount: rows.length,
    importedAt: new Date().toISOString(),
  };
  
  return {
    id: generateId(),
    name: name || fileName?.replace(/\.[^/.]+$/, '') || 'Imported Table',
    columns: tableColumns,
    rows: tableRows,
    meta,
  };
}

export async function importFromFile(file: File): Promise<DataTable> {
  const text = await file.text();
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (extension === 'json') {
    return createDataTableFromJSON(text, undefined, fileName);
  }
  
  if (extension === 'csv' || extension === 'tsv') {
    const delimiter = extension === 'tsv' ? '\t' : ',';
    return createDataTableFromCSV(text, undefined, fileName, { delimiter });
  }
  
  return createDataTableFromCSV(text, undefined, fileName);
}

export function createSampleTable(): DataTable {
  return {
    id: generateId(),
    name: 'Sample Data',
    columns: [
      { id: 'col-0', name: 'Name', type: 'string', width: 120 },
      { id: 'col-1', name: 'Email', type: 'string', width: 180 },
      { id: 'col-2', name: 'Status', type: 'string', width: 100 },
      { id: 'col-3', name: 'Score', type: 'number', width: 80 },
    ],
    rows: [
      { id: 'row-0', values: { 'col-0': 'Alice Johnson', 'col-1': 'alice@example.com', 'col-2': 'Active', 'col-3': 95 } },
      { id: 'row-1', values: { 'col-0': 'Bob Smith', 'col-1': 'bob@example.com', 'col-2': 'Pending', 'col-3': 82 } },
      { id: 'row-2', values: { 'col-0': 'Carol White', 'col-1': 'carol@example.com', 'col-2': 'Active', 'col-3': 88 } },
      { id: 'row-3', values: { 'col-0': 'David Brown', 'col-1': 'david@example.com', 'col-2': 'Inactive', 'col-3': 76 } },
      { id: 'row-4', values: { 'col-0': 'Eve Davis', 'col-1': 'eve@example.com', 'col-2': 'Active', 'col-3': 91 } },
    ],
    meta: {
      primaryColumnId: 'col-0',
      totalRowCount: 5,
      importedAt: new Date().toISOString(),
    },
  };
}
