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


const USER_AGENT = `User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36`

var SOCKET = function(express) {

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
                users[socket.id].emit('recorder:started', id)
            })
        }

        users[socket.id].onRecorderImageSave = (image, id) => {
            console.log("socket.onRecorderImageSave");
            RECORDER.saveImage(image, id, () => {
                users[socket.id].emit('recorder:image:saved')
            })
        }

        users[socket.id].onRecorderVideoSave = (obj, id) => {
            console.log("socket.onRecorderVideoSave");
            RECORDER.saveVideo(obj, id, (savePath) => {
                users[socket.id].emit('recorder:video:saved', savePath)
            })
        }

        users[socket.id].onGetVideoSidx = (obj) => {
            SIDX.start(obj).then((data) => {
                if (users[socket.id]) {
                    users[socket.id].emit(`rad:youtube:sidx:${obj.uuid}:resp`, data)
                }
            }).catch((e) => {
                if (users[socket.id]) {
                    users[socket.id].emit(`rad:youtube:sidx:${obj.uuid}:resp`, new Error("Failed to get sidx"))
                }
            });
        }

        users[socket.id].onRadVideo = (obj) => {
            var url = obj.url
            var _o = {
                url: url,
            }
            console.log(_o);
            if (obj.youtubeDl) {
                _o.headers = {
                    "Range": "bytes=" + obj.range,
                    "User-Agent": USER_AGENT
                }
            } else {
                _o.url += '&range=' + obj.range;
            }
            var r = request(_o)

            r.on('data', function(chunk) {
                if (users[socket.id]) {
                    users[socket.id].emit(`rad:video:range:${obj.uuid}:resp`, chunk)
                }
            });

            r.on('end', function() {
                if (users[socket.id]) {
                    users[socket.id].emit(`rad:video:range:${obj.uuid}:end`)
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

        users[socket.id].onSaveVideo = () => {
            DASHSAVE.save(__dirname + '/_out')
        }

        socket.on('queue:video:search', users[socket.id].onQueueVideoSearch)
        socket.on('recorder:start', users[socket.id].onRecorderStart)
        socket.on('recorder:image:save', users[socket.id].onRecorderImageSave)
        socket.on('recorder:video:save', users[socket.id].onRecorderVideoSave)

        socket.on('rad:youtube:sidx', users[socket.id].onGetVideoSidx)
        socket.on('rad:video:range', users[socket.id].onRadVideo)
        socket.on('rad:video:save', users[socket.id].onAddVideo)
        socket.on('rad:video:save:end', users[socket.id].onSaveVideo)


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
