const { asyncHandler } = require('../utils/asyncHandler')
const { searchLocations } = require('../services/locationSearchService')

const getAutocompleteLocations = asyncHandler(async (req, res) => {
  const query = req.validated?.query?.q || req.query.q || ''
  const limit = req.validated?.query?.limit || Number(req.query.limit) || 8
  const lang = req.validated?.query?.lang || req.query.lang || 'tr'

  const suggestions = searchLocations(query, {
    limit,
    lang,
  })

  res.json({
    query,
    count: suggestions.length,
    suggestions,
  })
})

module.exports = {
  getAutocompleteLocations,
}
