const express = require('express');
const cors = require('cors');
const dialogflow = require('@google-cloud/dialogflow');

const keyPath = 'service-account.json'; 

const projectId = 'questionbot-lbwk';
// -------------------------------------------

const sessionClient = new dialogflow.SessionsClient({
  keyFilename: keyPath,
  projectId: projectId,
});

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors()); 


app.post('/send-message', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).send('Message and Session ID are required.');
  }

  const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

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
