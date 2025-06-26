export HTTPS_PROXY="socks5://127.0.0.1:1188"
export HTTP_PROXY="socks5://127.0.0.1:1188"
export GEMINI_API_KEY=AIzaSyDim8J8xzRTmPl1ve98-gQq8UueGZhH9s8

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=$GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Explain how AI works in a few words"
          }
        ]
      }
    ],
    "generationConfig": {
      "thinkingConfig": {
        "thinkingBudget": 0
      }
    }
  }'