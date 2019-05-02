const createHandler = require("azure-function-express").createHandler;
const express = require("express");
const passport = require('passport');

var BearerStrategy = require("passport-azure-ad").BearerStrategy;
var options = {
    identityMetadata: "https://login.microsoftonline.com/3f24f082-b92a-465d-9d0a-e953fd653b96/v2.0/.well-known/openid-configuration",
    clientID: "5d30a946-9341-4b54-b950-683bb57202b4",
    issuer: "https://sts.windows.net/3f24f082-b92a-465d-9d0a-e953fd653b96/",
    audience: "https://mytestapp.sahilplayground.onmicrosoft.com",
    loggingLevel: "info",
    passReqToCallback: false
};

var bearerStrategy = new BearerStrategy(options, function (token, done) {
    done(null, {}, token);
});

const app = express();

app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
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
        var claims = req.authInfo;
        console.log("User info: ", req.user);
        console.log("Validated claims: ", claims);
        res.status(200).json({ name: claims["name"] });
    }
);

module.exports = createHandler(app);
