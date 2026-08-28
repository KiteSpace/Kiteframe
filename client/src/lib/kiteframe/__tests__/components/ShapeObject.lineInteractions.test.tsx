import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShapeObject } from '../../components/ShapeObject';
import type { CanvasObject, ShapeNodeData } from '../../types';

const lineObject = (shapeType: 'line' | 'arrow' = 'line') => ({
  id: `${shapeType}-1`,
  type: 'shape',
  position: { x: 20, y: 30 },
  width: 240,
  height: 100,
  selected: true,
  data: {
    shapeType,
    startPoint: { x: 220, y: 80 },
    endPoint: { x: 10, y: 20 },
    strokeColor: '#111827',
    strokeWidth: 2,
    strokeStyle: 'solid',
  },
}) as CanvasObject & { data: ShapeNodeData };

describe('ShapeObject line and arrow interactions', () => {
  it.each([
    ['line', 'shape-line-hit-target'],
    ['arrow', 'shape-arrow-hit-target'],
  ] as const)('uses a constant invisible screen-space corridor for %s dragging', (type, testId) => {
    const onStartDrag = vi.fn();
    render(
      <ShapeObject
        object={lineObject(type)}
        viewport={{ x: 0, y: 0, zoom: 0.35 }}
        selectedCanvasObjectCount={1}
        onStartDrag={onStartDrag}
      />,
    );

    const hitTarget = screen.getByTestId(testId);
    expect(hitTarget).toHaveAttribute('stroke', 'transparent');
    expect(hitTarget).toHaveAttribute('stroke-width', '16');
    expect(hitTarget).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    expect(screen.getByTestId(`shape-${type}`)).toHaveStyle({ strokeWidth: 2 });

    fireEvent.mouseDown(hitTarget, { button: 0 });
    expect(onStartDrag).toHaveBeenCalledTimes(1);
  });

  it('gives endpoint handles priority over whole-shape dragging', () => {
    const onStartDrag = vi.fn();
    const onEndpointDragStart = vi.fn();
    render(
      <ShapeObject
        object={lineObject()}
        viewport={{ x: 0, y: 0, zoom: 2 }}
        selectedCanvasObjectCount={1}
        onStartDrag={onStartDrag}
        onEndpointDragStart={onEndpointDragStart}
      />,
    );

    fireEvent.mouseDown(screen.getByTestId('endpoint-handle-start'), { button: 0 });
    expect(onEndpointDragStart).toHaveBeenCalledWith('start', expect.anything());
    expect(onStartDrag).not.toHaveBeenCalled();
  });

  it('omits edit hit targets and endpoint handles in read-only views', () => {
    render(
      <ShapeObject
        object={lineObject('arrow')}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        selectedCanvasObjectCount={1}
        readOnly
      />,
    );

    expect(screen.queryByTestId('shape-arrow-hit-target')).not.toBeInTheDocument();
    expect(screen.queryByTestId('endpoint-handle-start')).not.toBeInTheDocument();
    expect(screen.getByTestId('shape-arrow')).toBeInTheDocument();
  });
});