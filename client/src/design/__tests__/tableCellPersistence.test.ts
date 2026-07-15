/**
 * Table cell persistence tests.
 *
 * Verifies that AstryxTable props (cellData, headers) survive the save/load
 * JSON round-trip that the design editor performs. Also checks that the resize
 * helpers preserve existing cell text when rows or columns change.
 *
 * No React runtime or craftjs required — these are pure data-structure tests.
 */

import { describe, it, expect } from 'vitest';
import { validateCraftState, sanitizeCraftState } from '../craftValidator';

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Mirrors the resize logic in DesignEditor.tsx so we can unit-test it without
// importing React or craftjs.

function resizeCellData(
  existing: string[][],
  newRows: number,
  newCols: number,
): string[][] {
  return Array.from({ length: newRows }, (_, r) =>
    Array.from({ length: newCols }, (_, c) => existing[r]?.[c] ?? '—'),
  );
}

function resizeHeaders(existing: string[], newCols: number): string[] {
  return Array.from({ length: newCols }, (_, i) => existing[i] ?? `Col ${i + 1}`);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTableState(overrideProps: Record<string, unknown> = {}) {
  return {
    ROOT: {
      type: { resolvedName: 'AstryxSection' },
      isCanvas: true,
      props: { direction: 'column', gap: 16, padding: 24 },
      displayName: 'AstryxSection',
      custom: {},
      parent: null,
      hidden: false,
      nodes: ['data-table'],
      linkedNodes: {},
    },
    'data-table': {
      type: { resolvedName: 'AstryxTable' },
      isCanvas: false,
      props: {
        rows: 3,
        columns: 3,
        headers: ['Name', 'Email', 'Status'],
        cellData: [
          ['Alice', 'alice@example.com', 'Active'],
          ['Bob', 'bob@example.com', 'Inactive'],
          ['Carol', 'carol@example.com', 'Pending'],
        ],
        ...overrideProps,
      },
      displayName: 'AstryxTable',
      custom: {},
      parent: 'ROOT',
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  };
}

// ─── JSON round-trip ──────────────────────────────────────────────────────────

describe('AstryxTable — JSON save/load round-trip', () => {
  it('preserves headers exactly after JSON serialisation and deserialisation', () => {
    const original = makeTableState();
    const json = JSON.stringify(original);
    const loaded = JSON.parse(json) as typeof original;

    expect(loaded['data-table'].props.headers).toEqual(['Name', 'Email', 'Status']);
  });

  it('preserves cellData exactly after JSON serialisation and deserialisation', () => {
    const original = makeTableState();
    const json = JSON.stringify(original);
    const loaded = JSON.parse(json) as typeof original;

    expect(loaded['data-table'].props.cellData).toEqual([
      ['Alice', 'alice@example.com', 'Active'],
      ['Bob', 'bob@example.com', 'Inactive'],
      ['Carol', 'carol@example.com', 'Pending'],
    ]);
  });

  it('preserves empty-string cell values (not replaced by defaults)', () => {
    const state = makeTableState({
      headers: ['A', '', 'C'],
      cellData: [['x', '', 'z']],
      rows: 1,
      columns: 3,
    });
    const loaded = JSON.parse(JSON.stringify(state));
    expect(loaded['data-table'].props.headers[1]).toBe('');
    expect(loaded['data-table'].props.cellData[0][1]).toBe('');
  });

  it('preserves special characters in cell content', () => {
    const state = makeTableState({
      headers: ['<Name>', '"Quoted"', "It's"],
      cellData: [['<Alice & Bob>', '"hello"', "it's fine"]],
      rows: 1,
      columns: 3,
    });
    const loaded = JSON.parse(JSON.stringify(state));
    expect(loaded['data-table'].props.headers).toEqual(['<Name>', '"Quoted"', "It's"]);
    expect(loaded['data-table'].props.cellData[0]).toEqual([
      '<Alice & Bob>',
      '"hello"',
      "it's fine",
    ]);
  });

  it('preserves unicode content', () => {
    const state = makeTableState({
      headers: ['名前', 'Имя', '名字'],
      cellData: [['アリス', 'Алиса', '爱丽丝']],
      rows: 1,
      columns: 3,
    });
    const loaded = JSON.parse(JSON.stringify(state));
    expect(loaded['data-table'].props.headers).toEqual(['名前', 'Имя', '名字']);
    expect(loaded['data-table'].props.cellData[0]).toEqual(['アリス', 'Алиса', '爱丽丝']);
  });
});

// ─── Validator ────────────────────────────────────────────────────────────────

describe('AstryxTable — validateCraftState with cellData / headers', () => {
  it('accepts a valid table state with headers and cellData', () => {
    const result = validateCraftState(makeTableState());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a table state without optional props (backwards compat)', () => {
    const result = validateCraftState(
      makeTableState({ headers: undefined, cellData: undefined }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a large table (max rows × max cols)', () => {
    const maxCellData = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 6 }, (_, c) => `r${r}c${c}`),
    );
    const result = validateCraftState(
      makeTableState({
        rows: 10,
        columns: 6,
        headers: ['A', 'B', 'C', 'D', 'E', 'F'],
        cellData: maxCellData,
      }),
    );
    expect(result.valid).toBe(true);
  });
});

// ─── Sanitizer ────────────────────────────────────────────────────────────────

describe('AstryxTable — sanitizeCraftState leaves table props untouched', () => {
  it('does not modify cellData or headers for a valid AstryxTable node', () => {
    const original = makeTableState();
    const json = JSON.stringify(original);
    const sanitized = sanitizeCraftState(json);

    // sanitizeCraftState must return the same string when nothing is unknown
    expect(sanitized).toBe(json);
  });

  it('preserves table props when other nodes are sanitized', () => {
    const state = {
      ...makeTableState(),
      'unknown-widget': {
        type: { resolvedName: 'AstryxFutureWidget' },
        isCanvas: false,
        props: { foo: 'bar' },
        displayName: 'AstryxFutureWidget',
        custom: {},
        parent: 'ROOT',
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
    };
    const sanitized = JSON.parse(sanitizeCraftState(JSON.stringify(state)));

    // unknown widget gets replaced
    expect(sanitized['unknown-widget'].type.resolvedName).toBe('AstryxUnknown');
    // table is left intact
    expect(sanitized['data-table'].type.resolvedName).toBe('AstryxTable');
    expect(sanitized['data-table'].props.headers).toEqual(['Name', 'Email', 'Status']);
    expect(sanitized['data-table'].props.cellData[1]).toEqual([
      'Bob',
      'bob@example.com',
      'Inactive',
    ]);
  });
});

// ─── Resize helpers ───────────────────────────────────────────────────────────

describe('Row/column resize — existing cell text is preserved', () => {
  const ORIGINAL_CELLS = [
    ['Alice', 'alice@example.com', 'Active'],
    ['Bob', 'bob@example.com', 'Inactive'],
    ['Carol', 'carol@example.com', 'Pending'],
  ];
  const ORIGINAL_HEADERS = ['Name', 'Email', 'Status'];

  it('adding a row preserves all existing cell content', () => {
    const result = resizeCellData(ORIGINAL_CELLS, 4, 3);
    expect(result[0]).toEqual(['Alice', 'alice@example.com', 'Active']);
    expect(result[1]).toEqual(['Bob', 'bob@example.com', 'Inactive']);
    expect(result[2]).toEqual(['Carol', 'carol@example.com', 'Pending']);
    expect(result[3]).toEqual(['—', '—', '—']);
  });

  it('removing a row preserves existing content in remaining rows', () => {
    const result = resizeCellData(ORIGINAL_CELLS, 2, 3);
    expect(result[0]).toEqual(['Alice', 'alice@example.com', 'Active']);
    expect(result[1]).toEqual(['Bob', 'bob@example.com', 'Inactive']);
    expect(result.length).toBe(2);
  });

  it('adding a column preserves all existing headers', () => {
    const result = resizeHeaders(ORIGINAL_HEADERS, 4);
    expect(result[0]).toBe('Name');
    expect(result[1]).toBe('Email');
    expect(result[2]).toBe('Status');
    expect(result[3]).toBe('Col 4');
  });

  it('removing a column preserves the remaining headers', () => {
    const result = resizeHeaders(ORIGINAL_HEADERS, 2);
    expect(result).toEqual(['Name', 'Email']);
  });

  it('adding a column preserves existing cell data in each row', () => {
    const result = resizeCellData(ORIGINAL_CELLS, 3, 4);
    expect(result[0]).toEqual(['Alice', 'alice@example.com', 'Active', '—']);
    expect(result[1]).toEqual(['Bob', 'bob@example.com', 'Inactive', '—']);
    expect(result[2]).toEqual(['Carol', 'carol@example.com', 'Pending', '—']);
  });

  it('removing a column preserves the remaining cell data', () => {
    const result = resizeCellData(ORIGINAL_CELLS, 3, 2);
    expect(result[0]).toEqual(['Alice', 'alice@example.com']);
    expect(result[1]).toEqual(['Bob', 'bob@example.com']);
    expect(result[2]).toEqual(['Carol', 'carol@example.com']);
  });

  it('simultaneous row + column reduction preserves the surviving content exactly', () => {
    const result = resizeCellData(ORIGINAL_CELLS, 2, 2);
    expect(result).toEqual([
      ['Alice', 'alice@example.com'],
      ['Bob', 'bob@example.com'],
    ]);
  });

  it('resize from empty (no existing data) fills with dash placeholders', () => {
    const result = resizeCellData([], 2, 3);
    expect(result).toEqual([
      ['—', '—', '—'],
      ['—', '—', '—'],
    ]);
  });

  it('resizeHeaders from empty fills with default column names', () => {
    const result = resizeHeaders([], 3);
    expect(result).toEqual(['Col 1', 'Col 2', 'Col 3']);
  });

  it('resize round-trip: expand then shrink back restores original content', () => {
    // Expand to 4 cols
    const expanded = resizeCellData(ORIGINAL_CELLS, 3, 4);
    // Write something into the new column
    expanded[0][3] = 'new-value';
    // Shrink back to 3 cols — new column is gone, originals survive
    const shrunk = resizeCellData(expanded, 3, 3);
    expect(shrunk[0]).toEqual(['Alice', 'alice@example.com', 'Active']);
    expect(shrunk[1]).toEqual(['Bob', 'bob@example.com', 'Inactive']);
    expect(shrunk[2]).toEqual(['Carol', 'carol@example.com', 'Pending']);
  });
});
