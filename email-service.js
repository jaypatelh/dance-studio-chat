// Email service for sending booking confirmations
class EmailService {
    constructor() {
        // Using Gmail SMTP service only
        console.log('EmailService initialized - using Gmail SMTP only');
    }

    // Generate conversation summary using LLM
    async generateConversationSummary() {
        const history = conversationState.conversationHistory || [];
        const preferences = conversationState.userPreferences || {};
        
        if (history.length === 0) {
            return {
                customerSummary: 'Customer inquired about dance classes through the chat assistant.'
            };
        }

        try {
            // Format conversation for LLM
            const conversationText = history.map(msg => 
                `${msg.role === 'user' ? 'Customer' : 'Assistant'}: ${msg.content}`
            ).join('\n');

            const summaryPrompt = `Please summarize this conversation between a customer and a dance studio chat assistant in 2-3 sentences. Focus on what the customer is looking for, their preferences, and any specific needs mentioned.

Conversation:
${conversationText}

User Preferences Captured:
${JSON.stringify(preferences, null, 2)}

Provide a concise summary that would be helpful for a dance studio staff member who will be calling this customer:`;

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
                    messages: [
                        {
                            role: 'user',
                            content: summaryPrompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                throw new Error(`LLM API error: ${response.status}`);
            }

            const data = await response.json();
            const summary = data.choices[0]?.message?.content?.trim() || 'Customer inquired about dance classes through the chat assistant.';

            return {
                customerSummary: summary
            };

        } catch (error) {
            console.error('Error generating conversation summary:', error);
            // Fallback to simple summary
            return {
                customerSummary: 'Customer inquired about dance classes through the chat assistant.'
            };
        }
    }

    // Format email content
    formatEmailContent(bookingData, conversationSummary) {
        const emailContent = `
Consultation Call Scheduled

CALL DETAILS:
=============
Name: ${bookingData.name}
Phone: ${bookingData.phone}
Call them at: ${bookingData.date} at ${bookingData.time}

CUSTOMER SUMMARY:
=================
${conversationSummary.customerSummary || 'Customer inquired about dance classes through the chat assistant.'}

This consultation was scheduled through the dance studio chat assistant.
        `.trim();

        return emailContent;
    }

    // Send email notification using Gmail SMTP only
    async sendBookingNotification(bookingData) {
        try {
            const conversationSummary = await this.generateConversationSummary();
            
            console.log('=== EMAIL SERVICE DEBUG ===');
            console.log('Sending booking notification via Gmail SMTP...');
            console.log('Booking data:', bookingData);
            console.log('Conversation summary:', conversationSummary);
            
            // Use Gmail SMTP service directly
            const gmailService = new GmailSMTPService();
            const result = await gmailService.sendEmail(bookingData, conversationSummary);
            
            if (result.success) {
                console.log('Booking notification sent via Gmail SMTP:', result);
                return { success: true, message: 'Booking notification sent successfully via Gmail' };
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error sending booking notification via Gmail SMTP:', error);
            return { 
                success: false, 
                message: 'Failed to send booking notification. Please contact support.',
                error: error.message
            };
        }
    }

}

// Create global instance
try {
    window.emailService = new EmailService();
    console.log('Email service initialized successfully');
} catch (error) {
    console.error('Failed to initialize email service:', error);
}
