import Groq from "groq-sdk";

/**
 * Groq client instance
 * @constant
 */
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  /**
   *  System level instruction that tells model how to behave and format output
   */
  const systemInstruction = `
  You are an AI assistant that extracts structured data from user messages.

  Rules:
  - You MUST return output in valid JSON only.
  - Do NOT include explanations, markdown, or extra text.
  - Do NOT add or remove fields.
  - If a value is unknown, use null.
  - Follow the output schema strictly.

  `;

  /**
   * User provided input to be analyzed and classified
   */
  const userInput = `Your app keeps crashing every time I try to upload a file. I can’t use it at all.
 `;

  /**
   * JSON schema defining exact structure of the model response
   */
  const outputSchema = {
    type: "json_schema",
    json_schema: {
      name: "result",
      strict: true,
      schema: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            enum: [
              "cancel_subscription",
              "refund_request",
              "technical_issue",
              "billing_issue",
              "account_update",
              "general_query",
            ],
          },
          urgency: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          sentiment: {
            type: "string",
            enum: ["positive", "neutral", "negative"],
          },
          requires_human_agent: {
            type: "boolean",
          },
          confidence_score: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
        },
        // Required fields in response
        required: [
          "intent",
          "urgency",
          "sentiment",
          "requires_human_agent",
          "confidence_score",
        ],
        additionalProperties: false, // No extra fields allowed
      },
    },
  };

  /**
   * Submit a chat completion request with parameters
   */
  const chatCompletion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-maverick-17b-128e-instruct",
    temperature: 0.2,
    response_format: outputSchema,
    messages: [
      {
        role: "system",
        content: systemInstruction,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
  });

  /**
   * Parse and output the validated response
   */
  console.log(JSON.parse(chatCompletion?.choices[0].message.content));
}

// Entry point
main();
