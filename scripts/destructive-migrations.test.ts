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
