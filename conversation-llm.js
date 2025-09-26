// Conversation Management LLM Functions

// Format classes for system prompt
function formatClassesForPrompt(classes) {
    if (!classes || classes.length === 0) {
        return 'No classes currently available.';
    }
    
    // Group classes by day
    const classesByDay = {};
    classes.forEach(cls => {
        if (!cls.name || !cls.name.trim()) return;
        
        const day = cls.day || 'TBD';
        if (!classesByDay[day]) {
            classesByDay[day] = [];
        }
        classesByDay[day].push(cls);
    });
    
    let formatted = 'AVAILABLE CLASSES:\n';
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    dayOrder.forEach(day => {
        if (classesByDay[day] && classesByDay[day].length > 0) {
            formatted += `\n${day}:\n`;
            classesByDay[day].forEach(cls => {
                formatted += `- ${cls.name} (Ages ${cls.ageRange || 'All ages'}) at ${cls.time || 'TBD'}`;
                if (cls.date && cls.date.trim()) {
                    formatted += ` on ${cls.date}`;
                }
                if (cls.instructor && cls.instructor !== 'TBD') {
                    formatted += ` with ${cls.instructor}`;
                }
                if (cls.description && cls.description !== 'No description available') {
                    formatted += ` - ${cls.description}`;
                }
                if (cls.level) {
                    formatted += ` [${cls.level}]`;
                }
                formatted += '\n';
            });
        }
    });
    
    // Add any classes without a specific day
    Object.keys(classesByDay).forEach(day => {
        if (!dayOrder.includes(day) && classesByDay[day].length > 0) {
            formatted += `\n${day}:\n`;
            classesByDay[day].forEach(cls => {
                formatted += `- ${cls.name} (Ages ${cls.ageRange || 'All ages'}) at ${cls.time || 'TBD'}`;
                if (cls.date && cls.date.trim()) {
                    formatted += ` on ${cls.date}`;
                }
                if (cls.instructor && cls.instructor !== 'TBD') {
                    formatted += ` with ${cls.instructor}`;
                }
                if (cls.description && cls.description !== 'No description available') {
                    formatted += ` - ${cls.description}`;
                }
                if (cls.level) {
                    formatted += ` [${cls.level}]`;
                }
                formatted += '\n';
            });
        }
    });
    
    return formatted;
}

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
async function getConversationResponse(userMessage, conversationState, allClasses = []) {
    const studioContext = STUDIO_CONTEXT;
    const classesContext = formatClassesForPrompt(allClasses);
    
    const systemPrompt = `You are a friendly concierge for a dance studio. Be warm, conversational, and helpful.

STUDIO CONTEXT:
${studioContext}

${classesContext}

Your role:
- Answer questions using the provided studio context and class information above
- Help families find the perfect dance class for their child
- When recommending classes, use the EXACT class information provided above
- Start by asking about the child's age, preferred dance style, and what days work best for them
- Be open to the conversation going in different directions based on their questions
- Be concise and conversational
- Always end your responses with ONE clear question to keep the conversation flowing - don't ask multiple questions in a single response
- When suggesting classes, mention specific class names, times, ages, and instructors from the list above
- IMPORTANT: After providing class recommendations, frequently offer to schedule a callback so they can speak with someone to get personalized guidance, ask detailed questions, or complete registration
- Only use the schedule_call action when the user explicitly says YES to scheduling a callback

FORMATTING GUIDELINES:
- When listing classes, put each class on its own line with clear formatting like:
  "Here are some great ballet classes for your 6-year-old:
  
  • **Ballet Basics** - Tuesdays at 4:00 PM (Ages 5-7) with Ms. Sarah
  • **Pre-Ballet Fun** - Wednesdays at 3:30 PM (Ages 4-6) with Ms. Emma
  
  Would you like to schedule a callback to discuss registration?"
  
- Put your follow-up question on a new line at the end for visibility
- When using schedule_call action, don't ask for contact details in your message - the booking form will handle that

RESPONSE FORMAT:
Return JSON with:
{
  "message": "Your response to the user (include specific class recommendations when appropriate)",
  "action": "continue|schedule_call",
  "preferences": {
    "age": number or null,
    "style": "string or null", 
    "dayPreference": "string or null"
  },
  "recommendedClasses": ["class names that match their preferences"]
}

ACTIONS:
- "continue": For regular conversation flow, offering callbacks, and answering questions
- "schedule_call": ONLY use this when the user explicitly agrees to schedule a callback (says "yes", "sure", "okay", "I'd like that", etc.)

CALLBACK STRATEGY:
- Frequently offer callbacks in your messages, especially after providing class recommendations
- Use phrases like "Would you like to schedule a callback to discuss registration?" or "Should I set up a quick call for you?"
- But keep action as "continue" until they say YES
- When they agree, then use "schedule_call" action

Current user preferences: ${JSON.stringify(conversationState.userPreferences)}
`;


    // Log the complete system prompt for debugging
    console.log('=== COMPLETE SYSTEM PROMPT ===');
    console.log(systemPrompt);
    console.log('=== END SYSTEM PROMPT ===');

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

// Extract recommended classes from LLM response
function extractRecommendedClasses(llmResponse, allClasses) {
    if (!llmResponse.recommendedClasses || !Array.isArray(llmResponse.recommendedClasses)) {
        return [];
    }
    
    // Find matching classes by name (case insensitive)
    const recommendedClasses = [];
    llmResponse.recommendedClasses.forEach(className => {
        const matchingClass = allClasses.find(cls => 
            cls.name && cls.name.toLowerCase().includes(className.toLowerCase())
        );
        if (matchingClass) {
            recommendedClasses.push(matchingClass);
        }
    });
    
    return recommendedClasses;
}
