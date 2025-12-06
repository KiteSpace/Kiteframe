import React, { forwardRef } from 'react';
import * as ReactWindow from 'react-window';

// react-window exports don't have proper TypeScript types, so we need to cast
const FixedSizeList = (ReactWindow as any).FixedSizeList as React.ComponentType<any>;

const BOTTOM_PADDING = 48;

const InnerElementWithPadding = forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  ({ style, ...rest }, ref) => (
    <div
      ref={ref}
      style={{
        ...style,
        height: typeof style?.height === 'number' ? style.height + BOTTOM_PADDING : style?.height,
      }}
      {...rest}
    />
  )
);
InnerElementWithPadding.displayName = 'InnerElementWithPadding';

export function VirtualTree({ rows, Row }:{ rows:any[], Row:(p:any)=>JSX.Element }){
  if (!FixedSizeList) {
    return (
      <div className="overflow-y-auto" style={{ height: 520 }}>
        {rows.map((row, index) => (
          <div key={index} style={{ height: 28 }}>
            <Row {...row} />
          </div>
        ))}
        <div style={{ height: BOTTOM_PADDING }} />
      </div>
    );
  }
  
  return (
    <FixedSizeList 
      height={520} 
      itemCount={rows.length} 
      itemSize={28} 
      width={'100%'}
      innerElementType={InnerElementWithPadding}
    >
      {({index, style}: {index: number, style: any}) => (
        <div style={style}>
          <Row {...rows[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}