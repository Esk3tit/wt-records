import { LeaderboardList } from 'wt-records'
import { Hall } from './hall'

const rows = [
  { slug: 'blitzkrieg-ace', displayName: 'BlitzkriegAce', records: 34 },
  { slug: 'red-baron-wt', displayName: 'RedBaron_WT', records: 27 },
  { slug: 'night-witch', displayName: 'NightWitch', records: 21 },
  { slug: 'steel-hunter', displayName: 'SteelHunter', records: 14 },
  { slug: 'gaijin-goose', displayName: 'GaijinGoose', records: 9 },
]

export function StandingsWithMedals() {
  return (
    <Hall>
      <div className="glass-mid w-[26rem] overflow-hidden">
        <LeaderboardList rows={rows} medals />
      </div>
    </Hall>
  )
}

export function PlainRanks() {
  return (
    <Hall>
      <div className="glass-mid w-[26rem] overflow-hidden">
        <LeaderboardList rows={rows.slice(0, 3)} />
      </div>
    </Hall>
  )
}

export function Empty() {
  return (
    <Hall>
      <div className="glass-mid w-[26rem] overflow-hidden">
        <LeaderboardList rows={[]} />
      </div>
    </Hall>
  )
}
