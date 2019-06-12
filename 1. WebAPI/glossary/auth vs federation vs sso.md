# Authentication vs SSO vs Federation

Understanding the key differences and similarities between different methods of verifying identity is important for developers in order to properly secure web applications and APIs. For those new to these concepts, this doc briefly goes over these key concepts and provides resources to learn more. 

## Authentication
At its core, authentication just refers to a process in which an entity (the principal) proves its identity to another entity (the system). The principal provides credentials to the system that are validated using some type of identity system (i.e. User Repository). 

Credentials include things such as:
- User ID and password
- Digital Signature
- Client Certificate
- PIN # and random code from some authenticator technology

## SSO (Single Sign On)
SSO refers to a characteristic of an authentication mechanism where the user's identity, verified via a single authentication process, is used to provide access across multiple systems (Service Providers). These systems can be within a single organization or across multiple organizations.

Examples of that single authentication process for SSO include:
- LDAP server, Active Directory, database, or other directory server
- System that generates and passes a trusted token around to apps for authentication
- Password manager
- Federation

## Federation
Federation is a form of SSO where the actors span multiple organizations and security domains. It can be defined as the trust relationship that exists between these organizations. It is concerned with where the user's credentials are actually stored and how trusted third-parties can authenticate against those credentials without actually seeing them.

Examples of how federation can be implemented:
- [SAML](https://en.wikipedia.org/wiki/Security_Assertion_Markup_Language)
- [WS-Federation](https://medium.com/@robert.broeckelmann/understanding-ws-federation-passive-protocol-3f9dc2175b4f)
- [OAuth and OpenID Connect](https://winsmarts.com/oauth2-and-openid-connect-f3f1e278c571)

## More Resources
[This article](https://medium.com/@robert.broeckelmann/authentication-vs-federation-vs-sso-9586b06b1380) goes into more depth on these three major concepts.