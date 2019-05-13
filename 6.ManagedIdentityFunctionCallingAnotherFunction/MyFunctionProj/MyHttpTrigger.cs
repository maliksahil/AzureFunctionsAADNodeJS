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
using System.Net.Http;
using System.Net;

namespace MyFunctionProj
{
public static class MyHttpTrigger
    {
        private static readonly HttpClient httpClient = new HttpClient();

        [FunctionName("MyHttpTrigger")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("C# HTTP trigger function processed a request.");

            try
            {
                var serviceResourceIDURI = "<appiduri of service>"; // example https://mytestapp1.sahilmalikgmail.onmicrosoft.com
                var secureFunctionAPIURL = "https://<api_function>.azurewebsites.net/api";

                var azureServiceTokenProvider = new AzureServiceTokenProvider();
                string accessToken = await azureServiceTokenProvider.GetAccessTokenAsync(serviceResourceIDURI);

                // make a post request to the secure service with the access token.
                var httpRequestMessage = new HttpRequestMessage
                {
                    Method = HttpMethod.Get,
                    RequestUri = new Uri(secureFunctionAPIURL),
                    Headers = {{ HttpRequestHeader.Authorization.ToString(), "Bearer " + accessToken }}
                };
                log.LogInformation(accessToken); // bad bad bad .. but this is demo code, ensure you don't do this in prod.
                var response = await httpClient.SendAsync(httpRequestMessage);
                return (ActionResult) new OkObjectResult(response.Content);
            }
            catch (Exception e)
            {
                return (ActionResult)
                new OkObjectResult(e.ToString());
            }
        }
    }
}
