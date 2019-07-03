# Asynchronous Auth Using Azure Durable Functions and Token Store

This code example primarily builds on the On-Behalf-Of (OBO) Flow NodeJS scenario by also adding the challenge of adding an arbitrarily long delay to the second API call. 

In the OBO scenario, the middle-tier API requests a new access token on behalf of the user. This works just fine and allows for that middle-tier API to call another API on the user's behalf. However, if the user's initial access token expires before the middle-tier API requests a new token on their behalf, the request will fail because that initial token will no longer be valid. 

This scenario allows for the delay to be any length (less than the 7 day Azure Storage hard limit), surpassing even the one-hour expiration time of any single access token while still being secure.

The key to making this work are in taking advantage of Azure's **Durable Functions** and **Token Store**. 
- [Durable Functions](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview) are an extension of Azure Functions, allowing you to define stateful workflows using the concept of an [orchestrator function](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-types-features-overview). A couple use cases are running functions on a timer or delay and orchestrating multiple azure functions to run in parallel.
- Token Store (in Private Preview at time of writing) is a service that manages tokens for you and allows for you to always get a "fresh" access token for a configured app service (like an API). It handles refreshing and getting new access tokens for you, so you only need to request a specific token resource to retrieve a valid access token.

## The detailed flow will be as follows
1. **User** logs into **WebApp**
2. **WebApp** requests access token to be able to talk to **Token Store**
3. **WebApp** creates token resource in **Token Store** for the user (using user's OID as its name)
4. **WebApp** requests valid access token for **middle-tier API** from **Token Store**
5. **User** must grant consent for **Token Store** to manage their tokens for **middle-tier API**
6. **WebApp** uses retrieved valid access token to call **middle-tier API**
7. **Middle-tier API** authenticates against user token and keeps track of user's OID
8. **Middle-tier API** will delay for some amount of time (via *orchestration function*)
9. **Middle-tier API** requests access token to talk to **Token Store** 
10. **Middle-tier API** uses that to request the token resource from **Token Store** using the user OID as the name
11. **Middle-tier API** receives a "refreshed" access token for that user that it will use for the on-behalf-of flow
12. **Middle-tier API** gets new valid access token to use for the **second API** call
13. **Middle-tier API** calls the **second API** with that token
14. **Second API** authenticates against that token and returns its valid response (in this case just listing the claims in the token)

## Prerequisites
1. You must have Visual Studio Code installed
2. You must have Azure Functions core tools installed `npm install -g azure-functions-core-tools`
3. Azure Functions VSCode extension (https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
4. You must have Azure CLI installed (https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest)
5. It'll make it easier to follow if you use the working On-Behalf-Of Flow scenario as a starting point

Using the OBO flow scenario as a starting point, these are the main steps:

a) Deploy and configure a Token Store to Azure via ARM template <br>
b) Build out a simple WebApp to use and log into instead of mocking one <br>
c) Modify the Web App to be able to create a token resource in Token Store by user <br>
d) Modify the middle-tier API to use Durable Functions and to retrieve Token Store resources <br>
e) Deploy it all

We can test all of these components locally before deployment (except for the Token Store).

