import { GoogleGenerativeAI } from "@google/generative-ai";
async function test() {
  const apiKey = "AIzaSyDK_Nm9uI4DI8gNloBr-G7pCCl2Og-wNNw";
  // The SDK doesn't easily list models without an authenticated client, so let's try a direct REST call
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  console.log(data.models?.map((m: any) => m.name).join("\n"));
}
test().catch(console.error);
