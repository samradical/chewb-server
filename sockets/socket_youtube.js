var tmp = require('tmp');
var request = require('request');
var SIDX = require('@samelie/node-youtube-dash-sidx');
var DASHSAVE = require('@samelie/mp4-dash-record');
var REDIS = require('@samelie/chewb-redis');
var YT = require('../services/youtube');

const { emit, USER_AGENT, generateError } = require('./socket_utils')

class UserSocketYotube {
  constructor(socket) {
    this.socket = socket
    this.onGetVideoSidx = this.onGetVideoSidx.bind(this)
    this.onGetYoutubePlaylistItems = this.onGetYoutubePlaylistItems.bind(this)
    this.onYoutubeSearch = this.onYoutubeSearch.bind(this)
    this.onYoutubeVideo = this.onYoutubeVideo.bind(this)
    this.onRange = this.onRange.bind(this)
    socket.on('rad:youtube:sidx', this.onGetVideoSidx)
    socket.on('rad:youtube:playlist:items', this.onGetYoutubePlaylistItems)
    socket.on('rad:youtube:search', this.onYoutubeSearch)
    socket.on('rad:youtube:video', this.onYoutubeVideo)
    socket.on('rad:youtube:range', this.onRange)
  }

  onGetVideoSidx(obj) {
    /*
    returns an array on length 1
    data[0]
    */
    console.log('Get SIDX with');
    console.log(obj);
    /*Get existing manifest*/
    REDIS.getSidx(obj.uuid)
      .then(sidx => {
        let _hasItag = false
        if (sidx) {
          if (sidx.itag !== 'null') {
            //_hasItag = true
          }
        }

        if (_hasItag) {
          //get the new URL
          console.log(`Got REDIS sidx manifest for ${obj.uuid} with itag:${sidx.itag}`);
          SIDX.getURL(sidx.videoId, sidx.itag)
            .then(url => {
              sidx.url = url
              emit(this.socket, `rad:youtube:sidx:${obj.uuid}:resp`, sidx)
            })
        } else {
          REDIS.del(obj.uuid).then(() => {
            console.log(`Getting sidx manifest for ${obj.uuid}`);
            SIDX.start(obj)
              .then((data) => {
                if (this.socket) {
                  let manifestData = data
                  if (!manifestData) {
                    throw new Error(`No manifest data ${obj.uuid}`)
                    return
                  }
                  console.log(`Set REDIS sidx manifest for ${obj.uuid}`);
                  emit(this.socket, `rad:youtube:sidx:${obj.uuid}:resp`, manifestData)
                  REDIS.setSidx(obj.uuid, manifestData)
                }
              }).catch((e) => {
                console.log(`Error on getting sidx ${obj.uuid}`, e.toString());
                if (this.socket) {
                  emit(this.socket, `rad:youtube:sidx:${obj.uuid}:resp`,
                    generateError(`Failed to get sidx for ${obj.uuid}`, {
                      videoId: obj.id
                    })
                  )
                }
              });
          })
        }
      })
  }

  _requestYoutubePlaylistItems(obj) {
    return YT.playlistItems(obj).then((data) => {
      return JSON.parse(data.body)
    });
  }

  onGetYoutubePlaylistItems(obj) {
    let { playlistId } = obj
    let _response = `rad:youtube:playlist:${obj.playlistId}:items:resp`
    if (obj.force) {
      this._requestYoutubePlaylistItems(obj)
        .then(playlistItems => {
          REDIS.setYoutubePlaylistItems(playlistId, playlistItems).finally()
          emit(this.socket, _response, playlistItems)
        })
    } else {
      REDIS.getPlaylistItems(playlistId)
        .then((items) => {
          console.log(`Got REDIS playlistItems ${playlistId}`);
          let _playlistItems = { items: items }
          emit(this.socket, _response, _playlistItems)
        })
        .catch(err => {
          console.log(err.message);
          console.log('Requesting');
          this._requestYoutubePlaylistItems(obj)
            .then(playlistItems => {
              REDIS.setYoutubePlaylistItems(playlistId, playlistItems).finally()
              emit(this.socket, _response, playlistItems)
            })
        })
    }
  }

  onYoutubeSearch(obj) {
    return YT.search(obj).then((data) => {
      emit(this.socket, `rad:youtube:search:resp`, JSON.parse(data.body))
    }).finally();
  }

  onYoutubeVideo(obj) {
    return YT.video(obj).then((data) => {
      emit(this.socket, `rad:youtube:video:resp`, JSON.parse(data.body))
    }).finally();
  }

  onRange(obj) {
    var url = obj.url
    var _o = {
      url: url,
      headers:{
        'User-Agent':USER_AGENT
      }
    }
    if (obj.youtubeDl) {
      _o.headers = {
        "Range": "bytes=" + obj.range,
        "User-Agent": USER_AGENT
      }
    } else {
      _o.url += '&range=' + obj.range;
    }

    console.log(`Requesting range ${obj.range} : isIndexRange ${obj.isIndexRange}`);
    var r = request(_o)
    let _accumulated = 0
    r.on('data', (chunk) => {
      if (this.socket) {
        //GOOOD BUT SLOW
        /*if (obj.isIndexRange) {
          DASHSAVE.addIndex(chunk, obj.uuid)
        } else {
          DASHSAVE.addRange(chunk, obj.uuid)
        }*/
        _accumulated += chunk.length
        emit(this.socket, `rad:youtube:range:${obj.uuid}:resp`, chunk)
        emit(this.socket, `rad:youtube:range:${obj.uuid}:progress`, _accumulated / obj.totalBytes)
      }
    });

    r.on('error', (err)=> {
        emit(this.socket, `rad:youtube:range:${obj.uuid}:resp`, new Error('Server reset'))
    });

    r.on('end', () => {
      if (this.socket) {
        console.log(`Finished range request ${obj.end} ${obj.duration}`);
        emit(this.socket, `rad:youtube:range:${obj.uuid}:end`)
      }
    });
  }

  destroy() {}

}

module.exports = UserSocketYotube;
