import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "models/gemini-embedding-001",
});

const pinecone = new PineconeClient({
  apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndex = pinecone.Index("company-chatbot");

export const vectorStore = new PineconeStore(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});

export async function document() {
  const documentPath = "./cg-internal-docs.pdf";

  /* --- Load the doc --- */
  const loader = new PDFLoader(documentPath, {
    splitPages: false, // Load whole doc
  });

  const doc = await loader.load();
  const documentContent = doc[0].pageContent;
  const documentMetadata = doc[0].metadata;

  /* --- Split the content into smaller chunks --- */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const allSplits = await textSplitter.splitText(documentContent);

  /* --- Format the chunks --- */
  const documentChunks = allSplits.map((chunk) => {
    return {
      pageContent: chunk,
      metadata: documentMetadata,
    };
  });

  /* ---- Generate vector embeddings & store in vector DB ----  */
  await vectorStore.addDocuments(documentChunks);
}
