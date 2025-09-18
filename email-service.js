// Email service for sending booking confirmations
class EmailService {
    constructor() {
        // Using Gmail SMTP service only
        console.log('EmailService initialized - using Gmail SMTP only');
    }

    // Extract conversation summary from chat history
    extractConversationSummary() {
        const history = conversationState.conversationHistory || [];
        const preferences = conversationState.userPreferences || {};
        
        let summary = {
            age: preferences.age || 'Not specified',
            style: preferences.style || 'Not specified',
            dayPreference: preferences.dayPreference || 'Not specified',
            conversationHighlights: []
        };

        // Extract key information from conversation
        history.forEach(message => {
            if (message.role === 'user') {
                const content = message.content.toLowerCase();
                
                // Look for age mentions
                const ageMatch = content.match(/(\d+)\s*(years?\s*old|yr|age)/);
                if (ageMatch && !summary.age) {
                    summary.age = ageMatch[1];
                }
                
                // Look for style preferences
                const styles = ['ballet', 'hip hop', 'jazz', 'contemporary', 'tap', 'lyrical', 'musical theater'];
                styles.forEach(style => {
                    if (content.includes(style) && !summary.style.includes(style)) {
                        summary.style = style;
                    }
                });
                
                // Look for day preferences
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                days.forEach(day => {
                    if (content.includes(day) && !summary.dayPreference.includes(day)) {
                        summary.dayPreference = day;
                    }
                });
                
                // Store important user messages
                if (message.content.length > 10) {
                    summary.conversationHighlights.push(message.content);
                }
            }
        });

        return summary;
    }

    // Format email content
    formatEmailContent(bookingData, conversationSummary) {
        const emailContent = `
New Dance Class Booking Confirmation

BOOKING DETAILS:
================
Date: ${bookingData.date}
Time: ${bookingData.time}
Booking Timestamp: ${bookingData.timestamp}

CUSTOMER INFORMATION:
====================
Name: ${bookingData.name}
Email: ${bookingData.email}
Phone: ${bookingData.phone}

CONVERSATION SUMMARY:
====================
Child's Age: ${conversationSummary.age}
Preferred Dance Style: ${conversationSummary.style}
Day Preference: ${conversationSummary.dayPreference}

CONVERSATION HIGHLIGHTS:
=======================
${conversationSummary.conversationHighlights.slice(-5).map((msg, index) => `${index + 1}. ${msg}`).join('\n')}

NEXT STEPS:
===========
- Call the customer at ${bookingData.phone} at the scheduled time
- Discuss dance class options based on their preferences
- Follow up with class enrollment information

This booking was made through the dance studio chat assistant.
        `.trim();

        return emailContent;
    }

    // Send email notification using Gmail SMTP only
    async sendBookingNotification(bookingData) {
        try {
            const conversationSummary = this.extractConversationSummary();
            
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
