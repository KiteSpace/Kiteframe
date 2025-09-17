import { FixedSizeList } from 'react-window';
export function VirtualTree({ rows, Row }:{ rows:any[], Row:(p:any)=>JSX.Element }){
  return <FixedSizeList height={520} itemCount={rows.length} itemSize={28} width={'100%'}>
    {({index, style}) => <div style={style}><Row {...rows[index]} /></div>}
  </FixedSizeList>;
}