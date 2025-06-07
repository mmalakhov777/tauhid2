# Environment Variables Setup

To run this application properly, you need to set up the following environment variables:

## Required Environment Variables

Create a `.env.local` file in the root of the tauhid2 directory with the following variables:

```bash
# Groq API Key (for primary AI models)
GROQ_API_KEY=your_groq_api_key_here

# OpenRouter API Key (fallback for title generation)
OPENROUTER_API_KEY=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

# Other required environment variables
# Add your database URL, auth secrets, etc. here
```

## Getting API Keys

### Groq API Key
1. Go to https://console.groq.com/keys
2. Sign up or log in to your account
3. Click "Create API Key"
4. Copy the generated key and add it to your `.env.local` file

### OpenRouter API Key
- The provided OpenRouter key is included for fallback functionality
- You can get your own key at https://openrouter.ai/keys if needed

## Important Notes

- The `.env.local` file is gitignored and should never be committed
- Keep your API keys secure and don't share them publicly
- The OpenRouter integration provides fallback support when Groq API fails
- This ensures guest users can still use the chat functionality 