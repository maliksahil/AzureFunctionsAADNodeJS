const createHandler = require("azure-function-express").createHandler;
const express = require("express");
const passport = require('passport');
const df = require("durable-functions");
const config = require("../config");

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
app.use(require('body-parser').urlencoded({ "extended": true }));
app.use(passport.initialize());
passport.use(bearerStrategy);

app.get("/api", passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        const { authInfo, context } = req;
        const userOID = authInfo.oid;   
        console.log("Validated claims: ", JSON.stringify(authInfo));
        
        const { durableFunc } = config;
        const client = df.getClient(context);

        client.startNew(durableFunc.orchestratorFuncName, undefined, userOID)
            .then(instanceId => {
                context.log(`Started orchestration with ID = '${instanceId}'.`);
                res.status(200).json(client.createCheckStatusResponse(context.bindingData.req, instanceId));
            });
        
    }
);

module.exports = createHandler(app);
