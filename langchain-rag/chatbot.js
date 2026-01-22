import readline from "node:readline/promises";

import Groq from "groq-sdk";

import { vectorStore } from "./document.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function chatbot() {
  while (true) {
    /* --- Get user query --- */
    const query = await rl.question("You: ");

    if (query === "exit") {
      break;
    }

    /* --- Get relveant chunks from the doc using similarity search --- */
    const relevantChunks = await vectorStore.similaritySearch(query);
    const relevantInformation = relevantChunks
      .map((chunk) => chunk.pageContent)
      .join("\n\n");

    /* --- Build prompts --- */
    const SYSTEM_INSTRUCTION = `
        You are a smart retrieval agent, you will answer any user query based on the relevent information provided with the user query. If you do not know the answer or if the query cannot be answered with the provided information then simply say so do not use any other knowledge base.
    `;

    const USER_QUERY = `
        Query: ${query}

        Relevant Information:
        ${relevantInformation}
    `;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: SYSTEM_INSTRUCTION,
        },
        {
          role: "user",
          content: USER_QUERY,
        },
      ],
    });

    console.log(`Assistant: ${completion.choices[0].message.content}`);
  }

  rl.close();
}
