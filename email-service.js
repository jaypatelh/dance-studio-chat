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
            customerSummary: ''
        };

        // Create a prose summary of what the customer was looking for
        let summaryParts = [];
        
        // Get child's age
        if (preferences.age) {
            summaryParts.push(`The customer is looking for dance classes for their ${preferences.age}-year-old child`);
        } else {
            summaryParts.push('The customer is inquiring about dance classes for their child');
        }
        
        // Get style preferences
        if (preferences.style && preferences.style !== 'Not specified') {
            summaryParts.push(`They expressed interest in ${preferences.style} classes`);
        }
        
        // Get day preferences
        if (preferences.dayPreference && preferences.dayPreference !== 'Not specified') {
            summaryParts.push(`and prefer classes on ${preferences.dayPreference}s`);
        }
        
        // Look through conversation for additional context
        const userMessages = history.filter(msg => msg.role === 'user');
        let additionalContext = [];
        
        userMessages.forEach(message => {
            const content = message.content.toLowerCase();
            
            // Look for experience level mentions
            if (content.includes('beginner') || content.includes('never') || content.includes('first time')) {
                additionalContext.push('beginner level');
            }
            if (content.includes('experienced') || content.includes('years') || content.includes('advanced')) {
                additionalContext.push('has some experience');
            }
            
            // Look for specific interests or concerns
            if (content.includes('competitive') || content.includes('competition')) {
                additionalContext.push('interested in competitive dance');
            }
            if (content.includes('fun') || content.includes('recreational')) {
                additionalContext.push('looking for recreational classes');
            }
        });
        
        // Combine the summary
        let fullSummary = summaryParts.join('. ');
        if (additionalContext.length > 0) {
            fullSummary += `. Additional notes: ${additionalContext.join(', ')}.`;
        } else {
            fullSummary += '.';
        }
        
        summary.customerSummary = fullSummary;
        
        return summary;
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