## Deploy a Token Store via ARM template
Since much of our configuration and changes in the WebApp and middle-tier API are based on an existing Token Store, let's start by getting one set up. 
> Note: In order to use Token Store (as it's currently in Private Preview) you need to have your Azure subscription white-listed. See more information on how to do that and on other general things about Token Store, click [here](https://github.com/Azure/azure-tokens).

At the time of writing, the only way to deploy a Token Store to Azure is via an Azure Resource Manager (ARM) template. Our ARM template for a Token Store is pretty straightforward and will be provided in this sample, but to learn more about ARM templates in general, feel free to check out the documentation [here](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-authoring-templates).

Let's get to the template itself: [tokenstoredeploy.json](./WebApp/tokenstoredeploy.json). Change `<token-store-name>` to any name you like.
```json
{
    ...
    "parameters": {
        "tokenStoreName": {
            "type": "string",
            "defaultValue": "<token-store-name>",
            "metadata": {
                "description": "Name of the Token Store resource to be created"
            }
        },
        ...
    },
    ...
}
```
Next, let's populate the information for our Token Store service (the relationship between our client app and middle-tier API in this case): <br>`<token-store-service-name>`, `<web-app-client-id>`, `<web-app-client-secret>`, and `<middle-tier-api-app-id-uri>`
```json
{
    ...
    "resources": {
        "type": "Microsoft.Token/stores",
        ...
        "resources": [
            {
                "type": "services",
                "name": "<token-store-service-name>",
                ...
                "properties": {
                    "displayName": "Middle-tier API",
                    "authentication": {
                        ...
                        "parameters": {
                            "ClientId": "<web-app-client-id>",
                            "ClientSecret": "<web-app-client-secret>",
                            ...
                            "Scopes": "<middle-tier-api-appIdUri>/.default"
                        }
                    }
                },
                ...
            }
        ]
    },
    ...
}
```

Now let's deploy it using the Azure CLI, specifying any `<resource-group-name>` value you like. In this sample we create a new resource group for the Token Store.
```
az login
az group create --name <resource-group-name> --location "West Central US"
az group deployment create --resource-group <resource-group-name> --template-file tokenstoredeploy.json
```

You should now be able to find your new Token Store resource in the Azure portal under the resource group you specified in the deployment. We can see the service we specified within the Token Store when we navigate to the Token Store resource, then **Settings** -> **Services**.

To finish up configuring Token Store, we need to add a couple access policies so that both our WebApp and middle-tier API can properly access this Token Store. We can do this in the portal by navigating to **Access Policies** and clicking on **Add** for both applications. For the fields it asks you to populate: 
- `Name` can be set to anything you like for each policy
- `Object Id` does **NOT** refer to just what is listed in each application's **Overview** screen under Azure AD. Instead, from **Overview**, click on the link listed in "Managed application in local directory". Then, navigate to **Manage** -> **Properties**, and then find the appropriate value under **Object ID**
- `Tenant Id` just refers to the tenant where the respective application is registered
- For the sake of this demo, I've enabled all `Get`, `List`, `Create`, and `Delete` permissions for both policies

Almost done! Our final step here is to set up the Token Store's **Authorized Post Redirect URLs** in the portal -
```
http://localhost:3000/schedule/callback
https://<web-app-name>.azurewebsites.net/schedule/callback

http://localhost:7070
https://<middle-tier-function-app-name>.azurewebsites.net
``` 
> Note: The first two URLs are for the WebApp and the second two are for the middle-tier API. Also, `<web-app-name>` will be defined when you create and deploy the WebApp.

## Build out and configuring the WebApp
For simplicity's sake, our WebApp is largely based off a Secured NodeJS WebApp Quickstart you can find [here](https://github.com/AzureADQuickStarts/AppModelv2-WebApp-OpenIDConnect-nodejs). All it really does by default is allow for a user to log in and out of the app via Azure AD. 

Assuming you've already gotten the OBO flow scenario working, you should already have an application registered in AAD for the client app and so all we're really doing here is configuring this WebApp with those credentials.

Go to the client WebApp registration and then add the redirect URIs -
```
http://localhost:3000/auth/openid/return
https://<web-app-name>.azurewebsites.net/auth/openid/return
https://<token-store-name>.westcentralus.tokenstore.azure.net/redirect
```
> `<web-app-name>` should match the name you choose when we deploy the WebApp to Azure <br>
> `<token-store-name>` should match the name you chose when deploying the Token Store to Azure

Next, we'll create an external file where we'll have our configuration information. Create and populate a `config.js` file at the root of the WebApp in this project (same level as `app.js`). Make sure to change all values enclosed by `<>`.
```javascript
// custom WebApp-specific values
const tenantName = '<tenant-name>';
const clientID = '<client-id>';
const clientSecret = '<client-secret>';
const scopes = ['<middle-tier-api-appIdUri>/.default'];
const hostURL = 'http://localhost:3000'; // https://<web-app-name>.azurewebsites.net

exports.creds = {
    clientID, clientSecret, tenantName, hostURL,
    identityMetadata: `https://login.microsoftonline.com/${tenantName}.onmicrosoft.com/v2.0/.well-known/openid-configuration`,
    responseType: 'id_token code',
    responseMode: 'form_post',
    redirectUrl: `${hostURL}/auth/openid/return`,
    allowHttpForRedirectUrl: true, // false for Azure deployment
    validateIssuer: false,
    passReqToCallback: false,
    useCookieInsteadOfSession: true,
    cookieEncryptionKeys: [
    	{ 'key': '12345678901234567890123456789012', 'iv': '123456789012' },
    	{ 'key': 'abcdefghijklmnopqrstuvwxyzabcdef', 'iv': 'abcdefghijkl' }
    ],
    scope: ['profile', ...scopes],
    loggingLevel: 'info',
};

exports.destroySessionUrl = `https://login.microsoftonline.com/common/oauth2/logout?post_logout_redirect_uri=${hostURL}`;

exports.tokenStore = {
    host: 'tokenstore.azure.net',
    url: '<token-store-name>.westcentralus.tokenstore.azure.net',
    serviceName: '<token-store-service-name>'
};

