var io = require('socket.io');
var ip = require('ip');
var fs = require('fs');
var stream = require('stream');
var _ = require('lodash');
var ffmpeg = require('fluent-ffmpeg');
//var OSC = require('./osc');
var RECORDER = require('./recorder');
//var BIKE_OSC = require('./bike_osc');
var Emitter = require('./events');
var tmp = require('tmp');
var request = require('request');
var SIDX = require('@samelie/node-youtube-dash-sidx');
var DASHSAVE = require('@samelie/mp4-dash-record');
var UPLOAD = require('@samelie/youtube-uploader');
var REDIS = require('@samelie/chewb-redis');
var YT = require('./services/youtube');

UPLOAD.init({ "web": { "client_id": "791164201854-59lj1a5dd75moqgfr4fj63ug604pmq03.apps.googleusercontent.com", "project_id": "samtest-144107", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://accounts.google.com/o/oauth2/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "VjcK9-gpfLnjWJuIXsEsAPUS", "redirect_uris": ["http://localhost:5000/oauth2callback"], "javascript_origins": ["http://localhost:5000"] } }, 'PLuTh1a1eg5vZavHvi60x_7SDq_pm4W4ID')

const USER_AGENT = `User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36`

const generateError = (msg, options = {}) => {
  return _.assign({}, { error: true, message: msg }, options)
}

const emit = (userSocket, key, value) => {
  if (userSocket) {
    userSocket.emit(key, value)
  }
}

var SOCKET = function(express) {

  tmp.dir((err, path, cleanupCallback) => {
    if (err) throw err;

    console.log("Dir: ", path);
    fs.chmodSync(path, '0777')
    SIDX.setTempSaveDir(path)

  });


  var users = {};
  var ids = [];
  io = io.listen(express);
  io.on('connection', userConnected);

  function userConnected(socket) {

    ids.push(socket.id);
    users[socket.id] = socket;


    users[socket.id].onQueueVideoSearch = (val) => {
      Emitter.emitter.emit('video:search', val);
    }

    users[socket.id].onRecorderStart = (val) => {
      RECORDER.start((id) => {
        emit(users[socket.id],'recorder:started', id)
      })
    }

    users[socket.id].onRecorderImageSave = (image, id) => {
      console.log("socket.onRecorderImageSave");
      RECORDER.saveImage(image, id, () => {
        emit(users[socket.id],'recorder:image:saved')
      })
    }

    users[socket.id].onRecorderVideoSave = (obj, id) => {
      console.log("socket.onRecorderVideoSave");
      RECORDER.saveVideo(obj, id, (savePath) => {
        emit(users[socket.id],'recorder:video:saved', savePath)
      })
    }

    users[socket.id].onGetVideoSidx = (obj) => {
      /*
      returns an array on length 1
      data[0]
      */

      /*Get existing manifest*/
      REDIS.getSidx(obj.uuid)
        .then(sidx => {
          if (sidx) {
            //get the new URL
            console.log(`Got REDIS sidx manifest for ${obj.uuid}`);
            SIDX.getURL(sidx.videoId, sidx.itag)
              .then(url => {
                sidx.url = url
                emit(users[socket.id],`rad:youtube:sidx:${obj.uuid}:resp`, sidx)
              })
          } else {
            console.log(`Getting sidx manifest for ${obj.uuid}`);
            SIDX.start(obj).then((data) => {
              if (users[socket.id]) {
                let manifestData = data
                REDIS.setSidx(obj.uuid, manifestData)
                console.log(`Set REDIS sidx manifest for ${obj.uuid}`);
                emit(users[socket.id],`rad:youtube:sidx:${obj.uuid}:resp`, manifestData)
              }
            }).catch((e) => {
              console.log(`Error on getting sidx ${obj.uuid}`);
              if (users[socket.id]) {
                emit(users[socket.id],`rad:youtube:sidx:${obj.uuid}:resp`,
                  generateError(`Failed to get sidx for ${obj.uuid}`, {
                    videoId: obj.id
                  })
                )
              }
            });
          }
        })
    }

    function _requestYoutubePlaylistItems(obj) {
      return YT.playlistItems(obj).then(function(data) {
        return JSON.parse(data.body)
      });
    }

    users[socket.id].onGetYoutubePlaylistItems = (obj) => {
      let { playlistId } = obj

      if (obj.force) {
        _requestYoutubePlaylistItems(obj)
          .then(playlistItems => {
            REDIS.setYoutubePlaylistItems(playlistId, playlistItems).finally()
            emit(users[socket.id], `rad:youtube:playlist:items:resp`, playlistItems)
          })
      } else {
        REDIS.getPlaylistItems(playlistId)
          .then((items) => {
            console.log(`Got REDIS playlistItems ${playlistId}`);
            let _playlistItems = { items: items }
            emit(users[socket.id],`rad:youtube:playlist:items:resp`, _playlistItems)
          })
          .catch(err => {
            console.log(err.message);
            console.log('Requesting');
            _requestYoutubePlaylistItems(obj)
              .then(playlistItems => {
                REDIS.setYoutubePlaylistItems(playlistId, playlistItems).finally()
                emit(users[socket.id],`rad:youtube:playlist:items:resp`, playlistItems)
              })
          })
      }
    }

    /*
    NOT SAVING THE INDEX BUFFER, always false
    */
    users[socket.id].onRadVideo = (obj) => {
      var url = obj.url
      var _o = {
        url: url,
      }
      if (obj.youtubeDl) {
        _o.headers = {
          "Range": "bytes=" + obj.range,
          "User-Agent": USER_AGENT
        }
      } else {
        _o.url += '&range=' + obj.range;
      }

      console.log(`Requesting range ${obj.range} `);
      var r = request(_o)
      var indexBuffer

      r.on('data', (chunk) => {
        if (users[socket.id]) {
          /*if (obj.isIndexBuffer) {
            let _b
            if (indexBuffer) {
              let _l = indexBuffer.length + chunk.length
              _b = Buffer.concat([indexBuffer], _l)
              indexBuffer = _b
            } else {
              indexBuffer = chunk
            }
          }*/
          emit(users[socket.id],`rad:video:range:${obj.uuid}:resp`, chunk)
        }
      });

      r.on('end', () => {
        if (users[socket.id]) {
          console.log(`Finished range request`);
          emit(users[socket.id],`rad:video:range:${obj.uuid}:end`)
          if (obj.isIndexBuffer) {
            /*REDIS.setIndexRange(obj.uuid, indexBuffer)
            indexBuffer.fill(0)
            indexBuffer = null*/
          }
        }
      });
    }

    users[socket.id].onAddVideo = (obj) => {
      DASHSAVE.add(__dirname + '/_out',
          obj)
        /*let buffer1 = obj.indexBuffer
        let buffer2 = obj.buffer
        var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        let _b = toBuffer(tmp)
        var s = new stream.Readable();
        s.push(_b);
        s.push(null);
        var command = ffmpeg(s)
            .output(`outputfile${Math.random()}.mp4`)
            .toFormat('mp4')
            .on('start', function(commandLine) {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on('stderr', function(stderrLine) {
                console.log('Stderr output: ' + stderrLine);
            })
            .on('error', function(err, stdout, stderr) {
                console.log('Cannot process video: ' + err.message);
                console.log(stdout);
                console.log(stderr);
            })
            .on('end', function() {
                console.log('Finished processing');
            })
            .run();*/
    }

    users[socket.id].onAddFrame = (frame) => {
      DASHSAVE.addFrame(__dirname + '/_out', frame)
    }

    users[socket.id].onAddFrameEnd = (frame) => {
      DASHSAVE.addFrame(__dirname + '/_out', frame, true)
    }

    users[socket.id].onSaveVideo = () => {
      DASHSAVE.save(__dirname + '/_out')
        .then(response => {
          console.log(response);
          emit(users[socket.id],'rad:video:save:success', response)
        })
    }

    users[socket.id].onVideoUpload = (files) => {
      UPLOAD.upload(files, 'PLuTh1a1eg5vZavHvi60x_7SDq_pm4W4ID')
    }

    /*
    hmkey/uuid
    value
    */
    users[socket.id].onSetRedisIndexRange = (obj) => {
      REDIS.setIndexRange(obj.uuid, obj.value)
    }



    socket.on('queue:video:search', users[socket.id].onQueueVideoSearch)
    socket.on('recorder:start', users[socket.id].onRecorderStart)
    socket.on('recorder:image:save', users[socket.id].onRecorderImageSave)
    socket.on('recorder:video:save', users[socket.id].onRecorderVideoSave)

    socket.on('rad:youtube:sidx', users[socket.id].onGetVideoSidx)
    socket.on('rad:youtube:playlist:items', users[socket.id].onGetYoutubePlaylistItems)

    socket.on('rad:redis:set:indexRange', users[socket.id].onSetRedisIndexRange)

    socket.on('rad:video:range', users[socket.id].onRadVideo)
    socket.on('rad:video:save', users[socket.id].onAddVideo)
    socket.on('rad:video:save:end', users[socket.id].onSaveVideo)

    socket.on('rad:video:frame', users[socket.id].onAddFrame)
    socket.on('rad:video:frame:end', users[socket.id].onAddFrameEnd)

    socket.on('rad:video:upload', users[socket.id].onVideoUpload)


    //*********
    //*********

    users[socket.id].onDisconnect = () => {
      _.forIn(users[socket.id]._events, (func, key) => {
        socket.removeListener(key, func)
      })
      let _i = ids.indexOf(socket.id)
      ids.splice(_i, 1)
      console.log(users[socket.id]._callbacks);
      users[socket.id] = null
      delete users[socket.id]
      console.log("Disocnnected");
    }

    socket.once('disconnect', users[socket.id].onDisconnect)

    socket.emit('handshake', {
      index: ids.length - 1,
      id: socket.id,
      ip: ip.address()
    });

    console.log("Connection: ", socket.id, 'at: ', ip.address());
  }


  console.log("Sockets listening");
  /*var osc = new OSC(io);
  var bike_osc = new BIKE_OSC(io);*/

};

module.exports = SOCKET;