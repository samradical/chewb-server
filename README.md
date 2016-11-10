# chewb
Mainly for piping videos to dash-player over websockets

Will need to clone [node-youtube-dash-sidx](https://github.com/samradical/node-youtube-dash-sidx) and do `npm link`

`npm i`
`node mains.js`

##Notes on DASH DRM (digital copy write)

[Overall](http://www.streamingmedia.com/Articles/Editorial/What-Is-.../What-Is-DRM-112279.aspx)

Essentially you have a DRM [platform](http://www.drmtoday.com/how-it-works), [Widevine](http://www.widevine.com/getting_started.html),  that encrypts the content and stores the keys.

MSE(https://www.html5rocks.com/en/tutorials/eme/basics/)

VideoJS [supports](https://github.com/videojs/videojs-contrib-dash/issues/89) it.

Assuming here VideoJS extracts the [cenc](https://bitdash-a.akamaihd.net/content/art-of-motion_drm/mpds/11331.mpd) key for you.






