import type { CircuitIntent, GeneratedCircuit } from "./circuit-generator.ts";
import { validateCircuitSpec, type CircuitSpec } from "./circuit-spec.ts";
import { validateElectronicsDocument } from "./electronics-document.ts";

// Native seg7_cc uses the SC56-11EWA-compatible mapping, not arbitrary display packages.
export const SEGMENT_PINS = [7, 6, 4, 2, 1, 9, 10];
export function generateDecimalCounter(intent: CircuitIntent): GeneratedCircuit {
  const title = "Two-digit decimal up/down counter";
  const range = intent.rawPrompt.match(/\b(\d+)\s*(?:to|[-–])\s*(\d+)\b/i);
  const minimum = range ? Number(range[1]) : 0, maximum = range ? Number(range[2]) : 99;
  if (minimum < 0 || maximum > 99 || minimum >= maximum) throw new Error("The qualified two-digit decimal range must stay within 00–99.");
  const sketch = `// Low-current common-cathode decimal counter; seven 2.2 kOhm segment resistors.
const int SEGMENTS[] = {2,3,4,5,6,7,8};
const int DIGITS[] = {9,10};
const int BUTTONS[] = {11,12};
const int PATTERNS[] = {63,6,91,79,102,109,125,7,127,111};
const int MIN_COUNT = ${minimum};
const int MAX_COUNT = ${maximum};
int count = MIN_COUNT;
int lastReading[] = {HIGH,HIGH};
int stableReading[] = {HIGH,HIGH};
unsigned long changedAt[] = {0,0};
int activeDigit = 0;

void setup() {
  for(int i=0;i<7;i++){ pinMode(SEGMENTS[i],OUTPUT); digitalWrite(SEGMENTS[i],LOW); }
  for(int i=0;i<2;i++){
    pinMode(DIGITS[i],OUTPUT); digitalWrite(DIGITS[i],HIGH);
    pinMode(BUTTONS[i],INPUT_PULLUP);
  }
  Serial.begin(9600);
  Serial.println(count);
}

void loop() {
  bool edge[] = {false,false};
  for(int i=0;i<2;i++){
    int reading = digitalRead(BUTTONS[i]);
    if(reading != lastReading[i]){ changedAt[i]=millis(); lastReading[i]=reading; }
    if(millis()-changedAt[i]>=30 && stableReading[i]!=reading){
      stableReading[i]=reading; edge[i]=(reading==LOW);
    }
  }
  int previous=count;
  // Simultaneous presses are ignored; a held button produces only one edge.
  if(edge[0] && stableReading[1]!=LOW && count<MAX_COUNT) count++;
  if(edge[1] && stableReading[0]!=LOW && count>MIN_COUNT) count--;
  if(previous!=count) Serial.println(count);
  // Blank both commons before updating segments to prevent ghosting.
  digitalWrite(DIGITS[0],HIGH); digitalWrite(DIGITS[1],HIGH);
  int numeral = activeDigit==0 ? count/10 : count%10;
  int mask=PATTERNS[numeral];
  for(int s=0;s<7;s++) digitalWrite(SEGMENTS[s],(mask & (1<<s)) ? HIGH : LOW);
  digitalWrite(DIGITS[activeDigit],LOW);
  delay(2);
  activeDigit=1-activeDigit;
}`;
  const parts: CircuitSpec["parts"] = [
    {id:"uno",type:"arduino_uno",properties:[],sketch},
    ...[0,1].map(i=>({id:"digit"+i,type:"seg7_cc" as const,properties:[{key:"color",value:"Red"}],sketch:""})),
    ...SEGMENT_PINS.map((_,i)=>({id:"r"+i,type:"resistor" as const,properties:[{key:"resistance",value:"2200"}],sketch:""})),
    ...["add","subtract"].map(id=>({id,type:"pushbutton" as const,properties:[],sketch:""})),
  ];
  const connections: CircuitSpec["connections"] = [];
  const connect=(a:string,pin:string,b:string,target:string)=>connections.push({from:{part:a,pin},to:{part:b,pin:target}});
  SEGMENT_PINS.forEach((pin,i)=>{
    connect("uno","D"+(i+2),"r"+i,"pin0");
    for(let digit=0;digit<2;digit++)connect("r"+i,"pin1","digit"+digit,"pin"+pin);
  });
  for(let digit=0;digit<2;digit++)for(const pin of [3,8])connect("digit"+digit,"pin"+pin,"uno","D"+(9+digit));
  ["add","subtract"].forEach((id,i)=>{connect("uno","D"+(11+i),id,"pin1");connect(id,"pin2","uno","GND");});
  const warnings = ["Material change: use two red common-cathode SC56-11EWA-compatible displays and seven 2.2 kΩ segment resistors. The activity's four 1 kΩ resistors are insufficient for this design. Decimal points are unused; verify the actual display pinout. Low current reduces brightness."];
  const spec=validateCircuitSpec({version:1,status:"draft",title,explanation:`Two-digit decimal counting ${minimum}–${maximum}, clamped, debounced and multiplexed. Native checks run before opening.`,warnings,parts,connections});
  const ids=new Map(parts.map((part,i)=>[part.id,i+1]));
  const document=validateElectronicsDocument({format:"designElectronics",version:1,title,parts:parts.map((part,i)=>({id:i+1,type:part.type,label:part.id,props:Object.fromEntries(part.properties.map(p=>[p.key,p.value])),code:part.sketch,views:{breadboard:{at:[i*1200,0]},schematic:{at:[i*1200,0]},pcb:{at:[i*1200,0]}}})),wires:connections.flatMap((wire,i)=>["breadboard","schematic"].map((view,j)=>({id:100+i*2+j,view,from:{part:ids.get(wire.from.part),pin:wire.from.pin},to:{part:ids.get(wire.to.part),pin:wire.to.pin},points:[[0,0],[100,100]]})))});
  return {id:crypto.randomUUID(),title,tag:"Uno · 2 CC displays · 7 × 2.2 kΩ · 2 debounced buttons",promptText:intent.rawPrompt,wiring:[{label:"Display and safety",detail:warnings[0]},{label:"Segment mapping",detail:"a,b,c,d,e,f,g: display pins 7,6,4,2,1,9,10, through 2.2 kΩ to Uno D2–D8."},{label:"Digit and button mapping",detail:"Digit commons 3/8 to D9/D10; increment/decrement opposite button contacts to D11/D12 and GND."}],arduinoCode:sketch,document,spec,intent};
}
