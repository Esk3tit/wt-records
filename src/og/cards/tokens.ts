/* Share-card design tokens — the DESIGN.md system frozen into the fixed values a
   1200×630 raster needs. Cards render in one lighting state (night): embeds sit
   on dark chrome, and Medal Amber reads loudest there. No card-local color
   forks — these are the committed tokens. */

// Typography — the two locked faces (family names only; the buffers load in the
// renderer). Saira: square HUD numerals + names. Golos: Cyrillic-native prose.
export const SAIRA = 'Saira'
export const GOLOS = 'Golos Text'

export const COLOR = {
  amber: '#F0B94A',
  amberGlow: 'rgba(240,185,74,0.18)',
  night: '#0A0C10',
  // Ink ramp. Informational text stays ≥0.7 alpha (the card legibility floor at
  // Discord's ~432px render); faint is for brand chrome only, never data.
  ink: 'rgba(255,255,255,0.96)',
  inkSoft: 'rgba(255,255,255,0.78)',
  inkFaint: 'rgba(255,255,255,0.52)',
  hairline: 'rgba(255,255,255,0.16)',
  hairlineSoft: 'rgba(255,255,255,0.09)',
  glassHighlight: 'rgba(255,255,255,0.22)',
} as const

export const RADIUS = {
  card: 22,
  panel: 26,
  chip: 8,
  pill: 999,
} as const

/* The full DESIGN.md glass anatomy in one style object: white-alpha fill (top-lit
   gradient), 1px hairline, the inset Glass Highlight top edge, a deep ambient
   float shadow, and the backdrop blur+saturate that lets the scene bleed
   through. */
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
