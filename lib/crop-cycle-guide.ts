/**
 * India-centric indicative crop calendar for dealers/farmers UI.
 * Not a substitute for local extension / weather / soil-specific advice.
 */

export const CROP_CYCLE_GUIDE_DISCLAIMER =
  'These sowing windows and tips are representative for India and vary by state, soil, irrigation, and weather. Confirm with local agronomy or department advisory before critical decisions.';

export type CropGuideCategory =
  | 'cereal'
  | 'pulse'
  | 'oilseed'
  | 'fiber'
  | 'vegetable'
  | 'spice'
  | 'other';

export type SeasonTag = 'KHARIF' | 'RABI' | 'ZAID';

export interface CropGuideSeasonWindow {
  season: SeasonTag;
  /** Inclusive calendar months (1–12) for typical sowing/transplant start */
  sowingStartMonth: number;
  sowingEndMonth: number;
  approxHarvestDaysMin: number;
  approxHarvestDaysMax: number;
  /** Short label shown in UI */
  sowingLabel: string;
}

export interface CropGuideEntry {
  key: string;
  displayName: string;
  displayNameHi?: string;
  category: CropGuideCategory;
  aliases: string[];
  seasons: CropGuideSeasonWindow[];
  transplantNote?: string;
  bestPractices: string[];
  commonProblems: string[];
}

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function sowingLabel(start: number, end: number): string {
  return `${monthNames[start - 1]}–${monthNames[end - 1]}`;
}

