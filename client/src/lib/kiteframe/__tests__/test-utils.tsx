import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { KiteFrameCore } from '../core/KiteFrameCore';
import { PluginProvider } from '../core/PluginProvider';
import type { Node, Edge } from '../types';

// Mock data factories
export const createMockNode = (overrides?: Partial<Node>): Node => ({
  id: 'node-1',
  type: 'process',
  position: { x: 100, y: 100 },
  data: {
    label: 'Test Node',
    description: 'Test Description',
    colors: {}
  },
  width: 200,
  height: 100,
  selected: false,
  ...overrides
});

export const createMockImageNode = (overrides?: Partial<Node>): Node => ({
  id: 'image-node-1',
  type: 'image',
  position: { x: 200, y: 200 },
  data: {
    label: 'Image Node',
    src: '',
    alt: 'Test Image',
    colors: {}
  },
  width: 250,
  height: 150,
  selected: false,
  ...overrides
});

export const createMockEdge = (overrides?: Partial<Edge>): Edge => ({
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  type: 'bezier',
  ...overrides
});

// Custom render with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  enablePlugins?: boolean;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const { enablePlugins = true, ...renderOptions } = options || {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    if (enablePlugins) {
      return (
        <PluginProvider>
          {children}
        </PluginProvider>
      );
    }
    return <>{children}</>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock handlers
export const mockNodeUpdate = vi.fn();
export const mockEdgeUpdate = vi.fn();
export const mockImageUpload = vi.fn().mockResolvedValue('mock-image-url');
export const mockImageUrlSet = vi.fn();

// Reset all mocks utility
export const resetAllMocks = () => {
  mockNodeUpdate.mockClear();
  mockEdgeUpdate.mockClear();
  mockImageUpload.mockClear();
  mockImageUrlSet.mockClear();
};