exports.apiInfo = {
    host: 'localhost', // <middle-tier-function-app-name>.azurewebsites.net
    path: '/api',
    localPort: '7070'
};
```

That should be all you need to change to be able to just run the WebApp locally -
```
npm install
node app.js | bunyan
```
> Note: `bunyan` is just for logging - you don't have to use it 

At this point, by heading to `localhost:3000` as a user you should be able to log in or out, click on **Account Info** to see your full user claims, and click on **Schedule API Call** to create your token resource in Token Store and redirect you to `/schedule`. 

From that point in the flow, clicking **Call API** requests a valid access token from Token Store for the user to access the middle-tier API. Once received, a call is issued to that API using that access token. 

However, this last step won't work before getting the middle-tier API up and running.

## Configuring the middle-tier API
First, we need to make sure the Azure AD app registration for the middle-tier API has the proper redirect URIs -
```
http://localhost:7070
http://localhost:7070/callback
https://<token-store-name>.westcentralus.tokenstore.azure.net/redirect
```
Then, to allow for the WebApp to use this app's `/.default` scope (like in this sample), we should add the WebApp's Object ID (from **Overview**) to this app's **Manifest** in Azure AD - 
```json
{
    ...
    "knownClientApplications" : [
    	"<web-app-oid>"
    ],
    ...
}
```

Similar to the WebApp, in order for you to get this API running from this sample, you'll just need to create and populate another `config.js` file in the root of MiddleTierAPI (same level as `host.json`) as follows -
```javascript
const tenantID = "<tenant-id>"; // GUID
const clientID = "<client-id>"; // GUID
const clientSecret = "<client-secret>";
const appIdURI = "<app-id-uri>"; // From the Expose an API section
const tenantName = "<tenant-name>";

exports.creds = {
    clientID, clientSecret, tenantName,
    identityMetadata: `https://login.microsoftonline.com/${tenantID}/v2.0/.well-known/openid-configuration`,
    issuer: `https://sts.windows.net/${tenantID}/`,
    audience: appIdURI,
    loggingLevel: "info",
    passReqToCallback: false
};

exports.durableFunc = {
    orchestratorFuncName: "<orchestratorFuncFolderName>", // default: DurableFunctionsOrchestratorJS
    activityFuncName: "<activityFuncFolderName>" // default: Hello
};

// equivalent to SecureAPI from WebAPI scenario
exports.resourceAPI = {
    host: "localhost", // <second-api-name>.azurewebsites.net
    path: "/api",
    localPort: "7071",
    scope: "<second-api-appIdUri>/<custom-scope>"
};

exports.tokenStore = {
    host: 'tokenstore.azure.net',
    url: '<token-store-name>.westcentralus.tokenstore.azure.net',
    serviceName: '<token-store-service-name>'
};
``` 

Similar to the OBO flow scenario, the HTTP Trigger function remains, but we add an orchestrator function and an activity function. The HTTP Trigger invokes the orchestrator function following authentication, which then is responsible for controlling when/how the activity function is fired. 

Given that, most of the OBO flow logic that used to exist within the HTTP Trigger function (in that scenario) was migrated to the activity function so that it can be run on a schedule/delay.

To get this API running locally, press `F5` in VSCode or run -
```
npm install
func start host -p 7070
```
**Note**: By default, pressing `F5` in VSCode will run the API on port 7071 (the same port we will use for the second API). To resolve this, create a `local.settings.json` file in the root of MiddleTierAPI (same level as `host.json`) as follows -
```json
{
    "IsEncrypted": false,
    "Values": {
        ...
    },
    "Host": {
        "LocalHttpPort": 7070,
        "CORS": "*",
        "CORSCredentials": false
    }
}
```

## Configuring the second API
We're almost ready to run the whole thing! We just need to make sure the final piece, the second API, is up and running. If you have gone through the WebAPI scenario or the OBO flow scenario then this piece is identical to the SecureAPI Azure Function App. 

The only difference here is that I've gone ahead and externalized the configuration information similar to what we have for the WebApp and middle-tier API. As such, to get this running let's create the `config.js` file in the root of SecureAPI (same level as `host.json`) as follows -
```javascript
const tenantID = "<tenant-id>"; // GUID
const clientID = "<client-id>"; // GUID
const appIdURI = "<app-id-uri>"; // From the Expose an API section

