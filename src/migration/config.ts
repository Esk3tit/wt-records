/* Per-mode migration source description. The community keeps one spreadsheet
   per mode; GRB is the first (and so far only) one migrated. */
export interface MigrationModeConfig {
  mode: string
  spreadsheetId: string
  /** Tab title → canonical nation slug (matches `nations.slug`). */
  nationTabs: Readonly<Record<string, string>>
  leaderboardTab: string
  dataSheetTab: string
}

const GRB: MigrationModeConfig = {
  mode: 'grb',
  spreadsheetId: '1MJEjscVDZ1hgU7fHp6dB0levgh6rnpXwOlI7fTBXly0',
  nationTabs: {
    USA: 'usa',
    Germany: 'germany',
    USSR: 'ussr',
    Britain: 'britain',
    Japan: 'japan',
    China: 'china',
    Italy: 'italy',
    France: 'france',
    Sweden: 'sweden',
    Israel: 'israel',
  },
  leaderboardTab: 'Leaderboard',
  dataSheetTab: 'DataSheet',
}

const CONFIGS = new Map<string, MigrationModeConfig>([['grb', GRB]])

export function modeFromArgv(argv: ReadonlyArray<string>): string {
  return argv.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'grb'
}

export function migrationConfig(mode: string): MigrationModeConfig {
  const config = CONFIGS.get(mode)
  if (!config) {
    throw new Error(
      `No migration config for mode "${mode}" (have: ${[...CONFIGS.keys()].join(', ')})`,
    )
  }
  return config
}
