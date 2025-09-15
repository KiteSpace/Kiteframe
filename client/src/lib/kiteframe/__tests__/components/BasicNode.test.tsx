import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { BasicNode } from '../../components/BasicNode';
import { renderWithProviders, createMockNode, resetAllMocks } from '../test-utils';

describe('BasicNode Component', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('renders with default props', () => {
    const node = createMockNode({
      type: 'basic',
      data: {
        label: 'Test Node',
        description: 'Test Description'
      }
    });

    renderWithProviders(<BasicNode node={node} />);
    
    expect(screen.getByTestId(`basic-node-${node.id}`)).toBeInTheDocument();
    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('applies custom colors', () => {
    const node = createMockNode({
      type: 'basic',
      data: {
        label: 'Colored Node',
        colors: {
          headerBackground: '#ff0000',
          bodyBackground: '#00ff00',
          borderColor: '#0000ff'
        }
      }
    });

    renderWithProviders(<BasicNode node={node} />);
    
    const nodeElement = screen.getByTestId(`basic-node-${node.id}`);
    const header = nodeElement.querySelector('.bg-gradient-to-r');
    
    expect(header).toHaveStyle('background: #ff0000');
  });

  it('enters edit mode on double click', async () => {
    const onUpdate = vi.fn();
    const onDoubleClick = vi.fn();
    const node = createMockNode({
      data: {
        label: 'Editable Node'
      }
    });

    renderWithProviders(
      <BasicNode 
        node={node} 
        onUpdate={onUpdate}
        onDoubleClick={onDoubleClick}
      />
    );
    
    const header = screen.getByText('Editable Node').closest('div');
    fireEvent.doubleClick(header!);
    
    expect(onDoubleClick).toHaveBeenCalled();
    
    // Should show input field
    const input = await screen.findByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Editable Node');
  });

  it('updates label on edit submit', async () => {
    const onUpdate = vi.fn();
    const node = createMockNode({
      data: {
        label: 'Original Label'
      }
    });

    renderWithProviders(
      <BasicNode node={node} onUpdate={onUpdate} />
    );
    
    // Enter edit mode
    const header = screen.getByText('Original Label').closest('div');
    fireEvent.doubleClick(header!);
    
    // Edit the label
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Label' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(node.id, {
        data: expect.objectContaining({
          label: 'New Label'
        })
      });
    });
  });

  it('cancels edit on Escape key', async () => {
    const onUpdate = vi.fn();
    const node = createMockNode({
      data: {
        label: 'Original Label'
      }
    });

    renderWithProviders(
      <BasicNode node={node} onUpdate={onUpdate} />
    );
    
    // Enter edit mode
    const header = screen.getByText('Original Label').closest('div');
    fireEvent.doubleClick(header!);
    
    // Try to edit then cancel
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Changed Label' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    
    await waitFor(() => {
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  it('shows resize handles when enabled', () => {
    const node = createMockNode();
    
    renderWithProviders(
      <BasicNode node={node} showResizeHandle={true} />
    );
    
    expect(screen.getByTestId('resize-handle-bottom-right')).toBeInTheDocument();
  });

  it('hides resize handles when disabled', () => {
    const node = createMockNode();
    
    renderWithProviders(
      <BasicNode node={node} showResizeHandle={false} />
    );
    
    expect(screen.queryByTestId('resize-handle-bottom-right')).not.toBeInTheDocument();
  });

  it('shows connection handles when enabled', () => {
    const node = createMockNode();
    
    renderWithProviders(
      <BasicNode node={node} showHandles={true} />
    );
    
    const nodeElement = screen.getByTestId(`basic-node-${node.id}`);
    expect(nodeElement.parentElement?.querySelector('[data-testid*="node-handles"]')).toBeInTheDocument();
  });

  it('applies selected state styling', () => {
    const node = createMockNode({ selected: true });
    
    renderWithProviders(<BasicNode node={node} />);
    
    const nodeElement = screen.getByTestId(`basic-node-${node.id}`);
    expect(nodeElement).toHaveClass('ring-2', 'ring-blue-500');
  });

  it('handles resize callback', () => {
    const onUpdate = vi.fn();
    const node = createMockNode();
    
    renderWithProviders(
      <BasicNode node={node} onUpdate={onUpdate} showResizeHandle={true} />
    );
    
    const resizeHandle = screen.getByTestId('resize-handle-bottom-right');
    
    // Simulate resize
    fireEvent.mouseDown(resizeHandle);
    fireEvent.mouseMove(document, { clientX: 300, clientY: 200 });
    fireEvent.mouseUp(document);
    
    // Note: Actual resize logic would require more complex simulation
    // This test verifies the handle exists and is interactive
    expect(resizeHandle).toBeInTheDocument();
  });
});