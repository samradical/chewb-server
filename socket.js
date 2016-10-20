const io = require('socket.io');
const ip = require('ip');
const fs = require('fs');
const uuid = require('uuid');
const path = require('path');
const stream = require('stream');
const _ = require('lodash');
const ffmpeg = require('fluent-ffmpeg');
//const OSC = require('./osc');
const RECORDER = require('./recorder');
//const BIKE_OSC = require('./bike_osc');
const Emitter = require('./events');
const tmp = require('tmp');
const request = require('request');
const SIDX = require('@samelie/node-youtube-dash-sidx');
const DASHSAVE = require('@samelie/mp4-dash-record');
const UPLOAD = require('@samelie/youtube-uploader');
const REDIS = require('@samelie/chewb-redis');
const YT = require('./services/youtube');

const SocketRecord = require('./socket_record');
const SocketYoutube = require('./socket_youtube');

//UPLOAD.init({ "web": { "client_id": "791164201854-59lj1a5dd75moqgfr4fj63ug604pmq03.apps.googleusercontent.com", "project_id": "samtest-144107", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://accounts.google.com/o/oauth2/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "VjcK9-gpfLnjWJuIXsEsAPUS", "redirect_uris": ["http://localhost:5000/oauth2callback"], "javascript_origins": ["http://localhost:5000"] } }, 'PLuTh1a1eg5vZavHvi60x_7SDq_pm4W4ID')

const USER_AGENT = `User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36`

const generateError = (msg, options = {}) => {
  return _.assign({}, { error: true, message: msg }, options)
}

const emit = (userSocket, key, value) => {
  if (userSocket) {
    userSocket.emit(key, value)
  }
}

const SOCKET = function(express) {

  tmp.dir((err, path, cleanupCallback) => {
    if (err) throw err;
    const TEMP_DIR = path
    console.log("Dir: ", TEMP_DIR);
    fs.chmodSync(TEMP_DIR, '0777')
    SIDX.setTempSaveDir(TEMP_DIR)

    var users = {};
    var userMaterials = {}
    var ids = [];
    const IO = io.listen(express);
    IO.on('connection', userConnected);

    function userConnected(socket) {

      ids.push(socket.id);
      users[socket.id] = socket;

      userMaterials[socket.id] = {}
      userMaterials[socket.id].recorder = new SocketRecord(socket, TEMP_DIR)
      userMaterials[socket.id].youtube = new SocketYoutube(socket)
      userMaterials[socket.id].youtube.saveDirectory = TEMP_DIR


      users[socket.id].onQueueVideoSearch = (val) => {
        Emitter.emitter.emit('video:search', val);
      }

      users[socket.id].onRecorderStart = (val) => {
        RECORDER.start((id) => {
          emit(users[socket.id], 'recorder:started', id)
        })
      }

      users[socket.id].onRecorderImageSave = (image, id) => {
        console.log("socket.onRecorderImageSave");
        RECORDER.saveImage(image, id, () => {
          emit(users[socket.id], 'recorder:image:saved')
        })
      }

      users[socket.id].onRecorderVideoSave = (obj, id) => {
        console.log("socket.onRecorderVideoSave");
        RECORDER.saveVideo(obj, id, (savePath) => {
          emit(users[socket.id], 'recorder:video:saved', savePath)
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
        /*socket.on('recorder:start', users[socket.id].onRecorderStart)
        socket.on('recorder:image:save', users[socket.id].onRecorderImageSave)
        socket.on('recorder:video:save', users[socket.id].onRecorderVideoSave)*/

      /*socket.on('rad:youtube:sidx', users[socket.id].onGetVideoSidx)
      socket.on('rad:youtube:playlist:items', users[socket.id].onGetYoutubePlaylistItems)
      socket.on('rad:youtube:search', users[socket.id].onYoutubeSearch)*/

      socket.on('rad:redis:set:indexRange', users[socket.id].onSetRedisIndexRange)

      //socket.on('rad:video:range', users[socket.id].onRadVideo)
      //socket.on('rad:video:save', users[socket.id].onAddVideo)
      //socket.on('rad:video:save:end', users[socket.id].onSaveVideo)

      //socket.on('rad:video:frame', users[socket.id].onAddFrame)
      //socket.on('rad:video:frame:end', users[socket.id].onAddFrameEnd)
      /*socket.on('rad:recorder:audio', users[socket.id].onAddAuio)
      socket.on('rad:recorder:frame', users[socket.id].onAddFrame)
      socket.on('rad:recorder:frame:save', users[socket.id].onAddFrameEnd)
      socket.on('rad:recorder:save', users[socket.id].onAddFrameEndSave)*/

      socket.on('rad:video:upload', users[socket.id].onVideoUpload)


      //*********
      //*********

      users[socket.id].onDisconnect = () => {
        _.forIn(users[socket.id]._events, (func, key) => {
          socket.removeListener(key, func)
        })
        let _i = ids.indexOf(socket.id)
        ids.splice(_i, 1)
        _.forIn(userMaterials[socket.id], (instance, key) => {
          instance.destroy()
          instance = null
        })
        users[socket.id] = null
        delete users[socket.id]
        console.log(`Disconnected ${socket.id}`);
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
  });
};

module.exports = SOCKET;
