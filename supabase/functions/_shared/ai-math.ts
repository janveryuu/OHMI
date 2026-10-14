import { parseAnalysis } from './ai-core.ts';

export function resolveAnalysisCurrents(payload:unknown) {
  const parsed=parseAnalysis(payload);
  const currents=new Map<string,number>();const original:{text:string;field:string}[]=[];
  const walk=(value:unknown,field='analysis'):unknown=>{
    if(typeof value==='string'){
      original.push({text:value,field});
      const expanded=value.replace(/\{\{led_current_mA:\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\}\}(?:\s*mA\b)?/g,(_marker,supply,drop,resistance)=>{
        const volts=Number(supply),forward=Number(drop),ohms=Number(resistance);
        if(![volts,forward,ohms].every(Number.isFinite)||volts<0||volts>1000||forward<0||forward>volts||ohms<=0||ohms>1e9)throw new Error('AI current calculation has invalid or missing ratings. Retry with clear values.');
        const current=(volts-forward)/ohms*1000;
        if(!Number.isFinite(current))throw new Error('AI current calculation is out of bounds.');
        currents.set(`${volts},${forward},${ohms}`,current);
        if(currents.size>16)throw new Error('Too many current calculations for one assignment.');
        return `${Number(current.toPrecision(6))} mA`;
      });
      if(expanded.includes('{{led_current_mA:'))throw new Error('AI current calculation has unresolved ratings. Retry with clear values.');
      return expanded;
    }
    if(Array.isArray(value))return value.map((item,index)=>walk(item,`${field}[${index}]`));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,walk(item,`${field}.${key}`)]));
    return value;
  };
  const result=parseAnalysis(walk(parsed));
  for(const {text,field} of original){
    if(!/LED|diode|current|kuryente/i.test(text))continue;
    // Check structured expected results; prose elsewhere mixes ratings and wiring labels.
    if(!field.startsWith('analysis.expectedResults'))continue;
    for(const match of text.matchAll(/([+\-−]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*(mA|A|milliamps?|milliamperes?|amps?|amperes?)\b/gi)){
      const before=text.slice(Math.max(0,match.index!-40),match.index);const after=text.slice(match.index!+match[0].length);
      if(/\b(?:max(?:imum)?|rated|rating|limit|stated|required|given)\s*(?:(?:current|kuryente)\s*)?(?:(?:of|is|at|na|ay|:)\s*)?(?:(?:approximately|approx\.?|typically|about)\s*)?[([]?\s*$/i.test(before)||/^\s*[([]?\s*(?:LED(?:[\x27’]s)?\s*)?(?:max(?:imum)?|rating|rated|limit)/i.test(after))continue;
      const raw=match[1]!.replace('−','-');const unit=match[2]!.toLowerCase();
      // A alone can be a breadboard label, rather than a current unit.
      if(unit==='a'&&!/\b(?:current|amps?|amperes?|draws?|flows?|calculated|kuryente)\b|I\s*=/i.test(text))continue;
      const scale=unit==='ma'||unit.startsWith('milli')?1:1000;const claimed=Number(raw)*scale;
      if(claimed===0&&/off|LOW|patay/i.test(text))continue;
      const decimals=raw.split(/[eE]/)[0]!.split('.')[1]?.length??0;const exponent=Number(raw.split(/[eE]/)[1]??0);
      const tolerance=10**(exponent-decimals)/2*scale+1e-9;
      if(/(?:below|under|less than|within)\s*(?:the\s*)?$/i.test(before)&&currents.size&&[...currents.values()].every(value=>value<=claimed+tolerance))continue;
      if(![...currents.values()].some(value=>Math.abs(value-claimed)<=tolerance)){
        console.warn(JSON.stringify({validation:'analysis_current',field,reason:currents.size?'inconsistent_current':'missing_calculation',ratingNearby:/max|rating|rated|stated|required/i.test(before+after.slice(0,30)),calculationCount:currents.size,roleWords:(before+' '+after.slice(0,40)).match(/\b(?:max|maximum|rating|rated|stated|required|current|within|under|below|limit|of|at|nominal|LED|calculated|approx)\b/gi)?.slice(0,12)}));
        throw new Error(`AI current claim is inconsistent: ${Number(claimed.toPrecision(6))} mA; calculated ${[...currents.values()].slice(0,3).map(value=>Number(value.toPrecision(6))).join(', ')||'unavailable'} mA. Retry with clear source values.`);
      }
    }
  }
  if(currents.size&&result.assumptions.length<30)result.assumptions.push('Current figures are arithmetic estimates from extracted values, not measurements or electrical verification.');
  return result;
}
