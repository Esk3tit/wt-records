// Which pending migrations invert the approval order: a column or table the
// old build still names disappears the moment this applies. See docs/deploy.md.
// Deliberately over-inclusive — a spurious warning costs a read, a missed one
// costs an outage.

import { basename } from 'node:path'
import { readFileSync } from 'node:fs'

const DESTRUCTIVE = /\bDROP\s+(?:COLUMN|TABLE)\b|\bRENAME\b/i

/** Comments describe drops as often as statements perform them. */
export function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

export function isDestructive(sql) {
  return DESTRUCTIVE.test(stripSqlComments(sql))
}

export function destructiveAmong(files) {
  return files.filter((f) => isDestructive(f.sql)).map((f) => basename(f.name))
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const paths = process.argv.slice(2)
  const hits = destructiveAmong(
    paths.map((name) => ({ name, sql: readFileSync(name, 'utf8') })),
  )
  if (hits.length) console.log(hits.join(' '))
}
