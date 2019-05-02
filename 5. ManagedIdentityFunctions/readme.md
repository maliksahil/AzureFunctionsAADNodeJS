# Managed Identity with Azure functions

In this demo we will see how you can levarage managed identity with Azure functions to access secrets stored in key vault - both are very central to Microsoft's idetity story.

## How managed identities work

1. The Azure resource manager receives a request to enable a managed identity. If it’s a system-assigned managed identity, the request is for the specific resource that the identity is intended for. If it’s a user-assigned managed identity, you get to pick the user-assigned identity.
2. The Azure resource manager creates a service principal in Azure AD. This service principal is created in the Azure AD tenant that’s trusted by the subscription.
3. The Azure resource manager then configures the identity on the Azure resource. This means that it updates the Azure instance metadata service (IMDS) identity endpoint with the service principal client ID and certificate. Currently, it also provisions a VM extension that adds that service principal client ID and certificate, although this will be deprecated in the very near future. The IMDS service is a REST endpoint within the IaaS VM and is available on a non-routable IP address of 169.254.169.254 and can be accessed only from within the VM. Remember that associating the identity with the VM is a required step for system-assigned identity, but not for user-assigned identity.

## How can you use a managed identity?

1. To call the Azure resource manager, use role-based access control (RBAC) in Azure AD to assign the appropriate role to the service principal.
2. To call the Key Vault, grant your code access to the specific secret or key in Key Vault.
3. Use the IMDS service to request an access token. The request is made to http://169.254.169.254/metadata/identity/oauth2/token. This request is made using the client ID and certificate of the service principal, and you get your usual JWT token that you can use to do your usual Azure AD authentication.

## Demo time

### First we create a function app,

1. Create a resource group `az group create --name myResourceGroup --location eastus`
2. Create an app service plan `az appservice plan create -g myResourceGroup -m BCheap --sku B1`
3. Create a storage account `az storage account create -n sahilstorageaccount -g myResourceGroup -l eastus --sku Standard_LRS`
4. Create a new function app `az functionapp create -p BCheap --name sahilFunctionApp --os-type Windows --resource-group myResourceGroup --runtime dotnet --storage-account sahilstorageaccount`
5. Next we assign a managed identity to the function app,`az functionapp identity assign -g myResourceGroup -n sahilFunctionApp` note down the `principalID`

### Next lets setup the key vault,

1. First we create the keyvault, `az keyvault create --location eastus --name sahilKeyvault --resource-group myResourceGroup`
2. Then create a secret `az keyvault secret set --name sahilSecret --vault-name sahilKeyvault --value "A big secret"`
3. Get the secret uri `az keyvault secret show --vault-name sahilkeyvault --name sahilSecret --query "id"` .. note this down
4. Grant access for our managed identity to read this key vault

az keyvault set-policy -n sahilKeyvault --secret-permissions get --object-id <principalID> 654435bf-0d8f-4874-98bc-349e38304afd

### Next lets write the Azure function

There are many ways to write functions, I will demonstrate using VSCode and Azure Functions CLI

1. Install the Azure functions core tools `npm install -g azure-functions-core-tools` also make sure you have .net core sdk installed for your platform. https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local#v2
2. Create a new functions project using dotnet `func init MyFunctionProj` 
3. Go into that directory `cd MyFunctionProj` and create a new function `func new --name MyHttpTrigger --template "HttpTrigger"`
4. Install the following nuget packages
```
dotnet add package Microsoft.Azure.Services.AppAuthentication
dotnet add package Microsoft.Azure.KeyVault
```
5. Add the following code in the function C# file,
```
using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

using Microsoft.Azure.Services.AppAuthentication;
using Microsoft.Azure.KeyVault;

namespace MyFunctionProj
{
    public static class MyHttpTrigger
    {
        [FunctionName("MyHttpTrigger")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("C# HTTP trigger function processed a request.");

            try
            {
                var azureServiceTokenProvider = new AzureServiceTokenProvider();
                var kv = new KeyVaultClient(
                    new KeyVaultClient.AuthenticationCallback(azureServiceTokenProvider.KeyVaultTokenCallback));
                    var secretURI = "secreturi";
                    var secret = await kv.GetSecretAsync(secretURI);                    
                    return (ActionResult)
                    new OkObjectResult($"Secret vaue:, {secret}");
            }
            catch (Exception e)
            {
                return (ActionResult)
                new OkObjectResult(e.ToString());
            }
        }
    }
}
```
6. Deploy the function using VSCode, and ensure that this function uses anonymous auth. In the real world, you will never have anonymous authentication talking to key vault, but this simplifies our demo.
7. Run the function, verify that it produces a JSON output of the key vault secret, similar to below 
```
{
    "SecretIdentifier": {
        "BaseIdentifier": "https://sahilkeyvault.vault.azure.net:443/secrets/sahilSecret",
        "Identifier": "..removed..",
        "Name": "sahilSecret",
        "Vault": "https://sahilkeyvault.vault.azure.net:443",
        "VaultWithoutScheme": "sahilkeyvault.vault.azure.net",
        "Version": "..removed.."
    },
    "value": "A big secret",
    "id": "https://sahilkeyvault.vault.azure.net/secrets/sahilSecret/..removed..",
    "contentType": null,
    "attributes": {
        "recoveryLevel": "Purgeable",
        "enabled": true,
        "nbf": null,
        "exp": null,
        "created": 1556739847,
        "updated": 1556739847
    },
    "tags": {
        "file-encoding": "utf-8"
    },
    "kid": null,
    "managed": null
}
```

## Clean up
1. Delete the resource group `az group delete --name myResourceGroup`