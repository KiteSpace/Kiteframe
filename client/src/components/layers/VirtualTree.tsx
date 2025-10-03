import * as ReactWindow from 'react-window';

// Extract FixedSizeList from the module
const FixedSizeList = (ReactWindow as any).FixedSizeList as React.ComponentType<any>;

export function VirtualTree({ rows, Row }:{ rows:any[], Row:(p:any)=>JSX.Element }){
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