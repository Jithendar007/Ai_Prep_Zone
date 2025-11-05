from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
import re
import json
from google.oauth2 import service_account
from google.cloud import dialogflow_v2 as dialogflow

# ✅ Create the JSON file if running on Render
if "GOOGLE_APPLICATION_CREDENTIALS_JSON" in os.environ:
    cred_data = json.loads(os.environ["GOOGLE_APPLICATION_CREDENTIALS_JSON"])
    with open("service-account.json", "w") as f:
        json.dump(cred_data, f)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"
    print("✅ Service account loaded.")
else:
    print("❌ GOOGLE_APPLICATION_CREDENTIALS_JSON not found!")

# ✅ Now safely initialize sessions client
project_id = "questionbot-lbwk"
credentials = service_account.Credentials.from_service_account_file("service-account.json")
session_client = dialogflow.SessionsClient(credentials=credentials)

# ✅ Initialize Flask app
app = Flask(__name__)
CORS(app)



# =====================================================
# ✅ Load CSV File
# =====================================================
try:
    df = pd.read_csv("QUESTIONPAPER.csv", encoding="latin1")
    df.columns = df.columns.str.lower()
    df["year"] = df["year"].astype(str)
except:
    df = pd.DataFrame()
    print("❌ CSV Load Failed")


# =====================================================
# ✅ Helper to Format Questions
# =====================================================
def format_questions(questions, limit=None):
    if questions.empty:
        return None
    if limit:
        questions = questions.head(limit)

    formatted_list = []
    for row in questions.itertuples(index=False):
        formatted_list.append(
            f"<b>[{row.year}] {row.sub} ({row.examtype})</b><br>Q: {row.question}"
        )
    return "\n\n".join(formatted_list)


# =====================================================
# ✅ Detect Intent + Extract Parameters from Dialogflow
# =====================================================
def detect_intent_and_get_params(text, session_id="12345", language_code="en"):
    session = session_client.session_path(project_id, session_id)
    text_input = dialogflow.TextInput(text=text, language_code=language_code)
    query_input = dialogflow.QueryInput(text=text_input)
    response = session_client.detect_intent(
        request={"session": session, "query_input": query_input}
    )
    return response.query_result


# =====================================================
# ✅ Filter Questions According to Parameters
# =====================================================
def get_csv_questions(params):
    year = str(params.get("Year", "")).strip()
    limit = int(params.get("number", 2)) if params.get("number") else 2
    exam_type = str(params.get("Exam_Type", "")).strip()
    subject = str(params.get("Subject", "")).strip()
    topic = str(params.get("Topic", "")).strip()
    any_param = str(params.get("any", "")).strip()
    q_type = str(params.get("Type", "")).strip()
    difficulty = str(params.get("Difficulty", "")).strip()
    repeatation= str(params.get("Repeated","")).strip()

    filtered = df.copy()

    if year:
        filtered = filtered[filtered["year"] == year]
    if exam_type:
        filtered = filtered[filtered["examtype"].str.contains(exam_type, case=False, na=False)]
    if subject:
        filtered = filtered[filtered["sub"].str.contains(subject, case=False, na=False)]
    if q_type:
        filtered = filtered[filtered["type"].str.contains(q_type, case=False, na=False)]
    if difficulty:
        filtered = filtered[filtered["difficulty"].str.lower() == difficulty.lower()]
    if repeatation:
        filtered = filtered[filtered[]]

    search_query = topic or any_param
    if search_query:
        regex_query = '|'.join(re.escape(s) for s in re.split(r'\s+or\s+', search_query, flags=re.IGNORECASE))
        filtered = filtered[filtered["question"].str.contains(regex_query, case=False, na=False)]

    return format_questions(filtered, limit)


# =====================================================
# ✅ Frontend /chat Endpoint
# =====================================================
@app.route("/chat", methods=["POST"])
def chat():
    req = request.get_json()
    user_message = req.get("message")
    session_id = req.get("sessionId")

    if not user_message:
        return jsonify({"fulfillmentText": "No message provided."})

    query_result = detect_intent_and_get_params(user_message, session_id)
    intent = query_result.intent.display_name
    params = dict(query_result.parameters)

    if intent.lower() == "get_questions_by_intent":
        csv_response = get_csv_questions(params)
        return jsonify({"fulfillmentText": csv_response or query_result.fulfillment_text})

    return jsonify({"fulfillmentText": query_result.fulfillment_text})


# =====================================================
# ✅ Dummy Webhook Endpoint (optional for Dialogflow)
# =====================================================
@app.route("/webhook", methods=["POST"])
def webhook():
    return jsonify({"fulfillmentText": "Webhook connected ✅"}), 200


# =====================================================
# ✅ Run Server
# =====================================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
