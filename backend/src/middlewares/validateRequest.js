function validateRequest(schema) {
  return function validationMiddleware(req, res, next) {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    })

    if (!result.success) {
      next(result.error)
      return
    }

    req.validated = result.data
    next()
  }
}

module.exports = { validateRequest }
