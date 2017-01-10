const io = require('socket.io');
const ip = require('ip');
const fs = require('fs');
const uuid = require('uuid');
const path = require('path');
const _ = require('lodash');
const tmp = require('tmp');
const request = require('request');
var SIDX = require('@samelie/node-youtube-dash-sidx');
const SocketRecord = require('./socket_record');
const SocketYoutube = require('./socket_youtube');
const SocketInstagram = require('./socket_instagram');
const SocketUser = require('./socket_user');

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

const SOCKET = function(router, express) {

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
      userMaterials[socket.id].recorder.saveDirectory = TEMP_DIR
      userMaterials[socket.id].youtube = new SocketYoutube(router, socket)
      userMaterials[socket.id].youtube.saveDirectory = TEMP_DIR
      userMaterials[socket.id].user = new SocketUser(router, socket)
      userMaterials[socket.id].user.saveDirectory = TEMP_DIR
      userMaterials[socket.id].instagram = new SocketInstagram(router, socket)
      userMaterials[socket.id].instagram.saveDirectory = TEMP_DIR

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


    console.log("Sockets listening ");
  });
};

module.exports = SOCKET;
