// Local email service using SMTP
class LocalEmailService {
    constructor() {
        // Read from .env file or use environment variables
        this.emailUser = process.env.EMAIL_USER || '';
        this.emailPass = process.env.EMAIL_PASS || '';
        this.smtpEndpoint = 'https://api.smtp2go.com/v3/email/send'; // Free SMTP service
    }

    async sendEmail(bookingData, conversationSummary) {
        const emailContent = this.formatEmailContent(bookingData, conversationSummary);
        
        try {
            // Use a simple HTTP-based email service for local testing
            const response = await fetch('https://formsubmit.co/jaypatelh@gmail.com', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subject: `New Dance Class Booking - ${bookingData.name} (${bookingData.date} at ${bookingData.time})`,
                    message: emailContent,
                    _replyto: bookingData.email,
                    _next: 'https://thankyou.com',
                    _captcha: 'false'
                })
            });

            if (response.ok) {
                return { success: true, message: 'Email sent successfully' };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Local email service error:', error);
            return { success: false, message: error.message };
        }
    }

    formatEmailContent(bookingData, conversationSummary) {
        return `
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
    }
}

// Export for use
window.LocalEmailService = LocalEmailService;
