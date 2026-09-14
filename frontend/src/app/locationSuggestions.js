import { normalizeSearchText, normalizeSearchTokens } from '../utils/searchText.js'

const TURKEY_PROVINCES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
  'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan',
  'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta',
  'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
  'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla',
  'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt',
  'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak',
  'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman',
  'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
]

const MAJOR_WORLD_CITIES = [
  { city: 'New York', country: 'Amerika Birleşik Devletleri', aliases: ['nyc', 'new york city', 'ny'] },
  { city: 'Los Angeles', country: 'Amerika Birleşik Devletleri', aliases: ['la'] },
  { city: 'Chicago', country: 'Amerika Birleşik Devletleri', aliases: ['sikago'] },
  { city: 'San Francisco', country: 'Amerika Birleşik Devletleri', aliases: ['sf'] },
  { city: 'Washington, D.C.', country: 'Amerika Birleşik Devletleri', aliases: ['washington'] },
  { city: 'Miami', country: 'Amerika Birleşik Devletleri', aliases: [] },
  { city: 'Toronto', country: 'Kanada', aliases: [] },
  { city: 'Vancouver', country: 'Kanada', aliases: [] },
  { city: 'Londra', country: 'Birleşik Krallık', aliases: ['london', 'ingiltere', 'uk'] },
  { city: 'Manchester', country: 'Birleşik Krallık', aliases: [] },
  { city: 'Paris', country: 'Fransa', aliases: ['fransa'] },
  { city: 'Marsilya', country: 'Fransa', aliases: ['marseille'] },
  { city: 'Berlin', country: 'Almanya', aliases: ['almanya', 'deutschland'] },
  { city: 'Münih', country: 'Almanya', aliases: ['munich', 'munchen', 'münchen'] },
  { city: 'Frankfurt', country: 'Almanya', aliases: [] },
  { city: 'Köln', country: 'Almanya', aliases: ['cologne', 'koln'] },
  { city: 'Hamburg', country: 'Almanya', aliases: [] },
  { city: 'Roma', country: 'İtalya', aliases: ['rome', 'italya', 'italia'] },
  { city: 'Milano', country: 'İtalya', aliases: ['milan'] },
  { city: 'Madrid', country: 'İspanya', aliases: ['ispanya', 'spain'] },
  { city: 'Barselona', country: 'İspanya', aliases: ['barcelona'] },
  { city: 'Lizbon', country: 'Portekiz', aliases: ['lisbon', 'lisboa'] },
  { city: 'Amsterdam', country: 'Hollanda', aliases: ['hollanda', 'netherlands'] },
  { city: 'Brüksel', country: 'Belçika', aliases: ['brussels', 'bruxelles'] },
  { city: 'Viyana', country: 'Avusturya', aliases: ['vienna', 'wien'] },
  { city: 'Zürih', country: 'İsviçre', aliases: ['zurich', 'isvicre'] },
  { city: 'Cenevre', country: 'İsviçre', aliases: ['geneva'] },
  { city: 'Prag', country: 'Çekya', aliases: ['prague', 'praha'] },
  { city: 'Varşova', country: 'Polonya', aliases: ['warsaw'] },
  { city: 'Budapeşte', country: 'Macaristan', aliases: ['budapest'] },
  { city: 'Kopenhag', country: 'Danimarka', aliases: ['copenhagen'] },
  { city: 'Stockholm', country: 'İsveç', aliases: ['sweden'] },
  { city: 'Oslo', country: 'Norveç', aliases: ['norway'] },
  { city: 'Helsinki', country: 'Finlandiya', aliases: ['finland'] },
  { city: 'Atina', country: 'Yunanistan', aliases: ['athens', 'yunanistan'] },
  { city: 'Selanik', country: 'Yunanistan', aliases: ['thessaloniki'] },
  { city: 'Bükreş', country: 'Romanya', aliases: ['bucharest'] },
  { city: 'Sofya', country: 'Bulgaristan', aliases: ['sofia'] },
  { city: 'Belgrad', country: 'Sırbistan', aliases: ['belgrade'] },
  { city: 'Zagreb', country: 'Hırvatistan', aliases: ['croatia'] },
  { city: 'Saraybosna', country: 'Bosna-Hersek', aliases: ['sarajevo'] },
  { city: 'Üsküp', country: 'Kuzey Makedonya', aliases: ['skopje'] },
  { city: 'Tiran', country: 'Arnavutluk', aliases: ['tirana'] },
  { city: 'Bakü', country: 'Azerbaycan', aliases: ['baku', 'azerbaycan'] },
  { city: 'Tiflis', country: 'Gürcistan', aliases: ['tbilisi'] },
  { city: 'Moskova', country: 'Rusya', aliases: ['moscow', 'rusya'] },
  { city: 'St. Petersburg', country: 'Rusya', aliases: ['saint petersburg'] },
  { city: 'Kiev', countryTr: 'Ukrayna', aliases: ['kyiv'] },
  { city: 'Tokyo', country: 'Japonya', aliases: ['japan'] },
  { city: 'Pekin', country: 'Çin', aliases: ['beijing', 'china'] },
  { city: 'Şanghay', country: 'Çin', aliases: ['shanghai'] },
  { city: 'Seul', country: 'Güney Kore', aliases: ['seoul', 'korea'] },
  { city: 'Singapur', country: 'Singapur', aliases: ['singapore'] },
  { city: 'Bangkok', country: 'Tayland', aliases: ['thailand'] },
  { city: 'Dubai', country: 'Birleşik Arap Emirlikleri', aliases: ['bae', 'uae'] },
  { city: 'Doha', country: 'Katar', aliases: ['qatar'] },
  { city: 'Riyad', country: 'Suudi Arabistan', aliases: ['riyadh'] },
  { city: 'Kahire', country: 'Mısır', aliases: ['cairo', 'egypt'] },
  { city: 'Sidney', country: 'Avustralya', aliases: ['sydney', 'australia'] },
  { city: 'Melbourne', country: 'Avustralya', aliases: [] },
]

