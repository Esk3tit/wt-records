// Share-card tokens: the DESIGN.md system frozen for a 1200×630 night-only
// raster (embeds sit on dark chrome). No card-local color forks — one set here.

// Typography — the two locked faces (family names only; the buffers load in the
// renderer). Saira: square HUD numerals + names. Golos: Cyrillic-native prose.
export const SAIRA = 'Saira'
export const GOLOS = 'Golos Text'

export const COLOR = {
  amber: '#F0B94A',
  amberGlow: 'rgba(240,185,74,0.18)',
  night: '#0A0C10',
  // The scene's depth gradient reads as Night Hangar lit from above.
  nightHi: '#151b24',
  nightLo: '#06080b',
  amberClear: 'rgba(240,185,74,0)', // the amber glow's transparent stop
  // Ink ramp. Informational text stays ≥0.7 alpha (the card legibility floor at
  // Discord's ~432px render); faint is for brand chrome only, never data.
  ink: 'rgba(255,255,255,0.96)',
  inkSoft: 'rgba(255,255,255,0.78)',
  inkFaint: 'rgba(255,255,255,0.52)',
  hairline: 'rgba(255,255,255,0.16)',
  hairlineSoft: 'rgba(255,255,255,0.09)',
  glassHighlight: 'rgba(255,255,255,0.22)',
  ringTrack: 'rgba(255,255,255,0.12)', // completion-ring remainder
  well: 'rgba(12,15,20,0.86)', // recessed disc inside the ring
  frostFaint: 'rgba(255,255,255,0.04)', // medallion frame fills
  frostFainter: 'rgba(255,255,255,0.03)',
} as const

// The scene backdrop and the amber Record-Monument glow, composed from tokens.
export const SCENE_GRADIENT = `linear-gradient(150deg, ${COLOR.nightHi} 0%, ${COLOR.night} 55%, ${COLOR.nightLo} 100%)`
export const AMBER_GLOW = `radial-gradient(circle at 40% 60%, ${COLOR.amberGlow}, ${COLOR.amberClear} 68%)`

export const RADIUS = {
  card: 22,
  panel: 26,
  chip: 8,
  pill: 999,
} as const

// The full DESIGN.md glass anatomy: top-lit fill, hairline, inset Glass
// Highlight, ambient float shadow, and the backdrop blur the scene bleeds through.
export const glassPanel = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.05))',
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.panel,
  boxShadow: `inset 0 1.5px 0 ${COLOR.glassHighlight}, 0 32px 64px -32px rgba(0,0,0,0.85)`,
  backdropFilter: 'blur(44px) saturate(175%)',
} as const

export const glassChip = {
  display: 'flex',
  background: 'rgba(255,255,255,0.07)',
  border: `1px solid ${COLOR.hairlineSoft}`,
  borderRadius: RADIUS.chip,
} as const
