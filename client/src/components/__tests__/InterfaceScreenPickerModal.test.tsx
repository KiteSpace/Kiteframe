import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterfaceScreenPickerModal } from '../InterfaceScreenPickerModal';

const clusters = Array.from({ length: 10 }, (_, index) => ({
  name: `Candidate ${index + 1}`,
  nodes: [{ id: `node-${index}`, data: { label: `Step ${index + 1}` } }],
}));

describe('InterfaceScreenPickerModal large workflows', () => {
  it('shows all candidates, pre-selects six, and lets users swap candidates', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <InterfaceScreenPickerModal
        open
        onOpenChange={vi.fn()}
        clusters={clusters}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText((content) => content.includes('Pick a maximum of') && content.includes('6'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('KiteAI has pre-selected'))).toBeInTheDocument();
    expect(screen.getByText('6 / 6 selected')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(10);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.slice(0, 6).every((checkbox) => (checkbox as HTMLButtonElement).getAttribute('data-state') === 'checked')).toBe(true);
    expect(checkboxes.slice(6).every((checkbox) => (checkbox as HTMLButtonElement).getAttribute('data-state') !== 'checked')).toBe(true);

    await user.click(checkboxes[0]);
    await user.click(checkboxes[6]);

    expect(screen.getByText('6 / 6 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Generate 6 screens/i }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0][0].map((cluster: { name: string }) => cluster.name)).toEqual([
      'Candidate 2',
      'Candidate 3',
      'Candidate 4',
      'Candidate 5',
      'Candidate 6',
      'Candidate 7',
    ]);
  });
});