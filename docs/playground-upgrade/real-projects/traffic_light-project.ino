// Arduino Uno Automatic Traffic Light (Green 5s -> Yellow 2s -> Red 5s)
const int RED_PIN = 8;
const int YELLOW_PIN = 9;
const int GREEN_PIN = 10;

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
}

void loop() {
  // Stage 1: Green Light ON for 5 seconds (Only Green ON)
  digitalWrite(GREEN_PIN, HIGH);
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(RED_PIN, LOW);
  delay(5000);

  // Stage 2: Yellow Light ON for 2 seconds (Only Yellow ON)
  digitalWrite(GREEN_PIN, LOW);
  digitalWrite(YELLOW_PIN, HIGH);
  digitalWrite(RED_PIN, LOW);
  delay(2000);

  // Stage 3: Red Light ON for 5 seconds (Only Red ON)
  digitalWrite(GREEN_PIN, LOW);
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(RED_PIN, HIGH);
  delay(5000);
}