export const CROP_GUIDE_ENTRIES: CropGuideEntry[] = [
  {
    key: 'rice',
    displayName: 'Rice (Paddy)',
    displayNameHi: 'Dhan / Chawal',
    category: 'cereal',
    aliases: ['paddy', 'dhan', 'chawal', 'rice'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 110,
        approxHarvestDaysMax: 140,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    transplantNote: 'Nursery Jun–Jul; transplant ~21–30 days after sowing.',
    bestPractices: [
      'Maintain 2–5 cm standing water after transplant during tillering as per variety.',
      'Split N: basal + tillering + panicle initiation per soil test.',
      'Watch blast & BPH — scout weekly during humid weeks.',
    ],
    commonProblems: [
      'Blast on leaves/neck; bacterial leaf blight.',
      'Brown plant hopper (BPH) in stagnant humid patches.',
      'Zinc deficiency on alkaline soils — pale midribs.',
    ],
  },
  {
    key: 'wheat',
    displayName: 'Wheat',
    displayNameHi: 'Gehu',
    category: 'cereal',
    aliases: ['gehu', 'wheat', 'kanak'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 11,
        sowingEndMonth: 12,
        approxHarvestDaysMin: 110,
        approxHarvestDaysMax: 140,
        sowingLabel: sowingLabel(11, 12),
      },
    ],
    bestPractices: [
      'Timely sowing before soil gets too cold; seed rate per variety/hybrid.',
      'NPK + sulphur on deficient soils; avoid excess late N for lodging.',
      'Irrigate at crown root, tillering, flowering, milk stages if rainfed gap.',
    ],
    commonProblems: [
      'Rust (yellow/brown); powdery mildew in dense stands.',
      'Terminal heat stress if late sowing — shorter grain filling.',
      'Weeds:Phalaris / wild oats — use recommended herbicide timing.',
    ],
  },
  {
    key: 'maize',
    displayName: 'Maize',
    displayNameHi: 'Makka',
    category: 'cereal',
    aliases: ['makka', 'corn', 'maize'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 85,
        approxHarvestDaysMax: 105,
        sowingLabel: sowingLabel(6, 7),
      },
      {
        season: 'RABI',
        sowingStartMonth: 11,
        sowingEndMonth: 1,
        approxHarvestDaysMin: 90,
        approxHarvestDaysMax: 110,
        sowingLabel: 'Nov–Jan',
      },
    ],
    bestPractices: [
      'Maintain optimum population; thin if overcrowded.',
      'Critical water: knee-high, tasseling/silking.',
      'Border rows help pollination in small plots.',
    ],
    commonProblems: [
      'Stem borer dead-heart; fall armyworm outbreaks.',
      'Iron deficiency chlorosis on calcareous soils.',
      'Poor grain set if moisture stress at silking.',
    ],
  },
  {
    key: 'bajra',
    displayName: 'Pearl millet (Bajra)',
    displayNameHi: 'Bajra',
    category: 'cereal',
    aliases: ['bajra', 'pearl millet'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 75,
        approxHarvestDaysMax: 95,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    bestPractices: [
      'Drill on moisture line; avoid deep sowing on heavy soils.',
      'Low seed rate vs sorghum — avoid overcrowding.',
      'Drought-tolerant but responds to split light showers.',
    ],
    commonProblems: [
      'Downy mildew (green ear); ergot in humid flowering.',
      'White grub on sandy soils.',
    ],
  },
  {
    key: 'jowar',
    displayName: 'Sorghum (Jowar)',
    displayNameHi: 'Jowar',
    category: 'cereal',
    aliases: ['jowar', 'sorghum'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 100,
        approxHarvestDaysMax: 120,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    bestPractices: [
      'Thin to optimum spacing for fodder vs grain-type varieties.',
      'First irrigation critical if soil cracks after emergence.',
    ],
    commonProblems: [
      'Shoot fly dead-heart in early stage.',
      'Anthracnose / rust in susceptible hybrids.',
    ],
  },
  {
    key: 'barley',
    displayName: 'Barley',
    displayNameHi: 'Jau',
    category: 'cereal',
    aliases: ['barley', 'jau'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 11,
        sowingEndMonth: 12,
        approxHarvestDaysMin: 110,
        approxHarvestDaysMax: 130,
        sowingLabel: sowingLabel(11, 12),
      },
    ],
    bestPractices: [
      'Earlier sowing than wheat in very cold areas — follow local window.',
      'Lower water than wheat; avoid waterlogging.',
    ],
    commonProblems: ['Net blotch; stripe rust in cool humid stretches.'],
  },
  {
    key: 'gram',
    displayName: 'Chickpea (Gram)',
    displayNameHi: 'Chana',
    category: 'pulse',
    aliases: ['chana', 'gram', 'chickpea', 'besan crop'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 130,
        approxHarvestDaysMax: 160,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    bestPractices: [
      'Preferred on lighter soils with good drainage.',
      'Rhizobium / phosphorus emphasis; avoid excess irrigation.',
    ],
    commonProblems: [
      'Pod borer complex — monitor flowering onwards.',
      'Wilt (Fusarium) — long rotations, tolerant varieties.',
    ],
  },
  {
    key: 'tur',
    displayName: 'Pigeon pea (Tur / Arhar)',
    displayNameHi: 'Tur / Arhar',
    category: 'pulse',
    aliases: ['tur', 'arhar', 'pigeon pea', 'red gram'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 150,
        approxHarvestDaysMax: 180,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    bestPractices: [
      'Deep-rooted — conserve moisture; gap-fill gaps early.',
      'Long-duration crop — plan spray windows for pod fly.',
    ],
    commonProblems: [
      'Sterility mosaic; Phytophthora blight in waterlogged pockets.',
      'Pod borer / pod fly near maturity.',
    ],
  },
  {
    key: 'moong',
    displayName: 'Green gram (Moong)',
    displayNameHi: 'Moong',
    category: 'pulse',
    aliases: ['moong', 'green gram', 'mung'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 7,
        sowingEndMonth: 8,
        approxHarvestDaysMin: 65,
        approxHarvestDaysMax: 75,
        sowingLabel: sowingLabel(7, 8),
      },
      {
        season: 'ZAID',
        sowingStartMonth: 3,
        sowingEndMonth: 4,
        approxHarvestDaysMin: 60,
        approxHarvestDaysMax: 70,
        sowingLabel: sowingLabel(3, 4),
      },
    ],
    bestPractices: [
      'Short duration — avoid delayed sowing in heat.',
      'Minimal irrigation except pulse stages if spring crop.',
    ],
    commonProblems: ['Yellow mosaic virus; pod bug near maturity.'],
  },
  {
    key: 'urad',
    displayName: 'Black gram (Urad)',
    displayNameHi: 'Urad',
    category: 'pulse',
    aliases: ['urad', 'black gram', 'udad'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 7,
        sowingEndMonth: 8,
        approxHarvestDaysMin: 75,
        approxHarvestDaysMax: 90,
        sowingLabel: sowingLabel(7, 8),
      },
    ],
    bestPractices: ['Similar to moong; avoid water stagnation.'],
    commonProblems: ['Leaf curl virus; anthracnose in humid weather.'],
  },
  {
    key: 'masoor',
    displayName: 'Lentil (Masoor)',
    displayNameHi: 'Masoor',
    category: 'pulse',
    aliases: ['masoor', 'lentil'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 110,
        approxHarvestDaysMax: 130,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    bestPractices: ['Cool season; avoid heavy wet soils.'],
    commonProblems: ['Rust; Ascochyta blight with prolonged leaf wetness.'],
  },
  {
    key: 'groundnut',
    displayName: 'Groundnut',
    displayNameHi: 'Moongphali / Mungfali',
    category: 'oilseed',
    aliases: ['groundnut', 'peanut', 'moongphali', 'mungfali'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 105,
        approxHarvestDaysMax: 125,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    bestPractices: [
      'Calcium availability matters for kernel filling — gypsum where advised.',
      'Aflatoxin risk — harvest promptly; dry kernels properly.',
    ],
    commonProblems: [
      'Late leaf spot / rust in humid kharif.',
      'Stem rot if drainage poor.',
    ],
  },
  {
    key: 'mustard',
    displayName: 'Mustard (Rapeseed)',
    displayNameHi: 'Sarson',
    category: 'oilseed',
    aliases: ['mustard', 'sarson', 'rapeseed', 'canola'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 110,
        approxHarvestDaysMax: 130,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    bestPractices: [
      'Thin spacing vs wheat; sulphur often beneficial.',
      'Avoid excess N — lodging.',
    ],
    commonProblems: [
      'Alternaria blight; white rust.',
      'Aphid buildup in warm late season.',
    ],
  },
  {
    key: 'soybean',
    displayName: 'Soybean',
    displayNameHi: 'Soya',
    category: 'oilseed',
    aliases: ['soybean', 'soya'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 95,
        approxHarvestDaysMax: 115,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    bestPractices: [
      'Rhizobium inoculation; Mo responsive on acidic soils.',
      'Moisture stress at pod filling crashes yield.',
    ],
    commonProblems: [
      'Rust; cercospora leaf blight.',
      'Girdle beetle damage near maturity.',
    ],
  },
  {
    key: 'sunflower',
    displayName: 'Sunflower',
    displayNameHi: 'Surajmukhi',
    category: 'oilseed',
    aliases: ['sunflower', 'surajmukhi'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 7,
        sowingEndMonth: 8,
        approxHarvestDaysMin: 85,
        approxHarvestDaysMax: 100,
        sowingLabel: sowingLabel(7, 8),
      },
      {
        season: 'RABI',
        sowingStartMonth: 11,
        sowingEndMonth: 1,
        approxHarvestDaysMin: 90,
        approxHarvestDaysMax: 105,
        sowingLabel: 'Nov–Jan',
      },
    ],
    bestPractices: ['Bird damage near maturity — collective scaring or netting where feasible.'],
    commonProblems: ['Alternaria; powdery mildew; capitulum caterpillar.'],
  },
  {
    key: 'sesame',
    displayName: 'Sesame (Til)',
    displayNameHi: 'Til',
    category: 'oilseed',
    aliases: ['sesame', 'til'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 7,
        sowingEndMonth: 8,
        approxHarvestDaysMin: 85,
        approxHarvestDaysMax: 95,
        sowingLabel: sowingLabel(7, 8),
      },
    ],
    bestPractices: ['Light soils; avoid waterlogging; harvest when capsules split timing critical.'],
    commonProblems: ['Phyllody / leaf hopper; charcoal rot in wet feet.'],
  },
  {
    key: 'castor',
    displayName: 'Castor',
    displayNameHi: 'Arandi',
    category: 'oilseed',
    aliases: ['castor', 'arandi'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 7,
        sowingEndMonth: 8,
        approxHarvestDaysMin: 140,
        approxHarvestDaysMax: 180,
        sowingLabel: sowingLabel(7, 8),
      },
    ],
    bestPractices: ['Spacing by hybrid; ratoon systems where practiced locally.'],
    commonProblems: ['Leaf hopper; capsule borer.'],
  },
  {
    key: 'cotton',
    displayName: 'Cotton (Kapas)',
    displayNameHi: 'Kapas',
    category: 'fiber',
    aliases: ['cotton', 'kapas', 'bt cotton'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 5,
        sowingEndMonth: 6,
        approxHarvestDaysMin: 150,
        approxHarvestDaysMax: 180,
        sowingLabel: sowingLabel(5, 6),
      },
    ],
    bestPractices: [
      'Follow approved Bt refuge norms where applicable.',
      'Nutrition & growth regulators per stage-wise advisory.',
    ],
    commonProblems: [
      'Pink bollworm / sucking pest complexes.',
      'Leaf reddening — nutrient or moisture stress diagnosis needed.',
    ],
  },
  {
    key: 'potato',
    displayName: 'Potato',
    displayNameHi: 'Aloo',
    category: 'vegetable',
    aliases: ['potato', 'aloo'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 90,
        approxHarvestDaysMax: 110,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    transplantNote: 'Usually planted from tuber seed pieces; earthing-up twice typical.',
    bestPractices: [
      'Certified seed tubers; fungicide dusting where recommended.',
      'Blight scouting — protectant sprays before humid spells.',
    ],
    commonProblems: [
      'Late blight in cool humid pockets.',
      'Aphid / virus complexes.',
    ],
  },
  {
    key: 'onion',
    displayName: 'Onion',
    displayNameHi: 'Pyaz',
    category: 'vegetable',
    aliases: ['onion', 'pyaz'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 11,
        sowingEndMonth: 12,
        approxHarvestDaysMin: 140,
        approxHarvestDaysMax: 160,
        sowingLabel: sowingLabel(11, 12),
      },
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 110,
        approxHarvestDaysMax: 130,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    transplantNote: 'Nursery → transplant common for rabi bulbs.',
    bestPractices: [
      'Stop irrigation before harvest sizing/bulbing phase per variety.',
      'Thrips management early.',
    ],
    commonProblems: ['Purple blotch; basal rot if drainage poor.'],
  },
  {
    key: 'tomato',
    displayName: 'Tomato',
    displayNameHi: 'Tamatar',
    category: 'vegetable',
    aliases: ['tomato', 'tamatar'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 11,
        sowingEndMonth: 1,
        approxHarvestDaysMin: 120,
        approxHarvestDaysMax: 140,
        sowingLabel: 'Nov–Jan',
      },
      {
        season: 'ZAID',
        sowingStartMonth: 2,
        sowingEndMonth: 3,
        approxHarvestDaysMin: 100,
        approxHarvestDaysMax: 120,
        sowingLabel: sowingLabel(2, 3),
      },
    ],
    transplantNote: 'Nursery 25–35 days; transplant with hardened seedlings.',
    bestPractices: [
      'Stake / mulch for quality fruit.',
      'Ca & K balance helps blossom-end rot control.',
    ],
    commonProblems: [
      'Early / late blight; leaf curl virus (whitefly).',
      'Fruit borer near ripening.',
    ],
  },
  {
    key: 'brinjal',
    displayName: 'Brinjal (Eggplant)',
    displayNameHi: 'Baingan',
    category: 'vegetable',
    aliases: ['brinjal', 'eggplant', 'baingan'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 130,
        approxHarvestDaysMax: 150,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    transplantNote: 'Nursery sow → transplant after 4–5 true leaves.',
    bestPractices: ['Rotate solanaceae; virus-free nursery stock.'],
    commonProblems: [
      'Shoot & fruit borer — IPM traps + timely sprays.',
      'Little leaf / phytoplasma in endemic pockets.',
    ],
  },
  {
    key: 'okra',
    displayName: 'Okra (Bhindi)',
    displayNameHi: 'Bhindi',
    category: 'vegetable',
    aliases: ['okra', 'bhindi', 'lady finger'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 45,
        approxHarvestDaysMax: 55,
        sowingLabel: sowingLabel(6, 7),
      },
      {
        season: 'ZAID',
        sowingStartMonth: 2,
        sowingEndMonth: 3,
        approxHarvestDaysMin: 45,
        approxHarvestDaysMax: 55,
        sowingLabel: sowingLabel(2, 3),
      },
    ],
    bestPractices: ['Repeated picks — harvest every 2 days in peak.'],
    commonProblems: ['Yellow vein mosaic virus (whitefly); jassids.'],
  },
  {
    key: 'cabbage',
    displayName: 'Cabbage',
    displayNameHi: 'Bandh gobi',
    category: 'vegetable',
    aliases: ['cabbage', 'bandh gobi'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 90,
        approxHarvestDaysMax: 110,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    transplantNote: 'Transplant from nursery.',
    bestPractices: ['Uniform moisture; split boron if deficiency symptoms.'],
    commonProblems: ['Diamond-back moth; black rot in wet weather.'],
  },
  {
    key: 'cauliflower',
    displayName: 'Cauliflower',
    displayNameHi: 'Phool gobi',
    category: 'vegetable',
    aliases: ['cauliflower', 'phool gobi'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 90,
        approxHarvestDaysMax: 115,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    transplantNote: 'Temperature-sensitive curding — match variety group to sowing slot.',
    bestPractices: ['Blanch curds if needed; boron for hollow stem prevention.'],
    commonProblems: ['Club root on acidic soils; soft rot if drainage poor.'],
  },
  {
    key: 'chilli',
    displayName: 'Chilli',
    displayNameHi: 'Mirchi',
    category: 'vegetable',
    aliases: ['chilli', 'mirchi', 'chili'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 160,
        approxHarvestDaysMax: 190,
        sowingLabel: sowingLabel(6, 7),
      },
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 150,
        approxHarvestDaysMax: 180,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    transplantNote: 'Long-duration — nursery timing critical.',
    bestPractices: ['Micronutrient foliars if deficiency; mites/thrips scouting.'],
    commonProblems: ['Thrips & mites; viral complexes; anthracnose on fruit.'],
  },
  {
    key: 'cucumber',
    displayName: 'Cucumber',
    displayNameHi: 'Kheera',
    category: 'vegetable',
    aliases: ['cucumber', 'kheera'],
    seasons: [
      {
        season: 'ZAID',
        sowingStartMonth: 2,
        sowingEndMonth: 4,
        approxHarvestDaysMin: 45,
        approxHarvestDaysMax: 60,
        sowingLabel: sowingLabel(2, 4),
      },
    ],
    bestPractices: ['Trellis for quality; frequent light irrigation.'],
    commonProblems: ['Downy mildew; fruit flies near ripe fruit.'],
  },
  {
    key: 'bottle_gourd',
    displayName: 'Bottle gourd',
    displayNameHi: 'Lauki',
    category: 'vegetable',
    aliases: ['bottle gourd', 'lauki', 'doodhi'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 90,
        approxHarvestDaysMax: 110,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    bestPractices: ['Bee activity matters — avoid over-spraying during flowering.'],
    commonProblems: ['Powdery mildew; fruit fly sting.'],
  },
  {
    key: 'bitter_gourd',
    displayName: 'Bitter gourd',
    displayNameHi: 'Karela',
    category: 'vegetable',
    aliases: ['bitter gourd', 'karela'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 6,
        sowingEndMonth: 7,
        approxHarvestDaysMin: 55,
        approxHarvestDaysMax: 70,
        sowingLabel: sowingLabel(6, 7),
      },
    ],
    bestPractices: ['Trellis recommended; repeated picks.'],
    commonProblems: ['Powdery mildew; fruit fly.'],
  },
  {
    key: 'green_pea',
    displayName: 'Garden pea',
    displayNameHi: 'Matar',
    category: 'vegetable',
    aliases: ['pea', 'matar', 'green pea'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 90,
        approxHarvestDaysMax: 110,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    bestPractices: ['Cool season; support if vine type.'],
    commonProblems: ['Powdery mildew; root rot if wet.'],
  },
  {
    key: 'coriander',
    displayName: 'Coriander',
    displayNameHi: 'Dhaniya',
    category: 'spice',
    aliases: ['coriander', 'dhaniya', 'cilantro'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 35,
        approxHarvestDaysMax: 45,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    bestPractices: ['Light irrigation; thin overcrowded stands.'],
    commonProblems: ['Powdery mildew; aphids.'],
  },
  {
    key: 'garlic',
    displayName: 'Garlic',
    displayNameHi: 'Lahsun',
    category: 'spice',
    aliases: ['garlic', 'lahsun'],
    seasons: [
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 130,
        approxHarvestDaysMax: 150,
        sowingLabel: sowingLabel(10, 11),
      },
    ],
    bestPractices: ['Clove planting depth uniform; stop irrigation before maturity.'],
    commonProblems: ['Purple blotch; stemphylium leaf blight.'],
  },
  {
    key: 'turmeric',
    displayName: 'Turmeric',
    displayNameHi: 'Haldi',
    category: 'spice',
    aliases: ['turmeric', 'haldi'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 5,
        sowingEndMonth: 6,
        approxHarvestDaysMin: 270,
        approxHarvestDaysMax: 300,
        sowingLabel: sowingLabel(5, 6),
      },
    ],
    transplantNote: 'Rhizome bits / mother rhizomes — bed preparation critical.',
    bestPractices: ['Heavy organic matter; shade in establishment where practiced.'],
    commonProblems: ['Rhizome rot if drainage poor; leaf blotch diseases.'],
  },
  {
    key: 'ginger',
    displayName: 'Ginger',
    displayNameHi: 'Adrak',
    category: 'spice',
    aliases: ['ginger', 'adrak'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 4,
        sowingEndMonth: 5,
        approxHarvestDaysMin: 240,
        approxHarvestDaysMax: 270,
        sowingLabel: sowingLabel(4, 5),
      },
    ],
    bestPractices: ['Mulch + drainage balance; partial shade in hills.'],
    commonProblems: ['Rhizome fly / bacterial wilt complexes — region-specific.'],
  },
  {
    key: 'sugarcane',
    displayName: 'Sugarcane',
    displayNameHi: 'Ganna',
    category: 'other',
    aliases: ['sugarcane', 'ganna'],
    seasons: [
      {
        season: 'KHARIF',
        sowingStartMonth: 2,
        sowingEndMonth: 3,
        approxHarvestDaysMin: 300,
        approxHarvestDaysMax: 365,
        sowingLabel: 'Feb–Mar (spring)',
      },
      {
        season: 'RABI',
        sowingStartMonth: 10,
        sowingEndMonth: 11,
        approxHarvestDaysMin: 320,
        approxHarvestDaysMax: 380,
        sowingLabel: 'Oct–Nov (adsali regions)',
      },
    ],
    bestPractices: [
      'Region-specific planting seasons — confirm local factory calendar.',
      'Ratoon vs plant crop economics.',
    ],
    commonProblems: [
      'Early shoot borer; top borer.',
      'Red rot / smut — certified seed material.',
    ],
  },
];

export const CATEGORY_LABELS: Record<CropGuideCategory, string> = {
  cereal: 'Cereals',
  pulse: 'Pulses',
  oilseed: 'Oilseeds',
  fiber: 'Fiber',
  vegetable: 'Vegetables',
  spice: 'Spices',
  other: 'Other',
};

export function normalizeCropQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function lookupCropGuide(query: string): CropGuideEntry | undefined {
  const n = normalizeCropQuery(query);
  if (!n) return undefined;
  return CROP_GUIDE_ENTRIES.find((e) => {
    if (e.key === n) return true;
    if (normalizeCropQuery(e.displayName) === n) return true;
    return e.aliases.some((a) => {
      const an = normalizeCropQuery(a);
      return an === n || n.includes(an) || an.includes(n);
    });
  });
}

export function getSeasonWindow(
  entry: CropGuideEntry,
  season: SeasonTag,
): CropGuideSeasonWindow | undefined {
  return entry.seasons.find((s) => s.season === season);
}

/** Representative month inside sowing window (handles Nov–Jan style wrap). */
function midSowingMonth(start: number, end: number): number {
  if (start <= end) return Math.round((start + end) / 2);
  const mid = Math.round((start + end + 12) / 2);
  return mid > 12 ? mid - 12 : mid;
}

function padIso(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/**
 * Suggested sowing (15th of mid sow month) and harvest (+ avg duration).
 * If sowing date is before refDate by >45 days, rolls sowing to next year when window spans year boundary logic simplified.
 */
export function suggestCycleDates(
  entry: CropGuideEntry,
  season: SeasonTag,
  refDate = new Date(),
): { sowing: string; harvest: string } {
  const w = getSeasonWindow(entry, season);
  if (!w) {
    const today = refDate.toISOString().slice(0, 10);
    const fall = new Date(refDate);
    fall.setDate(fall.getDate() + 90);
    return { sowing: today, harvest: fall.toISOString().slice(0, 10) };
  }
  const mid = midSowingMonth(w.sowingStartMonth, w.sowingEndMonth);
  let year = refDate.getFullYear();
  let sowing = new Date(year, mid - 1, 15);
  if (sowing < refDate) {
    sowing = new Date(year + 1, mid - 1, 15);
    year = year + 1;
  }
  const avgDays = Math.round((w.approxHarvestDaysMin + w.approxHarvestDaysMax) / 2);
  const harvest = new Date(sowing);
  harvest.setDate(harvest.getDate() + avgDays);
  return {
    sowing: padIso(sowing.getFullYear(), sowing.getMonth() + 1, sowing.getDate()),
    harvest: padIso(harvest.getFullYear(), harvest.getMonth() + 1, harvest.getDate()),
  };
}

export function filterCropGuide(opts: {
  search?: string;
  category?: CropGuideCategory | 'ALL';
  season?: SeasonTag | 'ALL';
}): CropGuideEntry[] {
  let list = [...CROP_GUIDE_ENTRIES];
  if (opts.category && opts.category !== 'ALL') {
    list = list.filter((e) => e.category === opts.category);
  }
  if (opts.season && opts.season !== 'ALL') {
    list = list.filter((e) => e.seasons.some((s) => s.season === opts.season));
  }
  if (opts.search?.trim()) {
    const n = normalizeCropQuery(opts.search);
    list = list.filter(
      (e) =>
        normalizeCropQuery(e.displayName).includes(n) ||
        (e.displayNameHi && normalizeCropQuery(e.displayNameHi).includes(n)) ||
        e.aliases.some((a) => normalizeCropQuery(a).includes(n)) ||
        e.key.includes(n),
    );
  }
  return list.sort((a, b) => {
    const c = a.category.localeCompare(b.category);
    if (c !== 0) return c;
    return a.displayName.localeCompare(b.displayName);
  });
}
