const REDIS = require('./redis');
const Colors = require('colors');

const { emit, USER_AGENT, generateError } = require('./socket_utils')

class UserSocketYotube {
  constructor(router, socket) {
    //express routing
    this.socket = socket
    this.onLogin = this.onLogin.bind(this)
    this.onStoreVideo = this.onStoreVideo.bind(this)
    this.socket.on('rad:user:login', this.onLogin)
    this.socket.on('rad:user:videos', this.onStoreVideo)
  }

  set saveDirectory(d) {
    this._saveDirectory = d
  }

  get saveDirectory() {
    return this._saveDirectory || __dirname
  }

  /*
  {
  username:
  }
  */
  onLogin(obj) {
    let { username } = obj
    return REDIS.user.login(username).then((data) => {
      emit(this.socket, `rad:user:login:resp`, data)
    }).finally();
  }

  onStoreVideo(obj) {
    let { key, field, value } = obj
    console.log(Colors.yellow(`onStoreVideo() ${key} ${field} ${value}`));
    return REDIS.user.storeVideo(key, field, value)
      .then((data) => {
        emit(this.socket, `rad:user:videos:resp`, data)
      }).finally();
  }


  destroy() {
    this.socket.removeListener('rad:user:login', this.onLogin)
    this.socket.removeListener('rad:user:videos', this.onStoreVideo)
  }

}

module.exports = UserSocketYotube;
