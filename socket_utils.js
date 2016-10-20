const _ = require('lodash');
const USER_AGENT = `User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36`

const generateError = (msg, options = {}) => {
  return _.assign({}, { error: true, message: msg }, options)
}

const emit = (userSocket, key, value) => {
  if (userSocket) {
    userSocket.emit(key, value)
  }
}

module.exports = {generateError, emit, USER_AGENT}