const paths = {
  home: 'M3 10l9-7 9 7 M5 9v12h5v-7h4v7h5V9',
  chat: 'M4 4h16v12H10l-5 4v-4H4z M8 8h8 M8 12h5',
  assignments: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
  guide: 'M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4z M12 7v14',
  check: 'M3 8h5v8H3z M16 8h5v8h-5z M8 12h8 M12 3v4 M12 17v4',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  close: 'M6 6l12 12 M18 6L6 18',
  more: 'M4 6h16 M4 12h16 M4 18h16',
  send: 'M3 3l18 9-18 9 4-9z M7 12h14',
  attachment: 'M8 15l8-8a3 3 0 0 1 4 4L9 22a5 5 0 0 1-7-7L14 3a2 2 0 0 1 3 3L6 17',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6',
  done: 'M5 12l4 4L19 6',
  next: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  spark: 'M13 2L4 14h7l-1 8 10-13h-8z',
  info: 'M12 11v6 M12 7v.1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  expand: 'M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7',
  restore: 'M4 14h6v6 M20 10h-6V4 M14 10l7-7 M10 14l-7 7',
} as const;

export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
