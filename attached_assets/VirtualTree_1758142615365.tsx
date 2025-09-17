import { FixedSizeList as List } from 'react-window';
export function VirtualTree({ rows, Row }:{ rows:any[], Row:(p:any)=>JSX.Element }){
  return <List height={520} itemCount={rows.length} itemSize={28} width={'100%'}>
    {({index, style}) => <div style={style}><Row {...rows[index]} /></div>}
  </List>;
}
