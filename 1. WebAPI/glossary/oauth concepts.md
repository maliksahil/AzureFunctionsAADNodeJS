# OAuth2 Concepts
It's important to understand the Open Authorization standard (OAuth) as well as the different kinds of tokens, use cases, and grant types associated with it.

## What is OAuth?
Put simply, OAuth is an open authorization framework that enables third-party applications to obtain limited access to a web service. This is done through the use of access tokens.

## Tokens
There are generally three types of tokens associated with OAuth - Access Tokens, Refresh Tokens, and ID Tokens.
- ### **Access Token**
    An access token is what an API can use to verify your identity and grant you access. It's usually found in the authorization header of a request - for instance, `Bearer <access-token-value>`. The token value itself is usually in JWT format (`<header>.<payload>.<signature>`) and are short-lived, usually expiring in 30min - 1hr.
- ### **Refresh Token**
    Unlike access tokens, refresh tokens are long-lived but are used solely to get new access tokens. Access tokens are generally provided for a certain resource (or audience), so only clients that can safely secure refresh tokens (a confidential client) should use refresh tokens. 
- ### **ID Token**
    An ID token is merely an identifier for the user, representing their identity. It contains no authorization or audience information. It is also usually in JWT format.

## Grant Types
There are many ways to get access tokens in OAuth2, called grants. Different applications may require different types of grants depending on what they are.
- ### **Client credentials grant**
    Used when the application is a resource owner - an entity that can grant access to a protected resource
- ### **Authorization code grant**
    Used when the application is a confidential client - meaning it can safely secure refresh tokens
- ### **Resource owner password credentials grant**
    Used when the application can be 100% trusted with user credentials; should be avoided
- ### **Implicit flow**
    Used when the application is a public client or native app; this isn't usually a good idea as it can lead to token leakage
- ### **Device flow**
    Used for clients with very limited UI's (i.e. an appliance)

## More Resources
The Microsoft Azure docs also provide really great resources for [OAuth2](https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-v2-protocols) and [OpenID Connect](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-protocols-oidc) - especially useful because they're explained in the context of Azure AD.

Learn more about **tokens** in the [Microsoft Identity Platform Developer Glossary](https://docs.microsoft.com/en-us/azure/active-directory/develop/developer-glossary#security-token) and in [this article](https://winsmarts.com/access-tokens-and-refresh-tokens-and-id-tokens-5261bc26e8a2). Microsoft's Azure identity platform docs also include some more in-depth material on [ID tokens](https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens) and [access tokens](https://docs.microsoft.com/en-us/azure/active-directory/develop/access-tokens).

Learn more about **Confidential and Public Clients** in [this article](https://winsmarts.com/confidential-client-vs-public-client-19068b308d91).

Learn more about the different **grant types** in OAuth in [this article](https://winsmarts.com/oauth2-flows-926d422d5018) or by checking out Microsoft's in-depth overviews on each one [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-implicit-grant-flow) and navigating through them in the navigation pane on the left side.
