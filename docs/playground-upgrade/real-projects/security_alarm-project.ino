// Arduino Uno Mini Security Alarm
const int BUTTON_PIN = 2; // Pushbutton on D2 (active-LOW with INPUT_PULLUP)
const int BUZZER_PIN = 8; // Alarm buzzer on D8
const int LED_PIN = 9;    // Red warning LED on D9

int lastButtonReading = HIGH;
int stableButtonReading = HIGH;
unsigned long buttonChangedAt = 0;

bool buttonPressed() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonReading) {
    buttonChangedAt = millis();
    lastButtonReading = reading;
  }
  if (millis() - buttonChangedAt >= 30) stableButtonReading = reading;
  return stableButtonReading == LOW;
}

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  // When button is pressed, D2 reads LOW
  if (buttonPressed()) {
    // Flash red LED and sound two-tone siren
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 1000); // 1 kHz tone
    delay(150);
    digitalWrite(LED_PIN, LOW);
    tone(BUZZER_PIN, 750);  // 750 Hz tone
    delay(150);
  } else {
    // Button released: stop both LED and buzzer
    digitalWrite(LED_PIN, LOW);
    noTone(BUZZER_PIN);
    digitalWrite(BUZZER_PIN, LOW);
    delay(20);
  }
}