const DASHSAVE = require('mp4-dash-record');
const GOOGLE = require('../services/gcloud');
const uuid = require('uuid');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const REDIS = require('./redis');

class UserRecordSocket {
  constructor(socket, tmpDir) {
    this.socket = socket
    this.saveDirectory = tmpDir
    this.onAddAudio = this.onAddAudio.bind(this)
    this.onAddFrame = this.onAddFrame.bind(this)
    this.onSave = this.onSave.bind(this)
    socket.on('rad:recorder:audio', this.onAddAudio)
    socket.on('rad:recorder:frame', this.onAddFrame)
    socket.on('rad:recorder:buffer', this.onAddBuffer)
    socket.on('rad:recorder:save', this.onSave)
    this._saveHash = uuid.v4()
    this.saveDirectory = path.join(this.saveDirectory, this._saveHash)
    fs.mkdirSync(this.saveDirectory)
    this._recorder = new DASHSAVE({ffmpegPath:process.env.FFMPEG_PATH})
    this._recorder.saveDirectory = this.saveDirectory
    console.log(this.saveDirectory);
  }

  onAddAudio(buffer) {
    console.log('audio', buffer.length);
    this._recorder.addAudio(buffer)
    this.socket.emit('rad:recorder:audio:success')
  }

  onAddFrame(base64Str) {
    console.log('video', base64Str.length);
    this._recorder.saveImage(base64Str)
    .then(()=>{
      this.socket.emit('rad:recorder:frame:success')
    })
  }

  onAddBuffer(buffer) {
    console.log('video', buffer.length);
    this._recorder.addFrame(buffer)
    this.socket.emit('rad:recorder:frame:success')
  }

  onSave(options) {
    if (!options) {
      console.log("No save options socket record onSave()");
      return
    }
    return this._recorder.save(options)
      .then(final => {
        return GOOGLE.store(final)
          .then(uploadedPath => {

            REDIS.hset(`${process.env.REDIS_PROJECT}:saves:google`, this._saveHash, uploadedPath)

            this.socket.emit('rad:recorder:save:success', {
              url: uploadedPath,
              local: final
            })
          })
      }).finally()
  }

  set saveDirectory(d) {
    this._saveDirectory = d
  }

  get saveDirectory() {
    return this._saveDirectory || __dirname
  }

  destroy() {
    this._recorder.destroy()
  }

}

module.exports = UserRecordSocket;
