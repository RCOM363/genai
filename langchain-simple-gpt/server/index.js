import express from "express";
import cors from "cors";

import { generate } from "./assistant.js";

const app = express();
const port = process.env.PORT;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);
app.use(express.json());

app.post("/chat", async (req, res) => {
  const { userMessage, threadId } = req.body;

  const response = await generate(userMessage,threadId );

  return res.status(200).json({ result: response });
});

app.listen(port, () => {
  console.log(`server is running on http://localhost:${port}`);
});
