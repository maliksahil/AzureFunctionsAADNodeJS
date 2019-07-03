const createHandler = require("azure-function-express").createHandler;
const express = require("express");
const passport = require('passport');
const config = require('../config');

const BearerStrategy = require("passport-azure-ad").BearerStrategy;

const { creds } = config;
const options = {
    identityMetadata: creds.identityMetadata,
    clientID: creds.clientID,
    issuer: creds.issuer,
    audience: creds.audience,
    loggingLevel: creds.loggingLevel,
    passReqToCallback: creds.passReqToCallback
};

const bearerStrategy = new BearerStrategy(options, function (token, done) {
    done(null, {}, token);
});

const app = express();

app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(passport.initialize());
passport.use(bearerStrategy);

// Enable CORS for * because this is a demo project
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Authorization, Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

// This is where your API methods are exposed
app.get(
    "/api",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        const { authInfo } = req;
        console.log(JSON.stringify(authInfo));
        res.status(200).json({ authInfo });
    }
);

module.exports = createHandler(app);
