// Syntax-only check of generated core-API sketches; this is not an AVR core or hardware emulator.
enum { LOW=0, HIGH=1, INPUT=0, OUTPUT=1, INPUT_PULLUP=2, A0=14, MSBFIRST=1 };
using byte = unsigned char;
void pinMode(int, int);
void digitalWrite(int, int);
int digitalRead(int);
int analogRead(int);
void analogWrite(int, int);
void delay(unsigned long);
unsigned long millis();
long map(long, long, long, long, long);
void tone(int, unsigned int, unsigned long=0);
void noTone(int);
void shiftOut(int, int, int, byte);
struct SerialPort { void begin(long); void println(int); };
extern SerialPort Serial;
