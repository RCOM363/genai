import Groq from "groq-sdk";
import { tavily } from "@tavily/core";
import NodeCache from "node-cache";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const MAX_RETIRES = 10;

// Memory for context
const myCache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // 24 hrs cache

export async function generate(userMessage, threadId) {
  const baseMessages = [
    {
      role: "system",
      content: `
      You are a smart assistant. 
      If you answer to a question, answer it directly in plain english.
      If the answer required real-time, local, or up-to-date information, or if you dont know the answer, use the available tools to find it.
    
      You have access to following tools:
      1. webSearch({query}:{query: string}): use this to search the internet for current or unknow information.

      Decide when to use your own knowledge and when to use the tool.
      Do not mention the tool unless needed.
      
      Examples:
      Q: What is the capital of France?
      A: The capital of France is Paris.

      Q: What's the weather in Mumbai?
      A: (use the search tool to get the latest weather)

 
      Here's the current data & time: ${new Date().toUTCString()}
        `,
    },
  ];

  // Get prev msg if they exists
  const messages = myCache.get(threadId) ?? baseMessages;

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

  try {
    // LLM loop - Continue the steps until the LLM returns the final result
    let count = 0;
    while (true) {
      if (count > MAX_RETIRES) {
        return "I could not find the result, please try again.";
      }

      // Add the user query to the messages array
      messages.push({
        role: "user",
        content: userMessage,
      });

      // Ask LLM
      count++;
      const chatCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      });

      if (!chatCompletion) {
        console.log("here?");
      }

      console.log(chatCompletion);

      const toolCalls = chatCompletion.choices[0].message?.tool_calls;

      // Break if it is the final result
      if (!toolCalls) {
        // Update the cache with latest context
        myCache.set(threadId, messages);
        return chatCompletion?.choices[0]?.message.content;
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
  } catch (error) {
    console.error(error?.message);
    return "Something went wrong, please try again later.";
  }
}

async function webSearch({ query }) {
  console.log("Searching web...");

  const response = await tvly.search(query);

  const finalContent = response.results.map((res) => res.content).join("\n\n");

  return finalContent;
}
