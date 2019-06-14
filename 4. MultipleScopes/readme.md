# Azure Function Web API with Multiple Scopes

This code example demonstrates how to use an Azure Function that exposes a Web API secured by Azure AD, and exposes multiple scopes.

You will need two app registrations for this code example.

1. One that acts as the API (this function)
2. One that acts as a client (not this function, we will mimic client calls as CURL requests)

## Register the client

Register an Azure AD App with the following characterstics,

1. Reply URL of `http://localhost:7071/callback` this can be anything, as long as you accept a reply to it. In our case the auth_code will come back as a query string, which we will just copy paste from the URL, so you don't really need anything running here.
2. Certs and secrets - generate a secret, save it's value. Lets call it `clientsecret`
3. Note down the client id, lets call it `client_id_client`
4. Note down the client app name, lets call it 


## Register the API

Register an Azure AD App with the following characterstics,

1. Reply URLs of 
```
http://localhost:7071/api
http://yourazurefunction.azurewebsites.net/api
```

2. Enable Access Tokens and ID Token under implicit grant area
3. Under expose an API, add scope `admin` - make this admin level scope.
4. Under expose an API, add scope `read` - make this user level scope.
5. Under expose an API, add scope `write` - make this user level scope.
6. Create and copy the app id URI, for instance `https://<yourappname>.<yourtenantname>.onmicrosoft.com` - lets call this `appIDURI`
6. Under authorized client applications, add the application with client id of `client_id_client` and grant it all 3 scopes.
7. Note down it's client id, lets call it `client_id_api`

Additionally, copy the tenant ID, lets call it `tenantId`

## Update the code

You can test this in either a deployed Azure function or running locally.
Under `MyHttpTrigger\index.js` Update the following section with real values matching your API registration.

``` JavaScript
var tenantID = "tenantId";
var clientID = "client_id_api";
var appIdURI = "appIDURI";
```
## Run the code sample.

Run the function, this readme assumes things running locally, but if you are running in Azure, just replace http://localhost:7071 with your azure function URL.

1. Request the auth code using the following URL, remember to place the correct values in the placeholders.

`https://login.microsoftonline.com/<tenantname>.onmicrosoft.com/oauth2/v2.0/authorize?response_type=code&client_id=<client_id_client>&redirect_uri=http://localhost:7071/callback&scope=openid https://<yourappname>.<yourtenantname>.onmicrosoft.com/read`

Note that in the URl we are requesting the read scope, which requires user consent. Verify that the user is asked to consent. 
If you were requesting an admin scope, you would not be required to consent. But the admin will have to grant consent ahead of time.

2. After a succesful authentication, the auth-code is passed back to you in the querystring parameter `code` copy paste that. Lets call this `auth_code` for the purposes of this article.

3. Next issue the following CURL request to get the access token for the API, remember to replace the tokens with the appropriate values.

```
curl -X POST \
  https://login.microsoftonline.com/<tenantname>.onmicrosoft.com/oauth2/v2.0/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'cache-control: no-cache' \
  -d 'redirect_uri=http%3A%2F%2Flocalhost%3A7071%2Fcallback&client_id=<client_id_client>&grant_type=authorization_code&code=<auth_code>&client_secret=<client_secret>&scope=https%3A%2F%2F<yourappname>.<yourtenantname>.onmicrosoft.com%read'
```

4. When you get the access token as return value, issue a GET request as follows
```
curl -X GET \
  http://localhost:7071/api/read \
  -H 'Authorization: Bearer <access_token>' \
   -H 'cache-control: no-cache'
```

Verify that the call succeeds.

5. Now remove one of the access rights, lets say `read` from the client's access permissions, and repeat this test - verify that you get a 401.