npm install -g firebase-tools
firebase login
firebase init functions
firebase deploy --only functions


make sure you add a .env file to the functions folder with the following variables:

OPENAI_API_KEY=openai_api_key
ANTHROPIC_API_KEY (if you want to use claude)