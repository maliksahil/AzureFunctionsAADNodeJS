/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by an orchestrator function.
 */
const Promise = require("bluebird");
const https = require("https");
const http = require("http"); // for localhost testing
const qs = require("querystring");
const config = require("../config");

module.exports = async function (context) {
    const userOID = context.bindings.oid;

    return getTokenStoreAccessToken()
        .then(accessTokenResponse => {
            let accessToken = accessTokenResponse['access_token'];
            return getTokenResource(accessToken, userOID);
        })
        .then(token => {
            let apiToken = token['value']['accessToken'];
            return getTokenOnBehalfOf(apiToken);
        })
        .then(newTokenResponse => {
            let newToken = newTokenResponse['access_token'];
            return callResourceAPI(newToken);
        })
        .then(apiResponse => {
            return apiResponse;
        });
};


// Helper functions -------

// returns access token to enable this API to access Token Store
function getTokenStoreAccessToken() {
    return new Promise(function (resolve) {
        const { creds, tokenStore } = config;
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

// returns a valid "fresh" access token for the user 
function getTokenResource(accessToken, userOID) {
    return new Promise(function (resolve) {
        const { tokenStore } = config;
        let options = {
            hostname: tokenStore.url,
            path: `/services/${tokenStore.serviceName}/tokens/${userOID}`,
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

// returns an On-Behalf-Of access token for the user to call API with
function getTokenOnBehalfOf(userToken) {
    return new Promise(function (resolve) {
        const { creds, resourceAPI } = config;
        let payload = qs.stringify({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            client_id: creds.clientID,
            client_secret: creds.clientSecret,
            scope: resourceAPI.scope,
            assertion: userToken,
            requested_token_use: 'on_behalf_of'
        });
    
        let options = {
            method: "POST",
            host: "login.microsoftonline.com",
            path: `/${creds.tenantName}.onmicrosoft.com/oauth2/v2.0/token`,
            port: "443",
            headers: {
                "Accept": "*/*",
                "Cache-control": "no-cache",
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(payload)
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
            })
        });
    
        req.write(payload);
        req.end();
    });
}

// returns JSON response from API
function callResourceAPI(newTokenValue) {
    return new Promise(function (resolve) {
        const { resourceAPI } = config;
        let options = {
            host: resourceAPI.host,
            port: resourceAPI.localPort, // for localhost testing
            path: resourceAPI.path,
            headers: {
                "Authorization": `Bearer ${newTokenValue}`
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
            })
        });
    });
}