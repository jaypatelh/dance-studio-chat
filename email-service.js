// Email service for sending booking confirmations
class EmailService {
    constructor() {
        this.emailEndpoint = '/.netlify/functions/send-booking-email';
        // For local testing, we'll use a simple email API service
        this.localEmailEndpoint = 'https://api.emailjs.com/api/v1.0/email/send';
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

    // Send email notification
    async sendBookingNotification(bookingData) {
        try {
            const conversationSummary = this.extractConversationSummary();
            
            console.log('=== EMAIL SERVICE DEBUG ===');
            console.log('Sending booking notification email...');
            console.log('Booking data:', bookingData);
            console.log('Conversation summary:', conversationSummary);
            console.log('Current hostname:', window.location.hostname);
            
            // For local testing, use direct SMTP sending
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('Local environment detected, sending via SMTP');
                const result = await this.sendViaDirectSMTP(bookingData, conversationSummary);
                console.log('SMTP result:', result);
                return result;
            }
            
            // Send via Netlify function for production
            const response = await fetch(this.emailEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bookingData: bookingData,
                    conversationSummary: conversationSummary
                })
            });

            if (response.ok) {
                console.log('Booking notification email sent successfully');
                return { success: true, message: 'Email sent successfully' };
            } else {
                console.error('Failed to send email:', response.status, response.statusText);
                // Fallback to mailto
                this.sendViaMailto(bookingData);
                return { success: false, message: 'Netlify function failed, using mailto fallback' };
            }
        } catch (error) {
            console.error('Error sending booking notification:', error);
            
            // Fallback: Try to send via mailto (will open user's email client)
            this.sendViaMailto(bookingData);
            
            return { success: false, message: 'Email service unavailable, using fallback method' };
        }
    }

    // Fallback method using mailto
    sendViaMailto(bookingData) {
        try {
            const conversationSummary = this.extractConversationSummary();
            const emailContent = this.formatEmailContent(bookingData, conversationSummary);
            
            const subject = encodeURIComponent(`New Dance Class Booking - ${bookingData.name} (${bookingData.date} at ${bookingData.time})`);
            const body = encodeURIComponent(emailContent);
            
            const mailtoLink = `mailto:jaypatelh@gmail.com?subject=${subject}&body=${body}`;
            
            // This will open the user's default email client
            window.open(mailtoLink, '_blank');
            
            console.log('Opened email client for manual sending');
        } catch (error) {
            console.error('Error with mailto fallback:', error);
        }
    }

    // Direct Gmail SMTP sending for local testing
    async sendViaDirectSMTP(bookingData, conversationSummary) {
        try {
            console.log('=== SMTP DEBUG ===');
            const emailContent = this.formatEmailContent(bookingData, conversationSummary);
            console.log('Email content prepared, length:', emailContent.length);
            
            const requestData = {
                to: 'jaypatelh@gmail.com',
                subject: `New Dance Class Booking - ${bookingData.name} (${bookingData.date} at ${bookingData.time})`,
                html: emailContent.replace(/\n/g, '<br>'),
                text: emailContent,
                bookingData: bookingData,
                conversationSummary: conversationSummary
            };
            
            console.log('Making request to SMTP server...');
            console.log('Request URL: http://localhost:3001/send-gmail');
            console.log('Request data:', requestData);
            
            // Send to local SMTP server that uses your Gmail credentials
            const response = await fetch('http://localhost:3001/send-gmail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Email sent successfully via Gmail SMTP:', result);
                return { success: true, message: 'Email sent via Gmail SMTP' };
            } else {
                const errorText = await response.text();
                console.error('❌ Gmail SMTP server error:', response.status, response.statusText, errorText);
                // Fallback to mailto
                this.sendViaMailto(bookingData);
                return { success: false, message: 'Gmail SMTP server unavailable, opened email client as fallback' };
            }
        } catch (error) {
            console.error('❌ Gmail SMTP connection error:', error);
            // Fallback to mailto
            this.sendViaMailto(bookingData);
            return { success: false, message: 'Could not connect to Gmail SMTP server, opened email client as fallback' };
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
