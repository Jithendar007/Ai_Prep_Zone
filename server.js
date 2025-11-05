import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv"; // To load environment variables
// CORRECT LINE - This is the fix
import { GoogleGenerativeAI } from "@google/generative-ai";
// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 3000;

// --- Initialize the Google Gemini API client ---
// This uses the API key from your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to parse JSON bodies and serve static files
app.use(express.json());
app.use(express.static(__dirname));

// Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- API Endpoint for Generating Questions ---
app.post("/generate-questions", async (req, res) => {
  try {
    const { topic, count, difficulty } = req.body;

    // We select the generative model
   
     const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // --- This is the prompt engineering part ---
    // We give the AI very specific instructions to get a clean JSON output.
    const prompt = `
      Generate ${count} multiple-choice questions on the topic of "${topic}" with a difficulty level of "${difficulty}".
      Provide the response as a valid JSON object.
      The JSON object must have a single key called "questions".
      The value of "questions" must be an array of objects.
      Each object in the array must have the following three keys:
      1. "question": A string containing the question text.
      2. "options": An array of 4 strings representing the possible choices.
      3. "answer": A string containing the correct answer, which must be one of the strings from the "options" array.

      Do not include any other text, explanations, or markdown formatting outside of the main JSON object.
    `;

    console.log("Sending prompt to Gemini API...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // The AI might return the JSON inside a markdown block, so we clean it up.
    const cleanedText = text.replace('```json', '').replace('```', '').trim();

    // Parse the cleaned text as JSON
    const jsonResponse = JSON.parse(cleanedText);

    // Send the structured questions back to the frontend
    res.json(jsonResponse);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "Failed to generate questions. Check the server console." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});