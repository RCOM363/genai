import readLine from "node:readline/promises";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

const rl = readLine.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function main() {
  const messages = [
    {
      role: "system",
      content: `You are a smart assistant who answers the asked questions
            You have access to following tools:
            1. webSearch({query}:{query: string}) // Search the latest information and realtime data on the internet

            Here's the current data & time: ${new Date().toUTCString()}
        `,
    },
  ];

  const tools = [
    {
      type: "function",
      function: {
        name: "webSearch",
        description:
          "Search the latest information and realtime data on the internet",
        parameters: {
          // JSON Schema object
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to perform search on",
            },
          },
          required: ["query"],
        },
      },
    },
  ];

  // User input loop
  while (true) {
    // Get user query
    const userQuery = await rl.question("You: ");

    // Exit condition
    if (userQuery === "exit") {
      break;
    }

    // Add the user query to the messages array
    messages.push({
      role: "user",
      content: userQuery,
    });

    // LLM loop - Continue the steps until the LLM returns the final result
    while (true) {
      // Ask LLM
      const chatCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      });

      const toolCalls = chatCompletion.choices[0].message?.tool_calls;

      // Break if it is the final result
      if (!toolCalls) {
        console.log("Assistant: ", chatCompletion?.choices[0]?.message.content);
        break;
      }

      // Push the tools calls to messages array
      messages.push(chatCompletion.choices[0].message);

      // Invoke required tool & push the result in messages array
      for await (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArguments = toolCall.function.arguments;
        switch (functionName) {
          case "webSearch":
            const toolResult = await webSearch(JSON.parse(functionArguments));
            messages.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: functionName,
              content: toolResult,
            });
            break;

          // other tools

          default:
            console.log("Invalid tool");
        }
      }
    }
  }

  rl.close();
}

main();

async function webSearch({ query }) {
  console.log("Searching web...");

  const response = await tvly.search(query);

  const finalContent = response.results.map((res) => res.content).join("\n\n");

  return finalContent;
}
