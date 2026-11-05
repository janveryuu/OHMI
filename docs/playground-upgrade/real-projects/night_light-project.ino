// Arduino Uno Automatic Night Light (LDR Photoresistor)
const int LDR_PIN = A0;          // Voltage divider ambient light reading
const int LED_PIN = 9;           // White night light LED
const int DARK_THRESHOLD = 500;  // Threshold (>500 is dark, <=500 is bright)

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int lightLevel = analogRead(LDR_PIN);
  
  // Turn ON LED when ambient light drops below threshold (darkness)
  if (lightLevel > DARK_THRESHOLD) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(100);
}