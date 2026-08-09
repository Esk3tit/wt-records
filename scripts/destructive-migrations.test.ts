import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain .mjs so the workflow can run it without a toolchain
import { destructiveAmong, isDestructive } from './destructive-migrations.mjs'

describe('isDestructive', () => {
  it.each([
    ['drop column', 'ALTER TABLE "vehicles" DROP COLUMN "image_url";'],
    ['drop table', 'DROP TABLE "vehicles";'],
    ['rename column', 'ALTER TABLE "t" RENAME COLUMN "a" TO "b";'],
    [
      'rename column without the optional keyword',
      'ALTER TABLE "t" RENAME "a" TO "b";',
    ],
    ['rename table', 'ALTER TABLE "t" RENAME TO "u";'],
    ['lowercase', 'alter table "t" drop column "a";'],
    ['split across lines', 'ALTER TABLE "t"\n  DROP COLUMN "a";'],
  ])('flags %s', (_, sql) => {
    expect(isDestructive(sql)).toBe(true)
  })

  it.each([
    ['add column', 'ALTER TABLE "vehicles" ADD COLUMN "portrait_url" text;'],
    ['create table', 'CREATE TABLE "t" ("id" integer);'],
    ['backfill', 'UPDATE "vehicles" SET "portrait_url" = "image_url";'],
    [
      'create index',
      'CREATE INDEX "veh_nation_idx" ON "vehicles" ("nation_id");',
    ],
  ])('leaves %s alone', (_, sql) => {
    expect(isDestructive(sql)).toBe(false)
  })

  // 0011 opens "Additive, not a rename:" — the word alone must not flag it.
  it('ignores the word in a line comment', () => {
    const sql = `-- Additive, not a rename: a rename would drop column reads mid-deploy.
ALTER TABLE "vehicles" ADD COLUMN "portrait_url" text;`
    expect(isDestructive(sql)).toBe(false)
  })

  it('ignores the word in a block comment', () => {
    expect(
      isDestructive('/* DROP COLUMN once nothing reads it */\nSELECT 1;'),
    ).toBe(false)
  })

  it('still flags a statement that follows a comment mentioning it', () => {
    const sql = `-- superseded by portrait_*
ALTER TABLE "vehicles" DROP COLUMN "image_url";`
    expect(isDestructive(sql)).toBe(true)
  })

  // A comment marker inside a literal must not swallow the statement after it.
  it.each([
    [
      'line-comment marker in a string',
      `SELECT '--'; ALTER TABLE vehicles DROP COLUMN image_url;`,
    ],
    [
      'block-comment markers in strings',
      `SELECT '/*'; ALTER TABLE vehicles DROP COLUMN image_url; SELECT '*/';`,
    ],
    [
      'marker in a dollar-quoted body',
      `SELECT $$--$$; ALTER TABLE vehicles DROP COLUMN image_url;`,
    ],
    [
      'marker in a tagged dollar-quoted body',
      `SELECT $tag$ /* $tag$; ALTER TABLE vehicles DROP COLUMN image_url;`,
    ],
    [
      'marker in a quoted identifier',
      `ALTER TABLE "od--d" DROP COLUMN "image_url";`,
    ],
    [
      'doubled quote inside a string',
      `SELECT 'it''s --'; ALTER TABLE vehicles DROP COLUMN image_url;`,
    ],
  ])('still flags DDL after a %s', (_, sql) => {
    expect(isDestructive(sql)).toBe(true)
  })

  // Dollar quoting wraps executable bodies, so their contents are code.
  it.each([
    ['a DO block', `DO $body$ BEGIN DROP TABLE vehicles; END $body$;`],
    ['an untagged DO block', `DO $$ BEGIN DROP TABLE vehicles; END $$;`],
    [
      'a function body',
      `CREATE FUNCTION f() RETURNS void AS $$ BEGIN ALTER TABLE t RENAME TO u; END $$ LANGUAGE plpgsql;`,
    ],
    [
      'a DO block whose body comments out something else',
      `DO $$ BEGIN -- keep\n DROP COLUMN x; END $$;`,
    ],
  ])('flags destructive DDL inside %s', (_, sql) => {
    expect(isDestructive(sql)).toBe(true)
  })

  it('leaves an additive DO block alone', () => {
    expect(
      isDestructive(`DO $$ BEGIN ALTER TABLE t ADD COLUMN a text; END $$;`),
    ).toBe(false)
  })

  it('does not flag DDL keywords that are only string data', () => {
    expect(isDestructive(`INSERT INTO audit VALUES ('DROP COLUMN x');`)).toBe(
      false,
    )
  })

  it('handles nested block comments', () => {
    expect(
      isDestructive('/* outer /* inner DROP COLUMN a */ still */ SELECT 1;'),
    ).toBe(false)
  })
})

describe('destructiveAmong', () => {
  it('returns basenames of only the destructive files', () => {
    expect(
      destructiveAmong([
        {
          name: 'drizzle/0011_portrait_columns.sql',
          sql: 'ALTER TABLE "v" ADD COLUMN "a" text;',
        },
        {
          name: 'drizzle/0013_drop_image_columns.sql',
          sql: 'ALTER TABLE "v" DROP COLUMN "a";',
        },
      ]),
    ).toEqual(['0013_drop_image_columns.sql'])
  })

  it('is empty when nothing is pending', () => {
    expect(destructiveAmong([])).toEqual([])
  })
})
