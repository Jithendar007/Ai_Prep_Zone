from flask import Flask, request, jsonify, session
from flask_cors import CORS
import os
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
import json

# --- Configuration Setup ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

app = Flask(__name__)
CORS(app)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "supersecretkey")  # For session management

# --- Model Initialization ---
try:
    model = genai.GenerativeModel("gemini-2.5-flash")
except Exception as e:
    print(f"Error initializing Gemini Model: {e}")
    model = None

# --- Store conversation context in memory ---
user_sessions = {}  # { session_id: {"question": "...", "history": []} }

# --- New: Interactive Chat Endpoint ---
@app.route("/interactive-chat", methods=["POST"])
def interactive_chat():
    """
    Interactive chat around a pasted question.
    User can send the main question once, then follow-up doubts.
    """
    if not model or not GEMINI_API_KEY:
        return jsonify({"error": "API key missing or model not initialized."}), 500

    data = request.get_json()
    session_id = data.get("session_id")  # Unique ID for the user (frontend generates or random)
    question = data.get("question")
    message = data.get("message")

    if not session_id:
        return jsonify({"error": "Session ID is required."}), 400

    # Create session context if new
    if session_id not in user_sessions:
        user_sessions[session_id] = {"question": question or "", "history": []}

    # Update stored question if provided
    if question:
        user_sessions[session_id]["question"] = question

    # Get conversation context
    context = user_sessions[session_id]
    base_question = context["question"]
    history = context["history"]

    # Combine context: include the base question and conversation history
    prompt = f"""
You are an expert AI tutor. The user is studying the following question:

"{base_question}"

The following is the conversation so far:
{json.dumps(history, indent=2)}

Now the user asks: "{message}"

Please answer in a clear, engaging, and step-by-step manner suitable for an engineering student.
    """

    try:
        response = model.generate_content(
            contents=prompt,
            safety_settings=[
                {"category": HarmCategory.HARM_CATEGORY_HARASSMENT, "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
            ]
        )

        if not response.text:
            return jsonify({"error": "Empty response from Gemini"}), 500

        # Save message and response in history
        history.append({"user": message, "bot": response.text})
        user_sessions[session_id]["history"] = history

        return jsonify({
            "response": response.text,
            "history": history
        })

    except Exception as e:
        return jsonify({"error": f"Gemini API error: {str(e)}"}), 500

# --- Optional Endpoint: Reset a session ---
@app.route("/reset-session", methods=["POST"])
def reset_session():
    data = request.get_json()
    session_id = data.get("session_id")
    if session_id and session_id in user_sessions:
        del user_sessions[session_id]
        return jsonify({"message": "Session reset successful."})
    return jsonify({"error": "Session not found."}), 404


# --- Run the app ---
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
