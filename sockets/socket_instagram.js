const INSTA = require('../services/instagram');

const { emit} = require('./socket_utils')

class UserSocketInstagram {
  constructor(router, socket) {
    //express routing
    this.socket = socket
    this.onGetTimeline = this.onGetTimeline.bind(this)
    this.socket.on('rad:instagram:timeline', this.onGetTimeline)
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
  onGetTimeline(obj) {
    let { id, accessToken } = obj
    return INSTA.getTimeline(accessToken, id, this.saveDirectory)
      .then((data) => {
        emit(this.socket, `rad:instagram:timeline:resp`, data)
      }).finally();
  }

  destroy() {
    this.socket.removeListener('rad:user:login', this.onGetTimeline)
  }

}

module.exports = UserSocketInstagram;
