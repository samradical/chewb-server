const tmp = require('tmp');
const request = require('request');
const SIDX = require('node-dash-sidx');
const DASHSAVE = require('mp4-dash-record');
const REDIS = require('./redis');
const YT = require('../services/youtube');

const { emit, USER_AGENT, generateError } = require('./socket_utils')

class UserSocketYotube {
  constructor(router, socket) {
    //express routing
    this.socket = socket
    this.onGetVideoUrl = this.onGetVideoUrl.bind(this)
    this.onGetVideoSidx = this.onGetVideoSidx.bind(this)
    this.onGetYoutubePlaylistItems = this.onGetYoutubePlaylistItems.bind(this)
    this.onYoutubeSearch = this.onYoutubeSearch.bind(this)
    this.onYoutubeVideo = this.onYoutubeVideo.bind(this)
    this.onRange = this.onRange.bind(this)
    socket.on('rad:youtube:sidx', this.onGetVideoSidx)
    socket.on('rad:youtube:url', this.onGetVideoUrl)
    socket.on('rad:youtube:playlist:items', this.onGetYoutubePlaylistItems)
    socket.on('rad:youtube:search', this.onYoutubeSearch)
    socket.on('rad:youtube:video', this.onYoutubeVideo)
    socket.on('rad:youtube:range', this.onRange)
    console.log('UserSocketYotube');
  }

  onGetVideoSidx(obj) {
    /*
    returns an array on length 1
    data[0]
    */
    console.log("chewb socket_youtube, onGetVideoSidx() SIDX with");
    console.log("--------------");
    console.log(obj);
    /*Get existing manifest*/
    REDIS.youtube.getSidx(obj.uuid)
      .then(sidx => {
        console.log("--------------");
        console.log(sidx);
        console.log("--------------");
        let _hasItag = false
        if (sidx) {
          if (sidx.itag !== 'null') {
            _hasItag = true
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
            this._requestSidxAndAdd(obj)
          })
        }
      })
      //no SIDX in REDIS
      .catch(err => {
        console.log(`Error getting sidx manifest for ${obj.uuid}`);
        this._requestSidxAndAdd(obj)
      })
  }

  onGetVideoUrl(obj) {
    /*
    returns an array on length 1
    data[0]
    */
    console.log("chewb socket_youtube, onGetVideoUrl() SIDX with ");
    console.log("--------");
    console.log(obj);

    const itag = obj.itags[0] || obj.itags || obj.itag

    return SIDX.getURL(obj.videoId, itag)
      .then((data) => {
        emit(this.socket, `rad:youtube:url:${obj.uuid}:resp`, { url: data })
      })
      .catch((e) => {});
  }

  _requestSidxAndAdd(obj) {
    console.log("SIDX.start _requestSidxAndAdd");
    console.log(obj);
    return SIDX.start(obj)
      .then((data) => {
        if (this.socket) {
          let manifestData = data[0]
          if (!manifestData) {
            throw new Error(`No manifest data ${obj.uuid}`)
            return
          }
          console.log(`Set REDIS sidx manifest for ${obj.uuid}`);
          emit(this.socket, `rad:youtube:sidx:${obj.uuid}:resp`, manifestData)
          console.log(`REDIS.setSidx() ${obj.uuid}`);
          REDIS.youtube.setSidx(obj.uuid, manifestData)
        }
      })
      .catch((e) => {
        console.log(`Error on getting sidx ${obj.uuid}`, e.toString());
        if (this.socket) {
          emit(this.socket, `rad:youtube:sidx:${obj.uuid}:resp`,
            generateError(`Failed to get sidx for ${obj.uuid}`, {
              videoId: obj.id
            })
          )
        }
      });
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
          console.log('REDIS.youtube.setYoutubePlaylistItems');
          REDIS.youtube.setYoutubePlaylistItems(playlistId, playlistItems).finally()
          emit(this.socket, _response, playlistItems)
        })
    } else {
      console.log('REDIS.youtube.getPlaylistItems(playlistId)');
      REDIS.youtube.getPlaylistItems(playlistId)
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
              console.log('REDIS.youtube.setYoutubePlaylistItems');
              REDIS.youtube.setYoutubePlaylistItems(playlistId, playlistItems).finally()
              emit(this.socket, _response, playlistItems)
            })
        })
    }
  }

  onYoutubeSearch(obj) {
    return YT.search(obj)
      .then((data) => {
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
      headers: {
        'User-Agent': USER_AGENT
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

    r.on('error', (err) => {
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
