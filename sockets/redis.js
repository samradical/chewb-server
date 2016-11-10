const { youtube } = require('@samelie/chewb-redis');
const REDIS = (() => {

  let isLocal = process.env.REDIS_HOST === '127.0.0.1'

  console.log("Using local redis? ", isLocal);
  return new youtube({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || '6379',
    project: process.env.REDIS_PROJECT,
  }, isLocal)


})()

module.exports = REDIS
