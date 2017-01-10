const spawn = require('child_process').spawn
module.exports = function(router) {
  router.get('/youtubedl/info', function(req, res) {
    let {url, itag} = req.query
    var _cmd = `youtube-dl ${url} --skip-download -f ${itag} -g -q`
      var run = spawn(_cmd, (code, stdout, stderr) => {
        if (stderr) {
          res.send({code:500})
        } else {
          res.send({code:200, response:stdout})
        }
      });
  });
  router.get('/youtubedl/manifest', function(req, res) {
    let {url, itag} = req.query
    var _cmd = `youtube-dl ${url} --skip-download -f ${itag} -g -q`
      var run = spawn(_cmd, (code, stdout, stderr) => {
        if (stderr) {
          res.send({code:500})
        } else {
          res.send({code:200, response:stdout})
        }
      });
  });
};
