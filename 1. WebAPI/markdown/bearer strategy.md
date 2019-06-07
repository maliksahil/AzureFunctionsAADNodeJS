# Bearer Strategy
Bearer Strategy in the context of this WebAPI scenario refers to the Bearer Token protocol to protect web resources (i.e. an API). It works in the following way:
- User sends a request to the protected web API containing an access token in either the authorization header or body
- Passport extracts and validates the access token, then propogating the claims in the token to the verify callback
- The Passport framework finishes the authentication procedure and on success, it adds the user information to `req.user` and passes it to the next middleware
- This next middleware is usually the business logic of the web resource/API
- In case of some error in authentication, Passport will send back an unauthorized response 

## More Resources
Learn more about [Bearer Token protocol](https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-v2-protocols#tokens).

Learn more about Passport's [Azure AD Passport.js plugin](http://www.passportjs.org/packages/passport-azure-ad/).
