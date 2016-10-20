const GOOGLE = require('@samelie/google-cloudstorage')

var fs = require('fs');
var path = require('path');
const BUCKET = 'gs://samrad-deuxtube/'

var GCLOUD = (() => {
  function store(inPath, outPath="", bucket = BUCKET) {
    let name =path.parse(inPath).name
    let _dest = `${bucket}${outPath}`
    return GOOGLE.upload(inPath, _dest , false)
    .then(()=>{
      return path.join(_dest, name)
    })
    .catch(err=>{
      console.log(err);
    })
  }
  return {
    store,
  }
})();

module.exports = GCLOUD;
