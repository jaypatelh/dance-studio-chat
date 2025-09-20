# Database Setup for Conversation Logging

This document explains how to set up the Supabase database for logging chatbot conversations.

## Supabase Setup

1. **Create a Supabase Account**
   - Go to [supabase.com](https://supabase.com)
   - Sign up for a free account
   - Create a new project

2. **Create the Conversations Table**
   
   Run this SQL in the Supabase SQL Editor:

   ```sql
   -- Create conversations table
   CREATE TABLE conversations (
     id BIGSERIAL PRIMARY KEY,
     conversation_id TEXT UNIQUE NOT NULL,
     messages JSONB NOT NULL DEFAULT '[]',
     user_preferences JSONB DEFAULT '{}',
     timestamp TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Create index for faster queries
   CREATE INDEX idx_conversations_conversation_id ON conversations(conversation_id);
   CREATE INDEX idx_conversations_timestamp ON conversations(timestamp DESC);
   CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

   -- Enable Row Level Security (optional but recommended)
   ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

   -- Create a policy to allow all operations (adjust as needed for your security requirements)
   CREATE POLICY "Allow all operations on conversations" ON conversations
   FOR ALL USING (true);
   ```

3. **Get Your Supabase Credentials**
   - Go to Settings > API in your Supabase dashboard
   - Copy the Project URL (SUPABASE_URL)
   - Copy the anon/public key (SUPABASE_ANON_KEY)

## Netlify Environment Variables

Add these environment variables in your Netlify dashboard (Site settings > Environment variables):

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Schema

### conversations table

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key, auto-incrementing |
| conversation_id | TEXT | Unique identifier for each conversation session |
| messages | JSONB | Array of message objects with role and content |
| user_preferences | JSONB | User preferences like age, style, day preference |
| timestamp | TIMESTAMPTZ | When the conversation was first created |
| updated_at | TIMESTAMPTZ | When the conversation was last updated |

### Message Format

Each message in the `messages` array has this structure:

```json
{
  "role": "user" | "assistant",
  "content": "message text"
}
```

### User Preferences Format

```json
{
  "age": 8,
  "style": "ballet",
  "dayPreference": "weekends"
}
```

## API Endpoints

The system provides two Netlify functions:

### Save Conversation
- **Endpoint**: `/.netlify/functions/save-conversation`
- **Method**: POST
- **Body**:
  ```json
  {
    "conversationId": "conv_1234567890_abc123",
    "messages": [...],
    "userPreferences": {...},
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```

### Get Conversations
- **Endpoint**: `/.netlify/functions/get-conversations`
- **Method**: GET
- **Query Parameters**:
  - `conversationId` (optional): Get specific conversation
  - `limit` (optional): Number of conversations to return (default: 50)
  - `offset` (optional): Pagination offset (default: 0)

## Local Development

For local development with `netlify dev`:

1. Create a `.env` file in the root directory:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

## Security Considerations

- The current setup uses the Supabase anon key, which is safe for client-side use
- Row Level Security (RLS) is enabled but with a permissive policy
- Consider implementing more restrictive RLS policies based on your security requirements
- All API keys are handled securely through environment variables
- No sensitive data is logged in conversations

## Monitoring

You can monitor conversation logs through:
- Supabase dashboard > Table Editor > conversations
- Custom queries in the SQL Editor
- The get-conversations API endpoint

## Troubleshooting

Common issues:
1. **401 Unauthorized**: Check that SUPABASE_URL and SUPABASE_ANON_KEY are set correctly
2. **Table doesn't exist**: Make sure you've run the SQL schema creation script
3. **CORS errors**: The functions handle CORS automatically, but check browser console for details
