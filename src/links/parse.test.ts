import { describe, expect, it } from 'vitest'
import {
  fieldPrefix,
  fieldValue,
  parseLinkValue,
  platformName,
  previewLinkUrl,
} from '#/links/parse'
import { PLATFORMS, WEBSITE_PLATFORM } from '#/links/platforms'

/* The field's promise is certainty: the prefix is welded on as static text and
   the constructed URL is shown beneath it as it is typed, so a pasted URL looks
   wrong on screen before it is ever submitted. That promise is only kept if the
   owner's own field runs the same parser the server will — which is what this
   module is for, and what these assert. */

describe('what the field would publish, as it is typed', () => {
  it('is the URL the server would construct, not a guess at it', () => {
    expect(previewLinkUrl('youtube', 'PhlyDaily')).toBe(
      'https://www.youtube.com/@PhlyDaily',
    )
    expect(previewLinkUrl('website', 'phlydaily.example')).toBe(
      'https://phlydaily.example',
    )
  })

  it('is null while the value is not yet a link, rather than a half-built one', () => {
    expect(previewLinkUrl('youtube', '')).toBeNull()
    expect(previewLinkUrl('youtube', 'ab')).toBeNull()
    expect(previewLinkUrl('website', 'not a url')).toBeNull()
    // Nothing partial ever renders: a preview that showed a prefix with no
    // handle would read as a link to the platform's own front page.
    expect(previewLinkUrl('youtube', '@')).toBeNull()
  })

  it('shows a pasted URL resolving to the same place, so the paste is not punished', () => {
    expect(previewLinkUrl('youtube', 'https://m.youtube.com/@PhlyDaily')).toBe(
      'https://www.youtube.com/@PhlyDaily',
    )
  })

  // The preview is what makes the welded prefix worth anything: a redirector
  // pasted into the field has to visibly fail to become a link.
  it('shows nothing for the measured redirectors', () => {
    expect(
      previewLinkUrl(
        'youtube',
        'https://youtube.com/redirect?q=https://evil.com',
      ),
    ).toBeNull()
    expect(
      previewLinkUrl('website', 'https://evil.com/?next=https://x.com'),
    ).toBeNull()
  })

  it('refuses a slot nobody configured, however it is asked', () => {
    expect(previewLinkUrl('kick', 'phlydaily')).toBeNull()
    expect(previewLinkUrl('constructor', 'phlydaily')).toBeNull()
    expect(() => parseLinkValue('kick', 'phlydaily')).toThrow(
      /cannot add that one here/,
    )
  })
})

describe('what belongs in the field, given what is stored', () => {
  /* Every named platform stores the bare handle that sits under its prefix, so
     the stored value IS the field value. The personal site stores the whole
     canonical URL, whose scheme the prefix is also drawing — seeding it raw
     reads `https://https://…`. */
  it('strips only the scheme the personal site’s prefix already draws', () => {
    expect(fieldValue('website', 'https://phlydaily.example/shop')).toBe(
      'phlydaily.example/shop',
    )
    expect(fieldValue('youtube', 'PhlyDaily')).toBe('PhlyDaily')
    expect(fieldValue('website', '')).toBe('')
  })

  it('round-trips: what the field shows, re-parsed, is what was stored', () => {
    for (const stored of [
      'https://phlydaily.example',
      'https://phlydaily.example/shop',
    ]) {
      const shown = fieldValue(WEBSITE_PLATFORM, stored)
      expect(parseLinkValue(WEBSITE_PLATFORM, shown).handle).toBe(stored)
    }
  })
})

describe('what the field calls itself', () => {
  it('names every slot in the config’s own words', () => {
    for (const p of PLATFORMS) {
      expect(platformName(p.id)).toBe(p.name)
      expect(fieldPrefix(p.id)).toBe(p.fieldPrefix)
    }
    expect(platformName(WEBSITE_PLATFORM)).toBe('Personal site')
    expect(fieldPrefix(WEBSITE_PLATFORM)).toBe('https://')
  })

  // A label is rendered to the owner, so an unknown slot must degrade to
  // something harmless rather than to `undefined`.
  it('degrades to the id for a slot nobody configured', () => {
    expect(platformName('kick')).toBe('kick')
    expect(fieldPrefix('kick')).toBe('')
  })
})
