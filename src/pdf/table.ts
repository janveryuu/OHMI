type Item={str:string;transform:number[]};
export function extractComponentTable(items:Item[]){
  const headers=items.filter(item=>/^(QTY|QUANTITY)$/i.test(item.str.trim()));
  if(headers.length!==1)return undefined;
  const qty=headers[0]!;const x=qty.transform[4]!,y=qty.transform[5]!;
  const label=items.find(item=>/^COMPONENTS?$/i.test(item.str.trim())&&Math.abs(item.transform[5]!-y)<3&&item.transform[4]!>x);
  if(!label)return undefined;
  const column=label.transform[4]!;
  const rows=items.filter(item=>/^[1-9]\d*$/.test(item.str.trim())&&item.transform[5]!<y&&item.transform[4]!>=x-3&&item.transform[4]!<column-8).sort((a,b)=>b.transform[5]!-a.transform[5]!);
  if(!rows.length||rows.length>60)return undefined;
  const result=rows.map(row=>({quantity:row.str.trim(),name:items.filter(item=>item.str.trim()&&Math.abs(item.transform[5]!-row.transform[5]!)<2&&item.transform[4]!>=column-3).sort((a,b)=>a.transform[4]!-b.transform[4]!).map(item=>item.str).join(' ').trim()}));
  return result.every(row=>row.name&&row.name.length<=120)?result:undefined;
}
