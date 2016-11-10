'use strict'
var express = require('express');
var ip = require('ip');
var cors = require('cors');
var path = require('path');
var busboi = require('connect-busboy');
//var passport = require('passport');
var flash = require('connect-flash');

var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

//require('./auth/passport')(passport);

class Chewb {
  constructor(envarsPath) {
    console.log(envarsPath);
    require('dotenv').config({ path: envarsPath });

    var server, routes;
    var app = express();
    var io;

    app.use(bodyParser.urlencoded({
      extended: true
    }));
    app.use(cookieParser()); // read cookies (needed for auth)
    app.use(bodyParser.json());

    // required for passport
    app.use(session({
      secret: 'samrad'
    })); // session secret
    //app.use(passport.initialize());
    //app.use(passport.session()); // persistent login sessions
    app.use(flash()); // use connect-flash for flash messages stored in session

    app.use(cors());
    let _port = process.env.PORT || 8080
    let _host = process.env.SERVER_HOST || '127.0.0.1'
    console.log(_host, _port);
    var server = app.listen(_port)

    io = require('./sockets/socket')(router, server);

    var router = express.Router()
    routes = require('./routes')(router, io);

    router.get('/', function(req, res) {
      res.status(200).send('nothing to see here...');
    });
  }
}

module.exports = Chewb