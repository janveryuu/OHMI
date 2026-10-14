import {expect,it} from 'vitest';
import {resolveAnalysisCurrents} from '../../supabase/functions/_shared/ai-math';
const fixture={title:'LED exercise',status:'ready',summary:'5 V output, 2 V LED drop, 220-ohm series resistor.',objectives:['Learn current limiting'],components:[{name:'LED',quantity:'1',details:'Maximum current 20 mA.'},{name:'220-ohm resistor',quantity:'1',details:''}],expectedResults:['LED current {{led_current_mA:5,2,220}}.'],assumptions:[],uncertainties:[],steps:[{title:'Check ratings',instruction:'Use the series resistor.',why:'Expected LED current is {{led_current_mA:5,2,220}}.',check:'Why limit current?',code:''}]};
it('computes the stated LED series current on the server',()=>{
  const result=resolveAnalysisCurrents(fixture);
  expect(result.expectedResults).toEqual(['LED current 13.6364 mA.']);
  expect(result.steps[0]?.why).toBe('Expected LED current is 13.6364 mA.');
});
it('rejects the observed inconsistent 16.8mA current before publishing a guide',()=>{
  expect(()=>resolveAnalysisCurrents({...fixture,expectedResults:['LED operating current is approximately 16.8 mA.']})).toThrow(/current.*verified|current.*inconsistent/i);
});
it('preserves explicit maximum ratings and zero off current',()=>{
  const result=resolveAnalysisCurrents({...fixture,expectedResults:['Maximum current 20 mA; calculated LED current {{led_current_mA:5,2,220}}.','LED off: 0 mA.']});
  expect(result.expectedResults).toEqual(['Maximum current 20 mA; calculated LED current 13.6364 mA.','LED off: 0 mA.']);
});
it('rejects invalid operands and unresolved markers without executing expressions',()=>{
  for(const marker of ['{{led_current_mA:5,2,0}}','{{led_current_mA:2,5,220}}','{{led_current_mA:5,2,process.env}}','{{led_current_mA:5,unknown,220}}'])expect(()=>resolveAnalysisCurrents({...fixture,expectedResults:[marker]})).toThrow();
});
it('leaves clarification and non-current tutorials unchanged',()=>{
  const unclear={...fixture,status:'needs_clarification',expectedResults:[],uncertainties:['Supply rating is missing'],steps:[]};
  expect(resolveAnalysisCurrents(unclear)).toEqual(unclear);
});

it('rejects a negative current claim rather than accepting its magnitude',()=>{
  expect(()=>resolveAnalysisCurrents({...fixture,expectedResults:['LED current is -13.6364 mA.']})).toThrow();
});
it('accepts harmless spaces around the explicit calculation operands',()=>{
  expect(resolveAnalysisCurrents({...fixture,expectedResults:['LED current {{led_current_mA: 5, 2, 220 }}.']}).expectedResults).toEqual(['LED current 13.6364 mA.']);
});

it('preserves ratings written as a limit of or a parenthesized LED maximum',()=>{
  const result=resolveAnalysisCurrents({...fixture,expectedResults:['The calculated current {{led_current_mA:5,2,220}} stays within the limit of 20mA.','The LED has a 20mA (LED maximum) rating.']});
  expect(result.expectedResults[0]).toContain('13.6364 mA');
});

it('does not treat a breadboard row label as an ampere claim',()=>{
  const result=resolveAnalysisCurrents({...fixture,steps:[{...fixture.steps[0]!,instruction:'Place the LED in row 5 A, keeping separate breadboard strips.'}]});
  expect(result.steps[0]?.instruction).toContain('row 5 A');
});

it('does not interpret declared rating assumptions as derived current results',()=>{
  const assumptions=['The red LED maximum rated current is approximately 20mA.'];
  expect(resolveAnalysisCurrents({...fixture,assumptions}).assumptions).toContain(assumptions[0]);
});


it('does not reinterpret rating prose in a summary as a derived expected-result claim',()=>{
  const summary='Estimated LED current is {{led_current_mA:5,2,220}}; the LED max forward current capacity is 20mA.';
  expect(resolveAnalysisCurrents({...fixture,summary}).summary).toContain('capacity is 20mA');
});
