const { ZodError } = require('zod')

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] || {})
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(issue => ({
          field: issue.path.join('.') || source,
          message: issue.message,
        })),
      })
    }
    if (source === 'query') Object.defineProperty(req, 'query', { configurable: true, enumerable: true, writable: true, value: result.data })
    else req[source] = result.data
    next()
  }
}

const validateIdParam = name => validate(require('../validation/schemas').idParams(name), 'params')
const validateCodeParam = name => validate(require('../validation/schemas').codeParams(name), 'params')

module.exports = { validate, validateIdParam, validateCodeParam }
