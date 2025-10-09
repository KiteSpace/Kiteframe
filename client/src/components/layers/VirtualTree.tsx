import React from 'react';
import * as ReactWindow from 'react-window';

// react-window exports don't have proper TypeScript types, so we need to cast
const FixedSizeList = (ReactWindow as any).FixedSizeList as React.ComponentType<any>;

export function VirtualTree({ rows, Row }:{ rows:any[], Row:(p:any)=>JSX.Element }){
  if (!FixedSizeList) {
    // Fallback if react-window isn't loaded properly
    return (
      <div className="overflow-y-auto" style={{ height: 520 }}>
        {rows.map((row, index) => (
          <div key={index} style={{ height: 28 }}>
            <Row {...row} />
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <FixedSizeList height={520} itemCount={rows.length} itemSize={28} width={'100%'}>
      {({index, style}: {index: number, style: any}) => (
        <div style={style}>
          <Row {...rows[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}