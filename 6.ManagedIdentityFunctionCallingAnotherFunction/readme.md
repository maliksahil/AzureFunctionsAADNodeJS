# Managed Identity Fuction calling another function

In this demo we will see how you can securely have one function call another.
The first function (the caller) will be assigned a managed identity.
The second function (the API) will use AAD auth, and expose a Web API protected by AAD. 
The first function will successfully call the second function, under the identity of the managed identity.

It is highly recommended that you first familiarize yourself with the [Managed Identity](../5. ManagedIdentityFunctions) and [WebAPI](../1. WebAPI) scenarios first.

## Setup

The API function will need to be registered as an AAD app.
Ensure that you setup the following return URIs,
```
  https://<yournodejsfunction>.azurewebsites.net/callback
  https://<yournodejsfunction>.azurewebsites.net
```
Ensure that you are able to setup and call your Azure function as an API as identified in the [WebAPI](../1. WebAPI) tutorial first.
Note that you should be able to call `https://<yournodejsfunction>.azurewebsites.net/api` securely using an access token.

Most of the focus here will be the second function.

## 

Use the provided code, and deploy it to a new function app. Remember to update the code to your environment, you will need to make two updates as below,
```
var serviceResourceIDURI = "<appiduri of service>"; // example https://mytestapp1.sahilmalikgmail.onmicrosoft.com
var secureFunctionAPIURL = "https://<api_function>.azurewebsites.net/api";
```

In this new function app, once deployed, give it a managed identity. Note that it's auth level is anonymous. Setting the auth level to anonymous is optional, and merely for convenience. The reason being, you are trying to call FROM this function to the secure Web API, it really doesn't matter for demo purposes how you authenticate to THIS function, as long as THIS function can authenticate securely, using a managed identity, to the API function.

Once this change is made, visit the function via a simple GET request. Verify that you see an output as below,

```
{"headers":[{"key":"Content-Length","value":["2"]},{"key":"Content-Type","value":["application/json; charset=utf-8"]}]}
```

Also verify that the called function streaming logs show an output as below,

```
Executing 'Functions.MyHttpTrigger' (Reason='This function was programmatically called via the host APIs.', Id=066eb529-d1c2-4bbc-9eef-1eb39d9e4dcd)
Executed 'Functions.MyHttpTrigger' (Succeeded, Id=066eb529-d1c2-4bbc-9eef-1eb39d9e4dcd)
Executing 'Functions.MyHttpTrigger' (Reason='This function was programmatically called via the host APIs.', Id=066eb529-d1c2-4bbc-9eef-1eb39d9e4dcd)
Executed 'Functions.MyHttpTrigger' (Succeeded, Id=066eb529-d1c2-4bbc-9eef-1eb39d9e4dcd)
{"name":"AzureAD: Bearer Strategy","hostname":"RD00155DE9E96E","pid":10956,"level":30,"msg":"In Strategy.prototype.authenticate: received metadata","time":"2019-05-13T19:34:10.956Z","v":0}
{"name":"AzureAD: Bearer Strategy","hostname":"RD00155DE9E96E","pid":10956,"level":30,"msg":"In Strategy.prototype.authenticate: we will validate the options","time":"2019-05-13T19:34:10.956Z","v":0}
{"name":"AzureAD: Bearer Strategy","hostname":"RD00155DE9E96E","pid":10956,"level":30,"msg":"In Strategy.prototype.authenticate: access_token is received from request header","time":"2019-05-13T19:34:10.956Z","v":0}
{"name":"AzureAD: Bearer Strategy","hostname":"RD00155DE9E96E","pid":10956,"level":30,"msg":"In Strategy.prototype.jwtVerify: token is decoded","time":"2019-05-13T19:34:10.956Z","v":0}
{"name":"AzureAD: Metadata Parser","hostname":"RD00155DE9E96E","pid":10956,"level":30,"msg":"working on key","time":"2019-05-13T19:34:10.956Z","v":0}
{"name":"AzureAD: Bearer Strategy","hostname":"RD00155DE9E96E","pid":10956,"level":30,"msg":"PEMkey generated","time":"2019-05-13T19:34:10.956Z","v":0}
{"name":"AzureAD: Bearer Strategy","hostname":"RD00155DE9E96E","pid":10956,"level":30,"msg":"In Strategy.prototype.jwtVerify: token is verified","time":"2019-05-13T19:34:10.968Z","v":0}
{"name":"AzureAD: Bearer Strategy","hostname":"RD00155DE9E96E","pid":10956,"level":30,"msg":"In Strategy.prototype.jwtVerify: We did not pass Req back to Callback","time":"2019-05-13T19:34:10.968Z","v":0}
User info:  {}
Validated claims:  { aud: 'https://..removed....onmicrosoft.com',
iss: 'https://sts.windows.net/..removed../',
iat: 1557775142,
nbf: 1557775142,
exp: 1557804242,
aio: '...removed..',
appid: '..removed..',
appidacr: '2',
idp: 'https://sts.windows.net/..removed.../',
oid: '..removed ..',
sub: '..removed ..',
tid: '..removed ..',
uti: '..removed..',
ver: '1.0' }
```

Of special interest is this part `User info:  {}` .. since this is a managed identity, it has no name claim. But you can verify that the API is now being called securely.
