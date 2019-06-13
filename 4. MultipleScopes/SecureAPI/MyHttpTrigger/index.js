const createHandler = require("azure-function-express").createHandler;
const express = require("express");
const passport = require('passport');

const BearerStrategy = require("passport-azure-ad").BearerStrategy;
const options = {
    identityMetadata: "https://login.microsoftonline.com/<client-id>/v2.0/.well-known/openid-configuration",
    clientID: "<client-id>",
    issuer: "https://sts.windows.net/<client-id>/",
    audience: "<app-id-uri>",
    loggingLevel: "info",
    passReqToCallback: false,
    scope: ['<custom.scope.1>', '<custom.scope.2>', '<custom.scope.3>'] // list valid scopes; returns a 401 immediately if none of these are used
};

// We use the verify callback to pass along the validated scopes to the API methods for access control
const bearerStrategy = new BearerStrategy(options, (token, done) => {
    let tokenScopes = token.scp.split(/[ ]+/).filter(Boolean);
    done(null, {}, [...tokenScopes]);
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
    "/api/custom-scope-1",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        const scopes = req.authInfo;
        if (scopes.indexOf('<custom.scope.1>') === -1)
            res.status(401).send();
        else
            res.status(200).json({ scopes });
    }
);

app.get(
    "/api/custom-scope-2",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        const scopes = req.authInfo;
        if (scopes.indexOf('<custom.scope.2>') === -1)
            res.status(401).send();
        else
            res.status(200).json({ scopes });
    }
);

app.get(
    "/api/custom-scope-3",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        const scopes = req.authInfo;
        if (scopes.indexOf('<custom.scope.3>') === -1)
            res.status(401).send();
        else
            res.status(200).json({ scopes });
    }
);

module.exports = createHandler(app);
