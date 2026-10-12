export type Preferences = {
  language: 'english' | 'filipino' | 'taglish';
  animations: boolean;
  appearance: 'light' | 'dark';
};

export type Motion = 'idle' | 'happy' | 'thinking';
export type Section = 'home' | 'chat' | 'assignments' | 'guide' | 'check' | 'settings';

export function readPreferences(value: unknown): Preferences {
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    language: saved.language === 'filipino' || saved.language === 'taglish' ? saved.language : 'english',
    animations: typeof saved.animations === 'boolean' ? saved.animations : true,
    appearance: saved.appearance === 'dark' ? 'dark' : 'light',
  };
}

export function demoReply(language: Preferences['language']): string {
  return {
    english: 'A resistor limits current through an LED. Choose its value using the supply voltage, the LED’s forward voltage, and its target current. This fixed example explains the concept; it does not inspect your circuit.',
    filipino: 'Nililimitahan ng resistor ang kuryenteng dumadaloy sa LED. Piliin ang halaga nito ayon sa boltahe ng supply, forward voltage ng LED, at target na current. Halimbawa lamang ito; hindi nito sinusuri ang circuit mo.',
    taglish: 'Ang resistor ang nagli-limit ng current sa LED. Piliin ang value based sa supply voltage, LED forward voltage, at target current. Fixed example lang ito; hindi nito chine-check ang circuit mo.',
  }[language];
}

export const GUIDE_STEPS = [
  { title: 'Gather your parts', text: 'For this example, place a breadboard, an LED, a 220 Ω resistor, and a 5 V source. Component ratings still matter; this is a learning sample.', tip: 'Start with a small circuit you can explain.' },
  { title: 'Find the LED polarity', text: 'Identify the LED’s anode and cathode using its markings or documentation. In this sample, current goes from the supply through the resistor and LED to ground.', tip: 'An LED is directional. Check its polarity before wiring.' },
  { title: 'Add the series resistor', text: 'Put the resistor in series with the LED, rather than across it. Connect one end of the path to the source and the other to ground.', tip: 'A series resistor limits the current through the LED.' },
  { title: 'Review each connection', text: 'Trace the path from supply to resistor, LED, and ground. Check breadboard row connections and make sure the supply is not shorted.', tip: 'Explain each wire’s purpose before simulating.' },
  { title: 'Simulate and reflect', text: 'Start Tinkercad’s simulation yourself. Look for warnings, observe the LED, and explain what would change if the resistance increased.', tip: 'OHMI has not read or verified your actual circuit.' },
] as const;