exports.creds = {
    clientID,
    identityMetadata: `https://login.microsoftonline.com/${tenantID}/v2.0/.well-known/openid-configuration`,
    issuer: `https://sts.windows.net/${tenantID}/`,
    audience: appIdURI,
    loggingLevel: "info",
    passReqToCallback: false
};
```

Let's head over to the second API's app registration in Azure portal and double-check the redirect URIs -
```
http://localhost:7071
http://localhost:7071/callback
https://<second-api-function-app-name>.azurewebsites.net
https://<second-api-function-app-name>.azurewebsites.net/callback
```

To now run the second API locally, press `F5` in VSCode or go ahead and run -
```
npm install
func start host -p 7071
```

## Testing the complete flow (locally)
Once you have all three components up and running (WebApp, middle-tier API, second API), we can now go through the complete user flow to test it locally -
1. Head to `localhost:3000` in your browser (a new Incognito or InPrivate window is preferred for testing) and log in
2. Click on **Schedule API Call** - your token resource for the middle-tier API will be put into Token Store (if it doesn't exist already) and you will be redirected to `/schedule`
3. At this point, you can now click on **Call API**. This will request a new valid access token for the middle-tier API from Token Store and will prompt you with a "Credential access request" screen, allowing you to allow or deny Token Store to manage your middle-tier API credentials
4. Click on **Accept**, which will allow the WebApp to retrieve that new token and use it to call the middle-tier API, redirecting you to `/schedule/callback`. This will also invoke the orchestrator function and schedule the delayed second API call
5. This screen you are redirected to in the browser queries the status of the task that you just scheduled. You can find the current status under the `"runtimeStatus"` field - its value begins as `"Pending"`, then changing to `"Running"` when the orchestrator function is invoked, and finally (hopefully) changing to `"Completed"`
6. Simply refresh the page to get updates. Since this sample is configured for only a 30 second delay (see [DurableFunctionsOrchestrator](./MiddleTierAPI/DurableFunctionsOrchestrator/index.js) for that implementation), refreshing after around 30 seconds should show the status as `"Completed"` and populate the `"output"` field
7. Verify that the output here matches the expected output. In this sample, it should be something like: 
    ```json
    {
        ...
        "output": [{
            "authInfo": {
                "aud": "https://<second-api-name>.<tenant-name>.onmicrosoft.com",
                "iss": "https://sts.windows.net/<tenant-id>/",
                "iat": 1562108642,
                "nbf": 1562108642,
                "exp": 1562112487,
                "acr": "1",
                "aio": "...removed...",
                "amr": [
                    "pwd"
                ],
                "appid": "<client-id>",
                "appidacr": "1",
                "ipaddr": "...removed...",
                "name": "<user-name>",
                "oid": "<user-oid>",
                "scp": "<custom-scope>",
                "sub": "...removed...",
                "tid": "<tenant-id>",
                "unique_name": "...removed...",
                "upn": "...removed...",
                "uti": "...removed...",
                "ver": "1.0"
            }
        }],
        ...
    }
    ```
That's it! If you get a similar output, then the sample is working as intended and you've   successfully scheduled secure tasks using Azure Durable Functions and Token Store.  

## Before Deploying to Azure
Running this on Azure is nearly identical, but there are a couple required code changes mainly due to the change from HTTP calls (localhost) to HTTPS calls (Azure).
### WebApp
Changes in `config.js` - 
```javascript
...

const hostURL = 'https://<web-app-name>.azurewebsites.net'; // from http://localhost:3000

exports.creds = {
    ...
    allowHttpForRedirectUrl: false,
    ...
};

...

exports.apiInfo = {
    host: '<middle-tier-api-name>.azurewebsites.net',
    ...
};
```

Changes in `app.js` -
```javascript
...

function callAPI(apiToken) {
    return new Promise(function (resolve) {
        ...
        // change to https
        https.get(options, res => {
            ...
        });
    });
}

...

app.get('/schedule/callback', ensureAuthenticated, function (req, res) {
    getTokenStoreAccessToken()
        .then( ... )
        .then( ... )
        .then(apiResponse => {
            let statusQueryURL = apiResponse['body']['statusQueryGetUri'];
            // comment the following line out or remove
            // statusQueryURL = statusQueryURL.replace('localhost', 'localhost:7070');
            res.redirect(statusQueryURL);
        });
});

...
```
To deploy this WebApp to a new group and service plan via Azure CLI -
```
az group create --name myResourceGroup --location westus
az appservice plan create --name myPlan --resource-group myResourceGroup --sku S1
az webapp create --name myApp --resource-group myResourceGroup --plan myPlan
az webapp up -n myApp
```

### Middle-tier API
Changes in `config.js` - 
```javascript
...

exports.resourceAPI = {
    host: "<second-api-name>.azurewebsites.net", // from localhost
    ...
};

...
```
Changes in `Schedule/index.js` -
```javascript
...

function callResourceAPI(newTokenValue) {
    return new Promise(function (resolve) {
        ...
        // change to https
        https.get(options, res => {
            ...
        });
    });
}

...
```
Finally, you can deploy this Function App directly to Azure using the VSCode Azure Functions extension.
