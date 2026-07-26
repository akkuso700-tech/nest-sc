const express = require('express')
const { authenticate, authenticateOptional } = require('../middlewares/authenticate')
const { validateRequest } = require('../middlewares/validateRequest')
const {
  getSearchSuggestions,
  getSearchResults,
  getSearchHistory,
  saveSearchHistory,
  deleteSearchHistory,
} = require('../controllers/searchController')
const {
  searchSuggestSchema,
  searchResultsSchema,
  searchHistorySchema,
  saveSearchHistorySchema,
  deleteSearchHistorySchema,
} = require('../validators/searchValidators')

const searchRouter = express.Router()

searchRouter.get('/suggest', authenticateOptional, validateRequest(searchSuggestSchema), getSearchSuggestions)
searchRouter.get('/results', authenticateOptional, validateRequest(searchResultsSchema), getSearchResults)
searchRouter.get('/history', authenticate, validateRequest(searchHistorySchema), getSearchHistory)
searchRouter.post('/history', authenticate, validateRequest(saveSearchHistorySchema), saveSearchHistory)
searchRouter.delete('/history', authenticate, validateRequest(deleteSearchHistorySchema), deleteSearchHistory)

module.exports = { searchRouter }
