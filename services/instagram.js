const Q = require('bluebird');
const InstagramAPI = require('instagram-api');
const _ = require('lodash');

module.exports = (function() {

  function getTimeline(accessToken, userId, dir) {
    return new Q((yes, no) => {
      var instagramAPI = new InstagramAPI(accessToken);
      instagramAPI.userMedia(userId, {count:100})
      .then((result) =>{
        yes(result.data)
        instagramAPI = null
        /*console.log(result.data); // user info
        console.log(result.limit); // api limit
        console.log(result.remaining) // api request remaining*/
      }, (err)=> {
        no(err)
      });
    })
  }

  return {
    getTimeline: getTimeline
  }

})();
