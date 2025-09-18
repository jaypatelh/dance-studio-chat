// Email service for sending booking confirmations
class EmailService {
    constructor() {
        // Using Gmail SMTP service only
        console.log('EmailService initialized - using Gmail SMTP only');
    }

    // Extract conversation summary from chat history
    extractConversationSummary() {
        const history = conversationState.conversationHistory || [];
        
        let summary = {
            fullConversation: ''
        };

        // Format the entire conversation
        if (history.length > 0) {
            summary.fullConversation = history.map(message => {
                const role = message.role === 'user' ? 'Customer' : 'Assistant';
                return `${role}: ${message.content}`;
            }).join('\n\n');
        } else {
            summary.fullConversation = 'No conversation history available';
        }

        return summary;
    }

    // Format email content
    formatEmailContent(bookingData, conversationSummary) {
        const emailContent = `
New Dance Studio Consultation Call

CALL DETAILS:
=============
Name: ${bookingData.name}
Phone: ${bookingData.phone}
Scheduled: ${bookingData.date} at ${bookingData.time}

FULL CONVERSATION:
==================
${conversationSummary.fullConversation || 'No conversation history available'}

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
