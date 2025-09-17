import * as ReactWindow from 'react-window';

export function VirtualTree({ rows, Row }:{ rows:any[], Row:(p:any)=>JSX.Element }){
  const FixedSizeList = (ReactWindow as any).FixedSizeList || (ReactWindow as any).default?.FixedSizeList;
  
  // Fallback to simple scrollable div if react-window is not available
  if (!FixedSizeList) {
    return (
      <div style={{ height: '520px', overflow: 'auto' }}>
        {rows.map((row, index) => (
          <div key={index} style={{ height: '28px' }}>
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