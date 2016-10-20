var express = require('express');
var ip = require('ip');
var cors = require('cors');
var path = require('path');
var busboi = require('connect-busboy');
var passport = require('passport');
var flash = require('connect-flash');

var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

let _env = path.join(__dirname, 'envvars')
require('dotenv').config({ path: _env });

require('./passport')(passport);

var memwatch = require('memwatch-next');

var server;
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
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

app.use(cors());
let _port = process.env.PORT || 8080
let _host = process.env.SERVER_HOST || '127.0.0.1'
var server = app.listen(_port, _host)

io = require('./socket')(server);

routes = require('./routes')(app, io);

app.get('/', function(req, res) {
    res.status(200).send('Hello, world SAM!');
});

memwatch.on('leak', (info) =>{
  console.log("------LEAK-------");
  console.log(info);
 });

module.exports = app;


