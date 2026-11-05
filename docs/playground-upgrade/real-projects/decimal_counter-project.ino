// Low-current common-cathode decimal counter; seven 2.2 kOhm segment resistors.
const int SEGMENTS[] = {2,3,4,5,6,7,8};
const int DIGITS[] = {9,10};
const int BUTTONS[] = {11,12};
const int PATTERNS[] = {63,6,91,79,102,109,125,7,127,111};
const int MIN_COUNT = 0;
const int MAX_COUNT = 99;
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
}