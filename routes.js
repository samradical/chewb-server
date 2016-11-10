var _ = require('lodash');
var passport = require('passport');
var request = require('request');
var flash = require('connect-flash');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

var ROUTES = function(router, _Io) {

	//auth
	require('./routes/authentication')(router, _Io);
	require('./routes/echonest')(router, _Io);
	require('./routes/youtube')(router, _Io);

	//*********************
	//POST
	//*********************

	router.post('/signup', function(req, res, next) {
		passport.authenticate('local-signup', function(err, user, info) {
			if (err) {
				return next(err); // will generate a 500 error
			}
			if (!user) {
				return res.send({
					success: false,
					message: info['message']
				});
			}
			return res.send({
				success: true,
				user: user
			});
		})(req, res, next);
	});

	router.post('/login', function(req, res, next) {
		passport.authenticate('local-login', function(err, user, info) {
			if (err) {
				return next(err); // will generate a 500 error
			}
			if (!user) {
				return res.send({
					success: false,
					message: info['message']
				});
			}
			return res.send({
				success: true,
				user: user
			});
		})(req, res, next);
	});

	////////////////////////
	//PUBLIC
	////////////////////////

};

module.exports = ROUTES;
