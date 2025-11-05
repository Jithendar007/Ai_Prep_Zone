const express = require('express');
const cors = require('cors');
const dialogflow = require('@google-cloud/dialogflow');

// --- IMPORTANT: CONFIGURE THESE VARIABLES ---
// Replace 'YOUR_KEY_FILE_NAME.json' with the actual name of your JSON key file.
const keyPath = 'service-account.json'; 

// Replace 'YOUR_DIALOGFLOW_PROJECT_ID' with your actual Dialogflow Project ID.
const projectId = 'questionbot-lbwk'; 
// -------------------------------------------

// Create a new session client with credentials from your JSON key file.
const sessionClient = new dialogflow.SessionsClient({
  keyFilename: keyPath,
  projectId: projectId,
});

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors()); // Enables your front-end to make requests to this server.

// Define the route for your chatbot
app.post('/send-message', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).send('Message and Session ID are required.');
  }

  // A session represents a conversation between an agent and a user.
  // The session path uniquely identifies a session.
  const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

  // The Dialogflow API request payload
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
        languageCode: 'en-US',
      },
    },
  };

  try {
    // Call the Dialogflow API to get a response
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    // Send the Dialogflow response back to the front-end
    res.json({
      fulfillmentText: result.fulfillmentText,
    });
  } catch (error) {
    console.error('ERROR:', error);
    res.status(500).send('Error communicating with Dialogflow.');
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