const IGNORED_REGION_CODES = new Set([
  'AC', 'CP', 'CQ', 'DG', 'EA', 'EU', 'EZ', 'FX', 'IC', 'SU', 'TA', 'UN',
])

function buildAllCountryNames(lang = 'tr') {
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
    return []
  }

  let regionDisplayNames = null

  try {
    regionDisplayNames = new Intl.DisplayNames([lang, 'tr', 'en'], { type: 'region' })
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

  return [...countries].sort((left, right) => left.localeCompare(right, lang))
}

function buildLocationSuggestions() {
  const provinceEntries = TURKEY_PROVINCES.map((city) => ({
    city,
    country: 'Türkiye',
    kind: 'city',
    flag: '🇹🇷',
  }))

  const worldCityEntries = MAJOR_WORLD_CITIES.map((item) => ({
    city: item.city,
    country: item.country,
    kind: 'city',
    flag: '📍',
    aliases: item.aliases || [],
  }))

  const countryEntries = buildAllCountryNames().map((country) => ({
    city: '',
    country,
    kind: 'country',
    flag: '🌍',
  }))

  return [...provinceEntries, ...worldCityEntries, ...countryEntries]
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

  if (item.aliases && item.aliases.some((alias) => normalizeSearchText(alias).startsWith(normalizedQuery))) {
    return 1
  }

  if (country.startsWith(normalizedQuery)) {
    return 2
  }

  if (label.startsWith(normalizedQuery)) {
    return 3
  }

  return 4
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
      const hasAliasMatch = item.aliases && item.aliases.some((alias) => normalizeSearchText(alias).includes(normalizedQuery))
      return hasAliasMatch || queryTokens.every((token) => label.includes(token))
    })
    .sort((left, right) => {
      const leftScore = scoreSuggestion(left, normalizedQuery)
      const rightScore = scoreSuggestion(right, normalizedQuery)

      if (leftScore !== rightScore) {
        return leftScore - rightScore
      }

      return getSuggestionLabel(left).localeCompare(getSuggestionLabel(right), 'tr')
    })
    .slice(0, 15)
}
