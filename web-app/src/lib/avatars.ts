export const AVATAR_IDS = [
  "cowboy",
  "engineer",
  "professor",
  "astronaut",
  "gamer",
  "detective",
  "scientist",
  "ninja",
  "pilot",
  "royal",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export interface AvatarItem {
  id: AvatarId;
  name: string;
  role: string;
  description: string;
  src: string;
  pngSrc: string;
}

export const AVATARS: readonly AvatarItem[] = [
  {
    id: "cowboy",
    name: "Cowboy OHMI",
    role: "Trailblazer",
    description: "Ready to round up circuit bugs and blaze new trails across electronics.",
    src: "/app/avatars/cowboy.webp",
    pngSrc: "/app/avatars/cowboy.png",
  },
  {
    id: "engineer",
    name: "Engineer OHMI",
    role: "Master Builder",
    description: "Equipped with blueprints and hardhat to assemble clean, reliable breadboards.",
    src: "/app/avatars/engineer.webp",
    pngSrc: "/app/avatars/engineer.png",
  },
  {
    id: "professor",
    name: "Professor OHMI",
    role: "Academic Mentor",
    description: "Guiding learners through Ohm’s law, formulas, and deep electronics theory.",
    src: "/app/avatars/professor.webp",
    pngSrc: "/app/avatars/professor.png",
  },
  {
    id: "astronaut",
    name: "Astronaut OHMI",
    role: "Cosmic Explorer",
    description: "Venture beyond the atmosphere and explore circuits with stellar curiosity.",
    src: "/app/avatars/astronaut.webp",
    pngSrc: "/app/avatars/astronaut.png",
  },
  {
    id: "gamer",
    name: "Gamer OHMI",
    role: "Pixel Champ",
    description: "Leveling up your technical skills and defeating bugs with high performance.",
    src: "/app/avatars/gamer.webp",
    pngSrc: "/app/avatars/gamer.png",
  },
  {
    id: "detective",
    name: "Detective OHMI",
    role: "Diagnostic Sleuth",
    description: "Investigating voltage drops, shorts, and mysterious wiring clues.",
    src: "/app/avatars/detective.webp",
    pngSrc: "/app/avatars/detective.png",
  },
  {
    id: "scientist",
    name: "Scientist OHMI",
    role: "Lab Visionary",
    description: "Running controlled experiments and testing new hypothesis with precision.",
    src: "/app/avatars/scientist.webp",
    pngSrc: "/app/avatars/scientist.png",
  },
  {
    id: "ninja",
    name: "Ninja OHMI",
    role: "Stealth Fixer",
    description: "Striking down circuit errors silently and routing wires with swift agility.",
    src: "/app/avatars/ninja.webp",
    pngSrc: "/app/avatars/ninja.png",
  },
  {
    id: "pilot",
    name: "Pilot OHMI",
    role: "Sky Navigator",
    description: "Taking your electronics projects to new heights with steady guidance.",
    src: "/app/avatars/pilot.webp",
    pngSrc: "/app/avatars/pilot.png",
  },
  {
    id: "royal",
    name: "Royal OHMI",
    role: "Crown Sovereign",
    description: "Reigning with regal elegance and setting gold standards in circuit craft.",
    src: "/app/avatars/royal.webp",
    pngSrc: "/app/avatars/royal.png",
  },
] as const;

export function isValidAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && AVATAR_IDS.includes(value as AvatarId);
}

export function getAvatar(id?: string | null): AvatarItem | undefined {
  if (!id) return undefined;
  return AVATARS.find((avatar) => avatar.id === id);
}

export function resolveAvatarSrc(id?: string | null): string | undefined {
  const avatar = getAvatar(id);
  return avatar ? avatar.src : undefined;
}
