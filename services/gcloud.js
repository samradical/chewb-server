const GOOGLE = require('google-cloudstorage-commands')

var fs = require('fs');
var path = require('path');
const BUCKET_NAME = 'samrad-deuxtube/'
const BUCKET = `gs://${BUCKET_NAME}`

var GCLOUD = (() => {
  function store(inPath, outPath = "", bucket = BUCKET) {
    let {base,name} = path.parse(inPath)
    let _dest = `${bucket}${outPath}`
    return GOOGLE.upload(inPath, _dest, false)
      .then(() => {
        return {
          url: path.join(GOOGLE.baseUrl, BUCKET_NAME, outPath, base),
          name:name
        }
      })
      .catch(err => {
        console.log(err);
      })
  }
  return {
    store,
  }
})();

module.exports = GCLOUD;
