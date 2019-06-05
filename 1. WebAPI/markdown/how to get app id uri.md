# How to find your App ID URI
This briefly explains how to find your registered app's `<app_id_uri>` value for use in this WebAPI scenario.

1. Open your [Azure portal](https://portal.azure.com/) and switch into the tenant/domain where your app was registered.
2. In the left panel click on __Azure Active Directory__, and then __App registrations__, and finally on your chosen registered app name.
3. Under __Manage__, select __Expose an API__.
4. On the top of this view, you should see a field called __Application ID URI__ - this is what `<app_id_uri>` refers to. If this is empty, you'll need to set it manually.
5. Standard practice for developing a web API is that the format should be something like: 

        https://<something-unique>.onmicrosoft.com

Learn more about tenants in Azure Active Directory [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/single-and-multi-tenant-apps).