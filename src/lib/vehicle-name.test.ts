import { describe, expect, it } from 'vitest'
import { displayVehicleName } from '#/lib/vehicle-name'

describe('displayVehicleName', () => {
  it('strips leading marker glyphs', () => {
    expect(displayVehicleName('␗T-72M1')).toBe('T-72M1')
    expect(displayVehicleName('◊BMD-4M')).toBe('BMD-4M')
    expect(displayVehicleName('■M24')).toBe('M24')
    expect(displayVehicleName('▀Tiger II (H)')).toBe('Tiger II (H)')
    expect(displayVehicleName('⋠P-47M-1-RE')).toBe('P-47M-1-RE')
  })

  it('leaves ordinary names untouched', () => {
    expect(displayVehicleName('15cm sIG 33 B Sfl')).toBe('15cm sIG 33 B Sfl')
    expect(displayVehicleName('E.B.R. (1963)')).toBe('E.B.R. (1963)')
    expect(displayVehicleName('Strv m/31')).toBe('Strv m/31')
  })

  it('never returns an empty string', () => {
    expect(displayVehicleName('◊')).toBe('◊')
  })
})
