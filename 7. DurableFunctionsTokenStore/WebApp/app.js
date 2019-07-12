'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const passport = require('passport');
const https = require('https');
const http = require('http'); // for localhost testing
const qs = require('querystring');
const bunyan = require('bunyan');
const Promise = require('bluebird');

const config = require('./config');
const PORT = process.env.PORT || 3000;

var OIDCStrategy = require('passport-azure-ad').OIDCStrategy;

var log = bunyan.createLogger({
	name: 'Durable Function API with Token Store Example'
});

passport.serializeUser(function (user, done) {
	done(null, user.oid);
});

passport.deserializeUser(function (oid, done) {
	findByOid(oid, function (err, user) {
		done(err, user);
	});
});

// array to hold logged in users
var users = [];

var findByOid = function (oid, fn) {
	for (var i = 0, len = users.length; i < len; i++) {
		var user = users[i];
		log.info('we are using user: ', user);
		if (user.oid === oid) {
			return fn(null, user);
		}
	}
	return fn(null, null);
};


//-----------------------------------------------------------------------------
// Set up authentication using values in config.js
//-----------------------------------------------------------------------------
const { creds } = config;

const options = {
	identityMetadata: creds.identityMetadata,
	clientID: creds.clientID,
	responseType: creds.responseType,
	responseMode: creds.responseMode,
	redirectUrl: creds.redirectUrl,
	allowHttpForRedirectUrl: creds.allowHttpForRedirectUrl,
	clientSecret: creds.clientSecret,
	validateIssuer: creds.validateIssuer,
	passReqToCallback: creds.passReqToCallback,
	scope: creds.scope,
	loggingLevel: creds.loggingLevel,
	useCookieInsteadOfSession: creds.useCookieInsteadOfSession,
	cookieEncryptionKeys: creds.cookieEncryptionKeys
};

passport.use(new OIDCStrategy(options, function (profile, done) {
	if (!profile.oid) {
		return done(new Error("No oid found"), null);
	}
	// asynchronous verification, for effect...
	process.nextTick(function () {
		findByOid(profile.oid, function (err, user) {
			if (err) {
				return done(err);
			}
			if (!user) {
				// "Auto-registration"
				users.push(profile);
				return done(null, profile);
			}
			return done(null, user);
		});
	});
}));


//-----------------------------------------------------------------------------
// Config the app, include middleware
//-----------------------------------------------------------------------------
const app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.logger());
app.use(methodOverride());
app.use(cookieParser());

// set up session middleware
app.use(expressSession({ secret: 'keyboard cat', resave: true, saveUninitialized: false }));
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(__dirname + '/../../public'));


//-----------------------------------------------------------------------------
// Set up the route controller
//-----------------------------------------------------------------------------
function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.redirect('/login');
}

// use the client credentials flow to gain access to Token Store 
function getTokenStoreAccessToken() {
	return new Promise(function (resolve) {
		const { tokenStore } = config;

		let payload = qs.stringify({
			client_id: creds.clientID,
			client_secret: creds.clientSecret,
			grant_type: 'client_credentials',
			scope: `https://${tokenStore.host}/.default`
		});

		let options = {
			method: "POST",
			host: "login.microsoftonline.com",
			path: `/${creds.tenantName}.onmicrosoft.com/oauth2/v2.0/token`,
			headers: {
				"Accept": "*/*",
				"accept-encoding": "gzip, deflate",
				"Cache-control": "no-cache",
				"Connection": "keep-alive",
				"Content-Type": "application/x-www-form-urlencoded",
				"Content-Length": Buffer.byteLength(payload),
				"Host": "login.microsoft.com"
			}
		};

		let req = https.request(options, res => {
			let data = '';
			res.on("data", chunk => {
				data += chunk;
			});
			res.on("end", () => {
				resolve(JSON.parse(data));
			});
			res.on("error", err => {
				console.log(`ERROR ${res.statusCode}: ${err}`);
			});
		});

		req.write(payload);
		req.end();
	});
}

// create a new Token Store user token
function createTokenResource(accessToken, user) {
	return new Promise(function (resolve) {
		const { tokenStore } = config;

		let payload = JSON.stringify({
			displayName: user.displayName
		});

		let options = {
			method: "PUT",
			hostname: tokenStore.url,
			path: `/services/${tokenStore.serviceName}/tokens/${user.oid}`,
			headers: {
				"Accept": "*/*",
				"Authorization": `Bearer ${accessToken}`,
				"accept-encoding": "gzip, deflate",
				"Cache-control": "no-cache",
				"Connection": "keep-alive",
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(payload),
				"Host": tokenStore.url
			}
		};

		let req = https.request(options, res => {
			let data = '';

			res.on("data", chunk => {
				data += chunk;
			});

			res.on("end", () => {
				// generate loginURL for token in Token Store
				resolve(
					`https://${tokenStore.url}
				/services/${tokenStore.serviceName}
				/tokens/${user.oid}
				/login?PostLoginRedirectUrl=${creds.hostURL}/schedule/callback`
				);
			});

			res.on("error", err => {
				console.log(`ERROR ${res.statusCode}: ${err}`);
			});
		});

		req.write(payload);
		req.end();
	});
}

