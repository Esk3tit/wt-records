/* Verbatim slices of the datamine at game version 2.57.1.49, trimmed to the
   fields the adapter reads — real wpcost entries carry ~60 more. */

export const DATAMINE_VERSION = '2.57.1.49\n'

export interface FixtureWpcostUnit {
  country: string
  rank: number
  economicRankArcade: number
  economicRankHistorical: number
  economicRankSimulation: number
  costGold?: number
  researchType?: string
  event?: string
}

// `economicRankMax` is a scalar sibling of the unit keys — not a unit.
export const WPCOST: Record<string, FixtureWpcostUnit | number> = {
  economicRankMax: 41,
  us_m1_abrams: {
    country: 'country_usa',
    rank: 7,
    economicRankArcade: 29,
    economicRankHistorical: 29,
    economicRankSimulation: 29,
  },
  germ_flakpanzer_IV_Wirbelwind: {
    country: 'country_germany',
    rank: 3,
    economicRankArcade: 9,
    economicRankHistorical: 8,
    economicRankSimulation: 8,
  },
  ussr_t_35: {
    country: 'country_ussr',
    rank: 1,
    economicRankArcade: 1,
    economicRankHistorical: 1,
    economicRankSimulation: 1,
    costGold: 2100,
  },
  ussr_object_775: {
    country: 'country_ussr',
    rank: 6,
    economicRankArcade: 25,
    economicRankHistorical: 25,
    economicRankSimulation: 25,
  },
  nt_mig_23mld: {
    country: 'country_ussr',
    rank: 7,
    economicRankArcade: 31,
    economicRankHistorical: 31,
    economicRankSimulation: 29,
  },
  'f-5e_fcu_thailand': {
    country: 'country_japan',
    rank: 7,
    economicRankArcade: 32,
    economicRankHistorical: 31,
    economicRankSimulation: 32,
    researchType: 'clanVehicle',
  },
  mosquito_f_mk2_norway: {
    country: 'country_sweden',
    rank: 3,
    economicRankArcade: 8,
    economicRankHistorical: 8,
    economicRankSimulation: 8,
  },
  tu_95m: {
    country: 'country_ussr',
    rank: 6,
    economicRankArcade: 22,
    economicRankHistorical: 22,
    economicRankSimulation: 22,
    event: 'nuclear_thunder',
  },
  b5n2: {
    country: 'country_japan',
    rank: 1,
    economicRankArcade: 0,
    economicRankHistorical: 1,
    economicRankSimulation: 2,
  },
  tiger_uht: {
    country: 'country_germany',
    rank: 7,
    economicRankArcade: 27,
    economicRankHistorical: 35,
    economicRankSimulation: 29,
  },
  us_sc_497: {
    country: 'country_usa',
    rank: 2,
    economicRankArcade: 4,
    economicRankHistorical: 4,
    economicRankSimulation: 4,
  },
  // scripted: country_invisible, yet fully shop-named and priced
  uav_quadcopter: {
    country: 'country_usa',
    rank: 7,
    economicRankArcade: 29,
    economicRankHistorical: 29,
    economicRankSimulation: 29,
    costGold: 9270,
  },
  us_m8_scott_snowball: {
    country: 'country_usa',
    rank: 1,
    economicRankArcade: 1,
    economicRankHistorical: 1,
    economicRankSimulation: 1,
  },
  // scripted: killstreak, also shop-named and economy-complete
  ucav_mq_1_predator_usa_killstreak: {
    country: 'country_usa',
    rank: 7,
    economicRankArcade: 29,
    economicRankHistorical: 29,
    economicRankSimulation: 29,
  },
  // scripted: an infantry weapon, no shop-name entry
  ak_74m: {
    country: 'country_ussr',
    rank: 7,
    economicRankArcade: 29,
    economicRankHistorical: 29,
    economicRankSimulation: 29,
  },
}

export interface FixtureUnittagsUnit {
  operatorCountry?: string
  tags: Record<string, boolean>
}

/* Alongside the `type_*` tags every unit carries country and hull tags, which
   the adapter must ignore. */
const tags = (...names: Array<string>): Record<string, boolean> =>
  Object.fromEntries(names.map((n) => [n, true]))

