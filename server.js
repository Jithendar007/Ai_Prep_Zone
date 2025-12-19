import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv"; 
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();

const app = express();
const PORT = 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/generate-questions", async (req, res) => {
  try {
    const { topic, count, difficulty } = req.body;
   
  
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Generate ${count} multiple-choice questions on the topic "${topic}" with a difficulty level of "${difficulty}".
      Return a valid JSON object with the following structure:
{
  "questions": [
    {
      "question": "string",
      "options": ["option1", "option2", "option3", "option4"],
      "answer": "string",
      "explanation": "A short explanation (1–3 sentences) describing why this is the correct answer and clarifying the concept."
    }
  ]
}

Do not include any text, notes, or markdown outside the JSON.
`;


    console.log("Sending prompt to Gemini API...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace('```json', '').replace('```', '').trim();

    const jsonResponse = JSON.parse(cleanedText);

if (jsonResponse.questions && Array.isArray(jsonResponse.questions)) {
  jsonResponse.questions = jsonResponse.questions.map(q => ({
    ...q,
    explanation: q.explanation || `This question helps you understand the topic "${topic}". The correct answer is "${q.answer}".`
  }));
}


    res.json(jsonResponse);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "Failed to generate questions. Check the server console." });
  }
});

app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});
