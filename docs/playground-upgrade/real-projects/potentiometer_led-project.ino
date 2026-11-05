// Arduino Uno Adjustable LED Brightness with Potentiometer
const int POT_PIN = A0;  // Potentiometer wiper on analog pin A0
const int LED_PIN = 9;   // Red LED connected to PWM pin D9

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int potValue = analogRead(POT_PIN);              // Read analog value 0 to 1023
  int brightness = map(potValue, 0, 1023, 0, 255); // Map to PWM duty cycle 0 to 255
  analogWrite(LED_PIN, brightness);                // Output PWM brightness smoothly
  delay(10);
}