const DASHSAVE = require('@samelie/mp4-dash-record');
const GOOGLE = require('./services/gcloud');

class UserRecordSocket {
  constructor(socket) {
    this.socket = socket
    socket.onAddAudio = this.onAddAudio.bind(this)
    socket.onAddFrame = this.onAddFrame.bind(this)
    socket.onSave = this.onSave.bind(this)
    socket.on('rad:recorder:audio', socket.onAddAudio)
    socket.on('rad:recorder:frame', socket.onAddFrame)
    socket.on('rad:recorder:save', socket.onSave)
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
    options.saveDir = this.saveDirectory
    return this._recorder.save(options)
      .then(path => {
        return GOOGLE.store(path)
          .then(uploadedPath=>{
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
