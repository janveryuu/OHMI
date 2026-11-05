// Arduino Uno 8-LED Running Lights with 74HC595 Shift Register
const int LATCH_PIN = 8;  // ST_CP (pin 12 on 74HC595)
const int DATA_PIN = 11;  // DS (pin 14 on 74HC595)
const int CLOCK_PIN = 12; // SH_CP (pin 11 on 74HC595)

void setup() {
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
}

void updateShiftRegister(byte leds) {
  digitalWrite(LATCH_PIN, LOW);
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, leds);
  digitalWrite(LATCH_PIN, HIGH);
}

void loop() {
  // Light up one at a time from left to right
  for (int i = 0; i < 8; i++) {
    updateShiftRegister(1 << i);
    delay(120);
  }
  // Reverse direction (from right to left)
  for (int i = 6; i > 0; i--) {
    updateShiftRegister(1 << i);
    delay(120);
  }
}