export const UNITTAGS: Record<string, FixtureUnittagsUnit> = {
  us_m1_abrams: {
    operatorCountry: 'country_usa_modern',
    tags: tags('country_usa', 'tank', 'type_medium_tank'),
  },
  germ_flakpanzer_IV_Wirbelwind: {
    tags: tags('country_germany', 'tank', 'type_spaa'),
  },
  ussr_t_35: { tags: tags('country_ussr', 'tank', 'type_heavy_tank') },
  // the modifier sorts first alphabetically — precedence must still pick the class
  ussr_object_775: {
    tags: tags('country_ussr', 'tank', 'type_missile_tank', 'type_tank_destroyer'),
  },
  nt_mig_23mld: {
    tags: tags('country_ussr', 'air', 'type_fighter', 'type_jet_fighter'),
  },
  'f-5e_fcu_thailand': {
    operatorCountry: 'country_thailand',
    tags: tags('country_japan', 'air', 'type_fighter', 'type_jet_fighter'),
  },
  mosquito_f_mk2_norway: {
    operatorCountry: 'country_norway',
    tags: tags('country_sweden', 'air', 'type_aa_fighter', 'type_fighter'),
  },
  tu_95m: {
    tags: tags(
      'country_ussr',
      'air',
      'type_bomber',
      'type_jet_bomber',
      'type_longrange_bomber',
    ),
  },
  b5n2: {
    tags: tags(
      'country_japan',
      'air',
      'type_bomber',
      'type_naval_aircraft',
      'type_torpedo',
    ),
  },
  tiger_uht: {
    operatorCountry: 'country_germany_modern',
    tags: tags(
      'country_germany',
      'air',
      'type_attack_helicopter',
      'type_utility_helicopter',
    ),
  },
  us_sc_497: {
    tags: tags(
      'country_usa',
      'ship',
      'type_boat',
      'type_heavy_boat',
      'type_submarine_chaser',
    ),
  },
  uav_quadcopter: {
    operatorCountry: 'country_invisible',
    tags: tags('country_usa', 'air', 'type_fighter'),
  },
  us_m8_scott_snowball: {
    operatorCountry: 'country_invisible',
    tags: tags('country_usa', 'tank', 'type_tank_destroyer'),
  },
  ucav_mq_1_predator_usa_killstreak: {
    operatorCountry: 'country_invisible',
    tags: tags('country_usa', 'air', 'type_assault', 'type_strike_ucav'),
  },
  ak_74m: {
    tags: tags('country_ussr', 'type_human', 'type_human_assault'),
  },
}

/* Semicolon-separated, every field double-quoted; the real file carries ~40
   locale columns and every non-`_shop` key the game uses. */
export const UNITS_CSV = [
  '"<ID|readonly|noverify>";"<English>";"<French>"',
  '"us_m1_abrams_shop";"M1 Abrams";"M1 Abrams"',
  '"us_m1_abrams_0";"Tank, Combat, Full Tracked";"..."',
  '"germ_flakpanzer_IV_Wirbelwind_shop";"Wirbelwind";"Wirbelwind"',
  '"ussr_t_35_shop";"T-35";"T-35"',
  '"ussr_object_775_shop";"Object 775";"Objet 775"',
  '"nt_mig_23mld_shop";"MiG-23MLD";"MiG-23MLD"',
  '"f-5e_fcu_thailand_shop";"▄F-5E FCU";"▄F-5E FCU"',
  '"mosquito_f_mk2_norway_shop";"◢Mosquito F.Mk.II";"◢Mosquito F.Mk.II"',
  '"tu_95m_shop";"Tu-95M";"Tu-95M"',
  '"b5n2_shop";"B5N2";"B5N2"',
  '"tiger_uht_shop";"EC-665 Tiger UHT";"EC-665 Tiger UHT"',
  '"us_sc_497_shop";"SC-497";"SC-497"',
  '"uav_quadcopter_shop";"UAV Raven\'s Eye";"UAV Raven\'s Eye"',
  '"us_m8_scott_snowball_shop";"Snowballer";"Snowballer"',
  '"ucav_mq_1_predator_usa_killstreak_shop";"MQ-1";"MQ-1"',
].join('\n')
