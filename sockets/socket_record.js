const DASHSAVE = require('@samelie/mp4-dash-record');
const GOOGLE = require('../services/gcloud');
const uuid = require('uuid');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');


class UserRecordSocket {
  constructor(socket) {
    this.socket = socket
    this.onAddAudio = this.onAddAudio.bind(this)
    this.onAddFrame = this.onAddFrame.bind(this)
    this.onSave = this.onSave.bind(this)
    socket.on('rad:recorder:audio', this.onAddAudio)
    socket.on('rad:recorder:frame', this.onAddFrame)
    socket.on('rad:recorder:save', this.onSave)
    this._recorder = new DASHSAVE()
  }

  onAddAudio(buffer) {
    console.log('audio', buffer.length);
    this._recorder.addAudio(buffer)
    this.socket.emit('rad:recorder:audio:success')
  }

  onAddFrame(buffer) {
    console.log('video', buffer.length);
    this._recorder.addFrame(buffer)
    this.socket.emit('rad:recorder:frame:success')
  }

  onSave(options) {
    if(!options){
      console.log("No save options socket record onSave()");
      return
    }
    let _saveDir = path.join(this.saveDirectory, uuid.v1())
    fs.mkdirSync(_saveDir)
    options.saveDir = _saveDir
    return this._recorder.save(options)
      .then(final => {
        return GOOGLE.store(final)
          .then(uploadedPath=>{
            console.log(uploadedPath);
            rimraf(_saveDir, (err,d)=>{

            })
            this.socket.emit('rad:recorder:save:success', uploadedPath)
          })
      }).finally()
  }

  set saveDirectory(d){
    this._saveDirectory = d
  }

  get saveDirectory(){
    return this._saveDirectory || __dirname
  }

  destroy() {
    this._recorder.destroy()
  }

}

module.exports = UserRecordSocket;
