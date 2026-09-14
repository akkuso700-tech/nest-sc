const express = require('express')
const { validateRequest } = require('../middlewares/validateRequest')
const { getAutocompleteLocations } = require('../controllers/locationController')
const { locationAutocompleteSchema } = require('../validators/locationValidators')

const locationsRouter = express.Router()

locationsRouter.get('/autocomplete', validateRequest(locationAutocompleteSchema), getAutocompleteLocations)

module.exports = { locationsRouter }
