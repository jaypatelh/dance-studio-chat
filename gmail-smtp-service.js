// Gmail SMTP service for local testing
class GmailSMTPService {
    constructor() {
        // These will be read from your .env file
        this.emailUser = null;
        this.emailPass = null;
        this.loadCredentials();
    }

    async loadCredentials() {
        // Try to read from environment variables or .env file
        // Since we're in browser, we'll need to pass these from the server
        // For now, we'll use a simple approach
        try {
            const response = await fetch('/get-email-config');
            if (response.ok) {
                const config = await response.json();
                this.emailUser = config.EMAIL_USER;
                this.emailPass = config.EMAIL_PASS;
            }
        } catch (error) {
            console.log('Could not load email config from server, will use manual input');
        }
    }

    async sendEmail(bookingData, conversationSummary) {
        // Since browsers can't directly use SMTP (security restriction),
        // we need to use a server endpoint that uses your Gmail credentials
        const emailContent = this.formatEmailContent(bookingData, conversationSummary);
        
        try {
            // Send to our local server endpoint that will use Gmail SMTP
            const response = await fetch('http://localhost:3001/send-gmail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: 'jaypatelh@gmail.com',
                    subject: `New Dance Class Booking - ${bookingData.name} (${bookingData.date} at ${bookingData.time})`,
                    html: emailContent.replace(/\n/g, '<br>'),
                    text: emailContent,
                    bookingData: bookingData,
                    conversationSummary: conversationSummary
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Email sent via Gmail SMTP:', result);
                return { success: true, message: 'Email sent via Gmail SMTP' };
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Gmail SMTP error:', error);
            return { success: false, message: `Gmail SMTP failed: ${error.message}` };
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

window.GmailSMTPService = GmailSMTPService;
