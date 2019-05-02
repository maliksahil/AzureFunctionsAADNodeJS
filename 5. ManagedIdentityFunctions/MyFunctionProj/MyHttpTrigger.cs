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
                    //az keyvault secret show --vault-name sahilkeyvault --name sahilSecret --query "id"
                    var secretURI = "<secretUri>";
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
