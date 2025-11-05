import json
import os
from google.oauth2 import service_account
from google.cloud import dialogflow_v2 as dialogflow

# ✅ Create the JSON file if running on Render
if "GOOGLE_APPLICATION_CREDENTIALS_JSON" in os.environ:
    cred_data = json.loads(os.environ["GOOGLE_APPLICATION_CREDENTIALS_JSON"])
    with open("service-account.json", "w") as f:
        json.dump(cred_data, f)

    # ✅ Tell Google libraries to use this file
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"
    print("✅ Service account loaded.")
else:
    print("❌ GOOGLE_APPLICATION_CREDENTIALS_JSON not found!")

# ✅ Now safely initialize sessions client
project_id = "questionbot-lbwk"
credentials = service_account.Credentials.from_service_account_file("service-account.json")
session_client = dialogflow.SessionsClient(credentials=credentials)

# --- Initialize Flask app ---
app = Flask(__name__)
# This line is crucial for allowing your HTML front-end to make requests to this server.
CORS(app)

# --- Load CSV and normalize column names ---
try:
    df = pd.read_csv("QUESTIONPAPER.csv", encoding="latin1")
    df.columns = df.columns.str.lower()
    df["year"] = df["year"].astype(str)
except FileNotFoundError:
    print("Error: QUESTIONPAPER.csv not found.", flush=True)
    df = pd.DataFrame()
except LookupError:
    print("Error: unknown encoding 'latin1' not supported. Trying another encoding...", flush=True)
    try:
        df = pd.read_csv("QUESTIONPAPER.csv", encoding="ISO-8859-1")
        df.columns = df.columns.str.lower()
        df["year"] = df["year"].astype(str)
    except Exception as e:
        print(f"Error loading CSV file: {e}", flush=True)
        df = pd.DataFrame()

# --- Helper function to format questions ---
def format_questions(questions, limit=None):
    if questions.empty:
        return None  # Return None so the webhook can handle the fallback
    if limit:
        questions = questions.head(limit)
    
    formatted_list = []
    for row in questions.itertuples(index=False):
        formatted_list.append(
            f"<b>[{row.year}] {row.sub} ({row.examtype})</b><br>Q: {row.question}"
        )
    
    return "\n\n".join(formatted_list)

# --- Function to call Dialogflow API to detect intent (returns Dialogflow's result structure) ---
# This is necessary for the /chat endpoint to get the parameters
def detect_intent_and_get_params(text, session_id="12345", language_code="en"):
    session = session_client.session_path(project_id, session_id)
    text_input = dialogflow.types.TextInput(text=text, language_code=language_code)
    query_input = dialogflow.types.QueryInput(text=text_input)
    response = session_client.detect_intent(session=session, query_input=query_input)
    
    # Return the entire query_result object
    return response.query_result

# --- Unified logic for querying the CSV data (moved from webhook) ---
def get_csv_questions(params):
    year = str(params.get("Year", "")).strip()
    limit = int(params.get("number", 2)) if params.get("number") else 2
    exam_type = str(params.get("Exam_Type", "")).strip()
    subject = str(params.get("Subject", "")).strip()
    topic = str(params.get("Topic", "")).strip()
    any_param = str(params.get("any", "")).strip()
    q_type = str(params.get("Type", "")).strip()
    difficulty=str(params.get("Difficulty","")).strip()
    print("Unique Subjects:", df["sub"].unique())
    print("Unique Exam Types:", df["examtype"].unique())
    print("Unique Difficulty:", df["difficulty"].unique())
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

    search_query = topic or any_param
    if search_query:
        # Using regular expressions to handle "OR" logic in search query
        regex_query = '|'.join(re.escape(s) for s in re.split(r'\s+or\s+', search_query, flags=re.IGNORECASE))
        filtered = filtered[filtered["question"].str.contains(regex_query, case=False, na=False)]
    
    return format_questions(filtered, limit)

# --- New Route for your custom HTML front-end ---
@app.route("/chat", methods=["POST"])
def chat():
    req = request.get_json()
    user_message = req.get("message")
    session_id = req.get("sessionId")
    
    if not user_message:
        return jsonify({"fulfillmentText": "No message provided."}), 400

    print(f"User Message from HTML: {user_message}", flush=True)

    # 1. Use Dialogflow to get the intent and parameters
    query_result = detect_intent_and_get_params(user_message, session_id)
    intent = query_result.intent.display_name
    params = dict(query_result.parameters)
    
    response_text = "Sorry, I didn't understand that."
    
    # 2. If it's the target intent, use the extracted parameters to query the CSV
    if intent.lower() == "get_questions_by_intent":
        csv_response = get_csv_questions(params)
        
        if csv_response:
            response_text = csv_response
        else:
            # Fallback to Dialogflow's default response if no questions found
            response_text = query_result.fulfillment_text
    else:
        # Use Dialogflow's fulfillment for non-CSV intents (like greetings)
        response_text = query_result.fulfillment_text
    
    return jsonify({"fulfillmentText": response_text})


# --- Webhook route to receive messages from Dialogflow ---
@app.route("/webhook", methods=["POST"])
def webhook():
    # This route is now a placeholder. For a *proper* Dialogflow integration, 
    # you would keep the logic here as it was. However, since the custom 
    # frontend is bypassing it, the logic is consolidated into the /chat route.
    # For a fully separate webhook, you would use:
    # req = request.get_json()
    # params = req.get("queryResult", {}).get("parameters", {})
    # intent = req.get("queryResult", {}).get("intent", {}).get("displayName", "")
    # ... and then call get_csv_questions(params) if intent matches.
    
    # Since the custom frontend handles the main logic, this webhook can return 
    # a simple success message for Dialogflow's testing purposes.
    return jsonify({"fulfillmentText": "Webhook successfully received and processed the request (if intent matched)."}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)