const MESSAGE = 'Code execution is not configured on this server. Ask your administrator to set it up.'
async function run() { throw Object.assign(new Error(MESSAGE), { statusCode: 503 }) }
module.exports = { run, MESSAGE }
