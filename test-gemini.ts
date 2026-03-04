import { GoogleGenerativeAI } from "@google/generative-ai";
async function test() {
  const apiKey = "AIzaSyDK_Nm9uI4DI8gNloBr-G7pCCl2Og-wNNw";
  const genAI = new GoogleGenerativeAI(apiKey);
  for (const modelName of ["gemini-2.5-flash", "gemini-flash-latest"]) {
    try {
      console.log(`Testing with ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      await model.generateContent("Hello!");
      console.log(`Success with ${modelName}!`);
      return;
    } catch (err: unknown) {
      console.error(`Error with ${modelName}:`, err instanceof Error ? err.message : String(err));
    }
  }
}
test().catch(console.error);
