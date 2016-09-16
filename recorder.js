var tmp = require('tmp');
var fs = require('fs');
var path = require('path');
var uuid = require('uuid');
require('shelljs/global')
var GCloud = require('./services/gcloud')
var RECORDER = (() => {
  let _jobs = {}

  function pad(str, max) {
    str = str.toString();
    return str.length < max ? pad("0" + str, max) : str;
  }

  function _decodeBase64Image(dataString) {
    var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
      response = {};

    if (matches.length !== 3) {
      return new Error('Invalid input string');
    }

    response.type = matches[1];
    response.data = new Buffer(matches[2], 'base64');

    return response;
  }

  function start(cb) {
    let id = uuid.v1()
    tmp.dir({ mode: 0750, prefix: `VJ_${id}` }, (err, path) => {
      if (err) throw err;
      _jobs[id] = {
        path: path,
        incre: 0
      }
      cb(id)
    });
  }

  function saveImage(image, id, cb) {
    let _job = _jobs[id]
    if (!_job) {
      cb()
      return
    }
    let _i = pad(_job.incre, 12)
    var imageBuffer = _decodeBase64Image(image);
    var p = path.join(_job.path, `${_i}.jpg`)
    fs.writeFile(p, imageBuffer.data, cb)
    _job.incre += 1
  }

  function saveVideo(obj, id, cb) {
    let _job = _jobs[id]
    let name = obj.name || new Date().toISOString()
    let fileName = `\"${name}.mp4\"`
    cd(_job.path)
    let _cmd = `ffmpeg -framerate 25 -pattern_type glob -i "*.jpg" -y -c:v libx264 -preset slow -crf 22 -vf crop=${obj.videoWidth}:${obj.videoHeight}:0:0 ./${fileName}`
    console.log(_cmd);
    exec(_cmd)
    cd(__dirname)
    let _savePath = path.join(_job.path, fileName)
    console.log(_savePath);
    cb(_savePath)
    GCloud.store(_savePath, '')
    //exec(`rm -rf ${_job.path}`)
    delete _jobs[id]
    console.log("Removed folder");
  }

  return {
    start,
    saveImage,
    saveVideo,
  }
})();

module.exports = RECORDER;
