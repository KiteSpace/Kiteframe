import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ImageNode } from '../../components/ImageNode';
import { renderWithProviders, createMockImageNode, resetAllMocks } from '../test-utils';

describe('ImageNode Component', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('renders with empty image state', () => {
    const node = createMockImageNode({
      data: {
        label: 'Empty Image',
        src: '',
        alt: 'Test Image'
      }
    });

    renderWithProviders(<ImageNode node={node} />);
    
    expect(screen.getByTestId(`image-node-${node.id}`)).toBeInTheDocument();
    expect(screen.getByText('Click to upload')).toBeInTheDocument();
  });

  it('renders with loaded image', () => {
    const node = createMockImageNode({
      data: {
        label: 'Loaded Image',
        src: 'https://example.com/image.jpg',
        alt: 'Test Image',
        filename: 'image.jpg'
      }
    });

    renderWithProviders(<ImageNode node={node} />);
    
    const img = screen.getByAltText('Test Image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('shows broken image state', () => {
    const node = createMockImageNode({
      data: {
        label: 'Broken Image',
        src: 'https://broken-url.com/image.jpg',
        isImageBroken: true
      }
    });

    renderWithProviders(<ImageNode node={node} />);
    
    expect(screen.getByText('Failed to load image')).toBeInTheDocument();
  });

  it('handles file upload', async () => {
    const onImageUpload = vi.fn().mockResolvedValue('uploaded-image-url');
    const onUpdate = vi.fn();
    const node = createMockImageNode();

    renderWithProviders(
      <ImageNode 
        node={node} 
        onImageUpload={onImageUpload}
        onUpdate={onUpdate}
      />
    );
    
    // Create a mock file
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    fireEvent.change(input);
    
    await waitFor(() => {
      expect(onImageUpload).toHaveBeenCalledWith(node.id, file);
    });
    
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(node.id, {
        data: expect.objectContaining({
          src: 'uploaded-image-url',
          filename: 'test.jpg',
          sourceType: 'upload'
        })
      });
    });
  });

  it('validates file type', async () => {
    const onImageUpload = vi.fn();
    const node = createMockImageNode();

    renderWithProviders(
      <ImageNode node={node} onImageUpload={onImageUpload} />
    );
    
    // Try to upload non-image file
    const file = new File(['text'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    fireEvent.change(input);
    
    await waitFor(() => {
      expect(onImageUpload).not.toHaveBeenCalled();
    });
  });

  it('validates file size', async () => {
    const onImageUpload = vi.fn();
    const node = createMockImageNode();

    renderWithProviders(
      <ImageNode node={node} onImageUpload={onImageUpload} />
    );
    
    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { 
      type: 'image/jpeg' 
    });
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });
    
    fireEvent.change(input);
    
    await waitFor(() => {
      expect(onImageUpload).not.toHaveBeenCalled();
    });
  });

  it('handles URL input', async () => {
    const onImageUrlSet = vi.fn();
    const onUpdate = vi.fn();
    const node = createMockImageNode();

    renderWithProviders(
      <ImageNode 
        node={node} 
        onImageUrlSet={onImageUrlSet}
        onUpdate={onUpdate}
      />
    );
    
    // Click URL button
    const urlButton = screen.getByText('Enter URL');
    fireEvent.click(urlButton);
    
    // Enter URL
    const urlInput = await screen.findByPlaceholderText(/https:\/\//);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/new-image.jpg' } });
    
    // Submit
    const setButton = screen.getByText('Set');
    fireEvent.click(setButton);
    
    await waitFor(() => {
      expect(onImageUrlSet).toHaveBeenCalledWith(node.id, 'https://example.com/new-image.jpg');
      expect(onUpdate).toHaveBeenCalledWith(node.id, {
        data: expect.objectContaining({
          src: 'https://example.com/new-image.jpg',
          sourceType: 'url'
        })
      });
    });
  });

  it('shows resize handle when enabled', () => {
    const node = createMockImageNode();
    
    renderWithProviders(
      <ImageNode node={node} showResizeHandle={true} />
    );
    
    expect(screen.getByTestId('resize-handle-bottom-right')).toBeInTheDocument();
  });

  it('shows upload progress state', async () => {
    const onImageUpload = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('url'), 100)));
    const node = createMockImageNode();

    renderWithProviders(
      <ImageNode node={node} onImageUpload={onImageUpload} />
    );
    
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    fireEvent.change(input);
    
    // Should show uploading state
    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });
});