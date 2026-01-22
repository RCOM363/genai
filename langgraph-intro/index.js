import readLine from "node:readline/promises";

import { ChatGroq } from "@langchain/groq";
import { tool } from "@langchain/core/tools";
import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "langchain";
import { TavilySearch } from "@langchain/tavily";
import * as z from "zod";

const rl = readLine.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const MessageState = new StateSchema({
  messages: MessagesValue,
});

const checkpointer = new MemorySaver();

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0,
});

const webSearch = tool(
  async ({
    query,
    maxResults = 5,
    topic = "general",
    includeRawContent = false,
  }) => {
    console.log("searching web...");
    const tavilySearch = new TavilySearch({
      maxResults,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      includeRawContent,
      topic,
    });
    return await tavilySearch._call({ query });
  },
  {
    name: "web-search",
    description: "Search the internet for latest information",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of results to return"),
      topic: z
        .enum(["general", "news", "finance"])
        .optional()
        .default("general")
        .describe("Search topic category"),
      includeRawContent: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include raw content"),
    }),
  },
);

const toolsByName = {
  [webSearch.name]: webSearch,
};
const tools = Object.values(toolsByName);
const modelWithTools = model.bindTools(tools);

async function modelCall(state) {
  console.log("calling LLM...");
  const response = await modelWithTools.invoke(state.messages);
  return {
    messages: [response],
  };
}

async function toolNode(state) {
  const lastMessage = state.messages.at(-1);

  if (lastMessage === null || !AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }

  const results = [];
  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name];
    const observation = await tool.invoke(toolCall);
    results.push(observation);
  }

  return { messages: results };
}

function shouldContinue(state) {
  const lastMessage = state.messages.at(-1);

  if (lastMessage === null || !AIMessage.isInstance(lastMessage)) {
    return END;
  }

  if (lastMessage.tool_calls?.length) {
    return "toolNode";
  }

  return END;
}

const agent = new StateGraph(MessageState)
  .addNode("modelCall", modelCall)
  .addNode("toolNode", toolNode)
  .addEdge(START, "modelCall")
  .addConditionalEdges("modelCall", shouldContinue, ["toolNode", END])
  .addEdge("toolNode", "modelCall")
  .compile({ checkpointer });

async function chatbot() {
  while (true) {
    const query = await rl.question("You: ");
    if (query === "exit") {
      break;
    }
    const result = await agent.invoke(
      {
        messages: [new HumanMessage(query)],
      },
      { configurable: { thread_id: "1" } },
    );

    console.log(`AI: ${result.messages.at(-1).content}`);
  }
  rl.close();
}

chatbot();
