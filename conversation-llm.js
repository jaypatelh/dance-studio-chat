// Conversation Management LLM Functions

// Studio context - embedded directly to avoid loading issues
const STUDIO_CONTEXT = `
Dance Season:
- 2025-2026: Sept 8 to June 15 (10-month)
- Registration fee: $65 at sign-up
- Location: 540 N Santa Cruz Ave, Los Gatos, CA 95030, USA
- Phone number: (408) 204-6849
- Email: admin@tdcoflosgatos.com

Monthly Tuition (Sept–June):
- Drop-in: $35
- 1 class/week: $100
- 2 classes/week: $195
- 3 classes/week: $285
- 4 classes/week: $365
- 5 classes/week: $445
- 6–8 classes/week: $515
- 9+ classes: add $25 per class
- Family (6–8 classes each): 2 dancers → $700; 3 dancers → $975
- Competition Solo/Duo/Trio: $50

Billing & Payments:
- Monthly fixed rate, regardless of number of classes per month
- Auto–credit-card only; no cash/check
- Due 1st; delinquent if not paid by 6 pm on 5th
- $15 late charge if payment declined and not updated before 5th
- Billing inquiries: admin@tdcoflosgatos.com

Refunds & Class Changes:
- No refunds after first class
- Class changes via email; transfer if space; new class start next week
- Full withdrawal: email two weeks before month; otherwise tuition continues
- Re-registration fee: $25 if re-enroll in same dance season
- Class cancellation (<4 dancers): full refund if no alternative available

Attendance & Studio Rules:
- Regular attendance required
- Dress code: hair in bun for ballet; ponytail for others
- Arrive 10 min early; >15 min late may affect participation
- No food/drinks/gum in studio/lobby (water OK)
- No make-ups; canceled class by teacher → a make-up scheduled at later date; if substitute offered and declined → no refund

Showcase (mid-June):
- All enrolled dancers participate
- Costume charges in early March
- No costume refunds after March deadline

Behavior & Social Media:
- Courtesy and respect expected from dancers and parents
- No mocking, teasing, harassment, gossip, sharing secrets via text or social media
- Inappropriate language or embarrassing photos/photos about dancers/family/studio prohibited

Recital & Observation:
- Recital is optional but common; costumes ordered in February; classes locked
- Closed-door policy: parents may observe first week each month via lobby windows only

Dress Code by Class:
- Combo/Tiny Tots: any leotard + skirt (above knee), ballet & tap shoes
- Pre Ballet: ballet shoes only, no tap shoes
- Jazz: any leotard/dance attire, no baggy clothing, jazz shoes required
- Lyrical: any leotard/dance attire, no baggy clothing, jazz or lyrical shoes
- Ballet: black leotard (no skirt), pink tights, pink ballet shoes, bun hair – no exceptions
- Tumbling: any leotard/dance attire, no baggy clothes, no shoes or full-footed tights
- Hip Hop: comfortable clothing, no tight jeans, skirts, flip-flops, elevated shoes; sneakers preferred
- Tap: comfortable attire, no dragging pants, visible feet, tap shoes required
- Flex/Turns/Jumps: any leotard/dance attire, no baggy clothing
`;

// Get conversation response from LLM
async function getConversationResponse(userMessage, conversationState) {
    const studioContext = STUDIO_CONTEXT;
    
    
    const systemPrompt = `You are a friendly concierge for a dance studio. Be warm, conversational, and helpful.

STUDIO CONTEXT:
${studioContext}

Your role:
- Only answer questions using the provided studio context above
- Help families find the perfect dance class for their child
- Start by asking about the child's age, preferred dance style, and what days work best for them
- Be open to the conversation going in different directions based on their questions
- Be concise
- Always end your responses with a question to keep the conversation flowing

When you have the child's age, use the "get_classes" action to find real classes. Never invent class details.

RESPONSE FORMAT:
Return JSON with:
{
  "message": "Your response to the user (use studio context for non-class questions)",
  "action": "get_classes|refine_classes|continue",
  "preferences": {
    "age": number or null,
    "style": "string or null", 
    "dayPreference": "string or null"
  }
}

ACTIONS:
- "get_classes": ONLY when you have the child's age (required) - triggers the class search system
- "refine_classes": When user wants to modify existing class suggestions
- "continue": For regular conversation flow when answering general questions or don't have age yet

Current user preferences: ${JSON.stringify(conversationState.userPreferences)}
Current classes shown: ${conversationState.currentClasses.length} classes
`;


    const conversationHistory = conversationState.conversationHistory.slice(-10); // Keep last 10 messages
    
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
    ];

    // Retry logic for API calls
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
        try {
            // Debug logging
            console.log('=== API DEBUG ===');
            console.log('window.appConfig:', window.appConfig);
            console.log('openRouterApiKey:', window.appConfig?.openRouterApiKey);
            console.log('API key length:', window.appConfig?.openRouterApiKey?.length);
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.appConfig.openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Dance Studio Chat'
                },
                body: JSON.stringify({
                    model: 'x-ai/grok-4-fast:free',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2048,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const responseContent = data.choices[0].message.content;
            
            
            // Try to parse JSON, fallback if it's plain text
            try {
                return JSON.parse(responseContent);
            } catch (parseError) {
                return {
                    message: responseContent,
                    action: "continue",
                    preferences: conversationState.userPreferences || {}
                };
            }
            
        } catch (error) {
            retryCount++;
            
            if (retryCount <= maxRetries) {
                // Wait before retrying (exponential backoff)
                const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    // All retries failed
    return {
        message: "I'm experiencing some technical difficulties right now. Please try again in a moment, or feel free to schedule a callback for immediate assistance.",
        action: "schedule_call",
        preferences: conversationState.userPreferences
    };
}

// Refine class suggestions based on user feedback
async function refineClassSuggestions(newPreferences, currentClasses) {
    // Merge new preferences with existing ones
    const mergedPreferences = {
        ...conversationState.userPreferences,
        ...newPreferences
    };
    
    // Get new class recommendations with refined preferences
    return await getClassRecommendations(mergedPreferences);
}
