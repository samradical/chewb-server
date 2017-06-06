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

const SIDX = require('node-dash-sidx');

//require('./auth/passport')(passport);

class Chewb {
    constructor(envarsPath) {

        require('dotenv').config({ path: envarsPath });
            console.log(process.env);
        if (process.env.YOUTUBE_DL_PATH) {
            SIDX.setYoutubeDLPath(process.env.YOUTUBE_DL_PATH)
        }

        var server, routes;
        this.app = express();
        var io;

        this.app.use(bodyParser.urlencoded({
            extended: true
        }));
        this.app.use(cookieParser()); // read cookies (needed for auth)
        this.app.use(bodyParser.json());

        // required for passport
        this.app.use(session({
            secret: 'samrad'
        })); // session secret
        //this.app.use(passport.initialize());
        //this.app.use(passport.session()); // persistent login sessions
        this.app.use(flash()); // use connect-flash for flash messages stored in session

        this.app.use(cors());
        let _port = process.env.PORT || 8080
        let _host = process.env.SERVER_HOST || '127.0.0.1'
        console.log(_host, _port);
        var server = this.app.listen(_port)

        io = require('./sockets/socket')(router, server);

        var router = express.Router()
        routes = require('./routes')(router, io);

        router.get('/', function(req, res) {
            res.status(200).send('nothing to see here...');
        });


        this.port = _port
        this.host = _host

        this.sidx = SIDX

    }
}

module.exports = Chewb
