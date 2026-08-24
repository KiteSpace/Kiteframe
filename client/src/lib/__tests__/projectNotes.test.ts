import { beforeEach, describe, expect, it } from 'vitest';
import {
  getNotesStorageKey,
  getPromptTranscriptKey,
  loadProjectNotes,
  saveProjectNotes,
} from '../projectNotes';

const PROJECT = 'notes-project';

beforeEach(() => {
  localStorage.clear();
});

describe('project note storage', () => {
  it('migrates the legacy single-note payload without changing its content', () => {
    const original = 'Keep this project context.\n\nDo not lose this text.';
    localStorage.setItem(getNotesStorageKey(PROJECT), JSON.stringify({
      content: original,
      lastSaved: '2026-08-20T12:00:00.000Z',
    }));

    const loaded = loadProjectNotes(PROJECT);

    expect(loaded.migrated).toBe(true);
    expect(loaded.data.notes).toHaveLength(1);
    expect(loaded.data.notes[0]).toMatchObject({
      id: `legacy-${PROJECT}`,
      content: original,
      author: 'You',
      version: 1,
      updatedAt: '2026-08-20T12:00:00.000Z',
    });
  });

  it('writes the migrated collection under the same key and keeps prompt transcripts intact', () => {
    const transcript = JSON.stringify([{ role: 'user', content: 'Summarize this workflow' }]);
    localStorage.setItem(getNotesStorageKey(PROJECT), JSON.stringify({ content: 'Legacy body' }));
    localStorage.setItem(getPromptTranscriptKey(PROJECT), transcript);

    const loaded = loadProjectNotes(PROJECT);
    saveProjectNotes(PROJECT, loaded.data);

    const saved = JSON.parse(localStorage.getItem(getNotesStorageKey(PROJECT)) || '{}');
    expect(saved.notes).toHaveLength(1);
    expect(saved.notes[0].content).toBe('Legacy body');
    expect(localStorage.getItem(getPromptTranscriptKey(PROJECT))).toBe(transcript);
  });

  it('preserves a raw note body even when its literal text is valid JSON', () => {
    localStorage.setItem(getNotesStorageKey(PROJECT), '["keep", "this", "exactly"]');

    const loaded = loadProjectNotes(PROJECT);

    expect(loaded.migrated).toBe(true);
    expect(loaded.data.notes[0].content).toBe('["keep", "this", "exactly"]');
  });

  it('preserves independently editable notes in the collection', () => {
    const data = {
      notes: [
        { id: 'one', title: 'First', content: 'First body', author: 'You', version: 1, createdAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z' },
        { id: 'two', title: 'Second', content: 'Second body', author: 'You', version: 2, createdAt: '2026-08-20T11:00:00.000Z', updatedAt: '2026-08-20T11:00:00.000Z' },
      ],
    };

    saveProjectNotes(PROJECT, data);
    const loaded = loadProjectNotes(PROJECT);

    expect(loaded.migrated).toBe(false);
    expect(loaded.data.notes.map(note => [note.id, note.content])).toEqual([
      ['one', 'First body'],
      ['two', 'Second body'],
    ]);
  });
});