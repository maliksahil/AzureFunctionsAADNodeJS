const createHandler = require("azure-function-express").createHandler;
const express = require("express");
const passport = require('passport');

var BearerStrategy = require("passport-azure-ad").BearerStrategy;

var tenantID = "<tenantid>";
var clientID = "<clientid_api>";
var appIdURI = "<appiduri>";

var options = {
    identityMetadata: "https://login.microsoftonline.com/" + tenantID + "/v2.0/.well-known/openid-configuration",
    clientID: clientID,
    issuer: "https://sts.windows.net/" + tenantID + "/",
    audience: appIdURI,
    loggingLevel: "info",
    passReqToCallback: false
};

var bearerStrategy = new BearerStrategy(options, function (token, done) {
    done(null, {}, token);
});

const app = express();

app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({"extended":true}));
app.use(passport.initialize());
passport.use(bearerStrategy);

// This is where your API methods are exposed
app.get(
    "/api/read",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        const scopes = req.authInfo.scp;
        if (scopes.indexOf('write') === -1)
            res.status(401).send();
        else
            res.status(200).json(req.authInfo);
    }
);

app.get(
    "/api/write",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        const scopes = req.authInfo.scp;
        if (scopes.indexOf('write') === -1)
            res.status(401).send();
        else
            res.status(200).json(req.authInfo);
    }
);

app.get(
    "/api/admin",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        const scopes = req.authInfo.scp;
        if (scopes.indexOf('admin') === -1)
            res.status(401).send();
        else
            res.status(200).json(req.authInfo);
    }
);

module.exports = createHandler(app);
