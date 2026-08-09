// Which pending migrations invert the approval order: a column or table the
// old build still names disappears the moment this applies. See docs/deploy.md.
// Deliberately over-inclusive — a spurious warning costs a read, a missed one
// costs an outage.

import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

// ALTER TABLE makes COLUMN optional and allows IF EXISTS, so anchoring on the
// noun misses `DROP image_url`. Anchor on DROP instead and exclude the
// ALTER COLUMN sub-actions, which take something away from a column without
// taking the column away.
// EXECUTE builds its statement at runtime, so nothing here can read it. Treated
// as destructive on principle — the exception is a trigger naming its function,
// which executes something already defined rather than composing new DDL.
const DYNAMIC = /\bEXECUTE\s+(?!FUNCTION\b|PROCEDURE\b)/i

const DESTRUCTIVE =
  /\bDROP\s+(?!DEFAULT\b|NOT\s+NULL\b|IDENTITY\b|EXPRESSION\b)["\w]|\bRENAME\b/i

// Sticky, so a tag can be matched at an offset without slicing the rest of the
// file at every character. lastIndex is set immediately before each use.
const DOLLAR_TAG = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/y
const WORD = /[A-Za-z0-9_]/

/**
 * Blank out everything that isn't executable SQL — comments, and the contents
 * of quoted regions, so a `--` sitting inside a string can't swallow the
 * statement after it. Ambiguity resolves toward keeping text as code, since
 * over-reporting a drop is the harmless direction.
 */
export function stripSqlComments(sql) {
  let out = ''
  let i = 0

  // Backslash escapes a quote only in E'…'; in a standard string it is literal,
  // and treating it as an escape there would run past the real close. The E has
  // to touch the quote — `E '…'` is an identifier beside an ordinary string.
  const opensEscapeString = () => {
    const k = out.length - 1
    const last = out[k]
    if (last !== 'e' && last !== 'E') return false
    const before = out[k - 1]
    return before === undefined || !WORD.test(before)
  }

  const skipQuoted = (quote, escapes) => {
    i += 1
    while (i < sql.length) {
      if (escapes && sql[i] === '\\') {
        i += 2
        continue
      }
      if (sql[i] === quote) {
        if (sql[i + 1] === quote) {
          i += 2
          continue
        }
        i += 1
        return
      }
      i += 1
    }
  }

  while (i < sql.length) {
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1
      out += ' '
      continue
    }

    // Postgres block comments nest, so track depth rather than find the first close.
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let depth = 1
      i += 2
      while (i < sql.length && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth += 1
          i += 2
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth -= 1
          i += 2
        } else i += 1
      }
      out += ' '
      continue
    }

    // Dollar quoting wraps DO blocks and function bodies, not just inert data,
    // so the contents are scanned rather than discarded.
    let tag
    if (sql[i] === '$') {
      DOLLAR_TAG.lastIndex = i
      tag = DOLLAR_TAG.exec(sql)?.[0]
    }
    if (tag) {
      const end = sql.indexOf(tag, i + tag.length)
      const stop = end === -1 ? sql.length : end
      out += ` ${stripSqlComments(sql.slice(i + tag.length, stop))} `
      i = end === -1 ? sql.length : end + tag.length
      continue
    }

    if (sql[i] === "'" || sql[i] === '"') {
      const identifier = sql[i] === '"'
      skipQuoted(sql[i], !identifier && opensEscapeString())
      // A quoted identifier still occupies its slot in the grammar — blanking it
      // would turn `DROP "col"` into a bare `DROP` and hide the statement.
      out += identifier ? ' _ ' : ' '
      continue
    }

    out += sql[i]
    i += 1
  }

  return out
}

export function isDestructive(sql) {
  const code = stripSqlComments(sql)
  return DESTRUCTIVE.test(code) || DYNAMIC.test(code)
}

export function destructiveAmong(files) {
  return files.filter((f) => isDestructive(f.sql)).map((f) => basename(f.name))
}

// Full URL, not the basename: the CLI branch blocks reading stdin, so an
// unrelated entry script sharing this filename must not trigger it on import.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // NUL-delimited on stdin: a path is free to contain whitespace or glob
  // characters, and the shell must not get a say in either.
  const paths = readFileSync(0, 'utf8').split('\0').filter(Boolean)
  const hits = destructiveAmong(
    paths.map((name) => ({ name, sql: readFileSync(name, 'utf8') })),
  )
  if (hits.length) console.log(hits.join(' '))
}