// get access token for middle tier API using Token Store
function getTokenResource(accessToken, user) {
	return new Promise(function (resolve) {
		const { tokenStore } = config;

		let options = {
			hostname: tokenStore.url,
			path: `/services/${tokenStore.serviceName}/tokens/${user.oid}`,
			headers: {
				"Accept": "*/*",
				"Authorization": `Bearer ${accessToken}`,
				"Cache-control": "no-cache",
				"Connection": "keep-alive"
			}
		};

		https.get(options, res => {
			let data = '';
			res.on("data", chunk => {
				data += chunk;
			});
			res.on("end", () => {
				resolve(JSON.parse(data));
			});
			res.on("error", err => {
				console.log(`ERROR ${res.statusCode}: ${err}`);
			});
		});
	});
}

// use apiToken from Token Store to call Durable Function API
function callAPI(apiToken) {
	return new Promise(function (resolve) {
		const { apiInfo } = config;

		let options = {
			hostname: apiInfo.host,
			path: apiInfo.path,
			port: apiInfo.localPort, // for localhost testing
			headers: {
				"Accept": "*/*",
				"Authorization": `Bearer ${apiToken}`,
				"Cache-control": "no-cache",
				"Connection": "keep-alive",
				"Host": apiInfo.host
			}
		};

		// NOTE: toggle this to http or https depending on if using localhost
		http.get(options, res => {
			let data = '';
			res.on("data", chunk => {
				data += chunk;
			});
			res.on("end", () => {
				resolve(JSON.parse(data));
			});
			res.on("error", err => {
				console.log(`ERROR ${res.statusCode}: ${err}`);
			});
		});
	});
}

app.get('/', function (req, res) {
	res.render('index', { user: req.user });
});

// '/account' is only available to logged in user
app.get('/account', ensureAuthenticated, function (req, res) {
	res.render('account', { user: req.user });
});

// '/schedule' is only available to logged in user
app.get('/schedule', ensureAuthenticated, function (req, res) {
	getTokenStoreAccessToken()
		.then(accessTokenResponse => {
			let accessToken = accessTokenResponse['access_token'];
			return createTokenResource(accessToken, req.user);
		})
		.then(loginUrl => {
			res.render('schedule', { user: req.user, apiResponse: loginUrl });
		});
});

// '/schedule/callback' is redirected to after auth flow following '/schedule'
app.get('/schedule/callback', ensureAuthenticated, function (req, res) {
	getTokenStoreAccessToken()
		.then(accessTokenResponse => {
			let accessToken = accessTokenResponse['access_token'];
			return getTokenResource(accessToken, req.user);
		})
		.then(token => {
			let apiToken = token['value']['accessToken'];
			return callAPI(apiToken);
		})
		.then(apiResponse => {
			console.log(apiResponse);
			let statusQueryURL = apiResponse['body']['statusQueryGetUri'];
			
			// for local testing - the port is not typically present
			statusQueryURL = statusQueryURL.replace('localhost', 'localhost:7070');

			res.redirect(statusQueryURL);
		});
});

app.get('/login',
	function (req, res, next) {
		passport.authenticate('azuread-openidconnect',
			{
				response: res,
				failureRedirect: '/'
			}
		)(req, res, next);
	},
	function (req, res) {
		log.info('Login was called in the Sample');
		res.redirect('/');
	}
);

// 'GET returnURL'
// `passport.authenticate` will try to authenticate the content returned in
// query (such as authorization code). If authentication fails, user will be
// redirected to '/' (home page); otherwise, it passes to the next middleware.
app.get('/auth/openid/return',
	function (req, res, next) {
		passport.authenticate('azuread-openidconnect',
			{
				response: res,
				failureRedirect: '/'
			}
		)(req, res, next);
	},
	function (req, res) {
		log.info('We received a return from AzureAD.');
		res.redirect('/');
	}
);

// 'POST returnURL'
// `passport.authenticate` will try to authenticate the content returned in
// body (such as authorization code). If authentication fails, user will be
// redirected to '/' (home page); otherwise, it passes to the next middleware.
app.post('/auth/openid/return',
	function (req, res, next) {
		passport.authenticate('azuread-openidconnect',
			{
				response: res,
				failureRedirect: '/'
			}
		)(req, res, next);
	},
	function (req, res) {
		log.info('We received a return from AzureAD.');
		res.redirect('/');
	}
);

// 'logout' route, logout from passport, and destroy the session with AAD.
app.get('/logout', function (req, res) {
	req.session.destroy(function (err) {
		req.logOut();
		res.redirect(config.destroySessionUrl);
	});
});

app.listen(PORT);

