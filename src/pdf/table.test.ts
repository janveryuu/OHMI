import {expect,it} from 'vitest';
import {extractComponentTable} from './table';
const item=(str:string,x:number,y:number)=>({str,transform:[1,0,0,1,x,y]});
it('uses actual quantity/component columns, excluding later section headings and voltage assumptions',()=>{
  const items=[item('QTY',59,480),item('COMPONENT',116,480),item('1',59,440),item('Arduino Uno R3',116,440),item('1',59,420),item('220 Ω resistor',116,420),item('2',59,400),item('Jumper wires',116,400),item('3',46,310),item('Given electrical assumptions',61,310),item('220',309,270),item('Ω',330,270),item('4',46,200),item('Student tasks',61,200)];
  expect(extractComponentTable(items)).toEqual([{name:'Arduino Uno R3',quantity:'1'},{name:'220 Ω resistor',quantity:'1'},{name:'Jumper wires',quantity:'2'}]);
  expect(extractComponentTable(items.filter(row=>row.str!=='COMPONENT'))).toBeUndefined();
});
