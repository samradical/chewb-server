var fs = require('fs');
var path = require('path');
require('shelljs/global')
const BUCKET = 'gs://samrad-chewb/'
var GCLOUD = (() => {
    function store(inPath, outPath, bucket=BUCKET){
        exec(`gsutil -m cp -r -a public-read ${inPath} ${bucket}${outPath}`)
    }
    return {
        store,
    }
})();

module.exports = GCLOUD;