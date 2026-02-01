import readLine from "node:readline/promises";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

/**
 * ReadLine interface
 * @constant
 */
const rl = readLine.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Groq client instance
 * @constant
 */
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Tavily client instance
 * @constant
 */
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function main() {
  /**
   * Conversation state shared across user, assistant, and tool messages
   * Initialized with a system-level instruction for the model
   */
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

  /**
   * Tool definitions provided to the model
   */
  const tools = [
    {
      type: "function",
      function: {
        name: "webSearch",
        description:
          "Search the latest information and realtime data on the internet",
        parameters: {
          // JSON Schema object for tool's expected input
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

    // Append the user query to the messages array (conversation history)
    messages.push({
      role: "user",
      content: userQuery,
    });

    // LLM loop - Continue the steps until the LLM returns the final result
    while (true) {
      // Request a chat completion
      const chatCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      });

      // Extract tool calls from the model's response, if any
      const toolCalls = chatCompletion.choices[0].message?.tool_calls;

      // If there are no tool calls, then it is the model's final reponse
      if (!toolCalls) {
        // Parse and output the validated response
        console.log("Assistant: ", chatCompletion?.choices[0]?.message.content);
        break;
      }

      // Push the model's response to conversation history
      messages.push(chatCompletion.choices[0].message);

      // For each tool call requested by the modal, invoke the corresponding funtion
      for await (const toolCall of toolCalls) {
        // Extract function name & arguments
        const functionName = toolCall.function.name;
        const functionArguments = toolCall.function.arguments;
        switch (functionName) {
          case "webSearch":
            // Invoke web search tool with parsed arguments
            const toolResult = await webSearch(JSON.parse(functionArguments));

            // Append tool output to conversation history
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

// Entry point
main();

/**
 * Web search tool - uses tavily to search the internet for real-time/latest data
 * @param { query: string } param0 - Search query
 * @returns { string } - Search result
 */
async function webSearch({ query }) {
  console.log("Searching web...");

  const response = await tvly.search(query);

  // Combine result contents into single a string
  const finalContent = response.results.map((res) => res.content).join("\n\n");

  return finalContent;
}
