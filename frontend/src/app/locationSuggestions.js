import { normalizeSearchText, normalizeSearchTokens } from '../utils/searchText.js'

const TURKEY_PROVINCES = [
  'Adana',
  'Adiyaman',
  'Afyonkarahisar',
  'Agri',
  'Amasya',
  'Ankara',
  'Antalya',
  'Artvin',
  'Aydin',
  'Balikesir',
  'Bilecik',
  'Bingol',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Canakkale',
  'Cankiri',
  'Corum',
  'Denizli',
  'Diyarbakir',
  'Edirne',
  'Elazig',
  'Erzincan',
  'Erzurum',
  'Eskisehir',
  'Gaziantep',
  'Giresun',
  'Gumushane',
  'Hakkari',
  'Hatay',
  'Isparta',
  'Mersin',
  'Istanbul',
  'Izmir',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kirklareli',
  'Kirsehir',
  'Kocaeli',
  'Konya',
  'Kutahya',
  'Malatya',
  'Manisa',
  'Kahramanmaras',
  'Mardin',
  'Mugla',
  'Mus',
  'Nevsehir',
  'Nigde',
  'Ordu',
  'Rize',
  'Sakarya',
  'Samsun',
  'Siirt',
  'Sinop',
  'Sivas',
  'Tekirdag',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Sanliurfa',
  'Usak',
  'Van',
  'Yozgat',
  'Zonguldak',
  'Aksaray',
  'Bayburt',
  'Karaman',
  'Kirikkale',
  'Batman',
  'Sirnak',
  'Bartin',
  'Ardahan',
  'Igdir',
  'Yalova',
  'Karabuk',
  'Kilis',
  'Osmaniye',
  'Duzce',
]

const IGNORED_REGION_CODES = new Set([
  'AC',
  'CP',
  'CQ',
  'DG',
  'EA',
  'EU',
  'EZ',
  'FX',
  'IC',
  'SU',
  'TA',
  'UN',
])

function buildAllCountryNames() {
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
    return []
  }

  let regionDisplayNames = null

  try {
    regionDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return []
  }

  const countries = new Set()
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  for (let firstIndex = 0; firstIndex < letters.length; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < letters.length; secondIndex += 1) {
      const code = `${letters[firstIndex]}${letters[secondIndex]}`
      if (IGNORED_REGION_CODES.has(code)) {
        continue
      }

      const countryName = regionDisplayNames.of(code)

      if (!countryName || countryName === code || /\bUnknown\b/i.test(countryName)) {
        continue
      }

      countries.add(countryName)
    }
  }

  return [...countries].sort((left, right) => left.localeCompare(right))
}

function buildLocationSuggestions() {
  const provinceEntries = TURKEY_PROVINCES.map((city) => ({
    city,
    country: 'Turkey',
    kind: 'city',
  }))

  const countryEntries = buildAllCountryNames().map((country) => ({
    city: '',
    country,
    kind: 'country',
  }))

  return [...provinceEntries, ...countryEntries]
}

function getSuggestionLabel(item) {
  if (!item.city) {
    return item.country
  }

  return `${item.city}, ${item.country}`
}

function scoreSuggestion(item, normalizedQuery) {
  const city = normalizeSearchText(item.city || '', { trim: false })
  const country = normalizeSearchText(item.country || '', { trim: false })
  const label = normalizeSearchText(getSuggestionLabel(item), { trim: false })

  if (city && city.startsWith(normalizedQuery)) {
    return 0
  }

  if (country.startsWith(normalizedQuery)) {
    return 1
  }

  if (label.startsWith(normalizedQuery)) {
    return 2
  }

  return 3
}

export const locationSuggestions = buildLocationSuggestions()

export function findLocationSuggestions(query) {
  const normalizedQuery = normalizeSearchText(query)

  if (normalizedQuery.length < 2) {
    return []
  }

  const queryTokens = normalizeSearchTokens(query)

  return locationSuggestions
    .filter((item) => {
      const label = normalizeSearchText(getSuggestionLabel(item), { trim: false })
      return queryTokens.every((token) => label.includes(token))
    })
    .sort((left, right) => {
      const leftScore = scoreSuggestion(left, normalizedQuery)
      const rightScore = scoreSuggestion(right, normalizedQuery)

      if (leftScore !== rightScore) {
        return leftScore - rightScore
      }

      return getSuggestionLabel(left).localeCompare(getSuggestionLabel(right))
    })
    .slice(0, 20)
}
