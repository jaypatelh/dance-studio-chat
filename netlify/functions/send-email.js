const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { bookingData, conversationSummary } = JSON.parse(event.body);
    
    console.log('Environment check:', {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_PASS,
      emailUser: process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 3) + '***' : 'undefined'
    });
    
    // Create Gmail transporter using environment variables
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Format email content
    const emailContent = formatEmailContent(bookingData, conversationSummary);
    
    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'jaypatelh@gmail.com',
      subject: `Consultation Call - ${bookingData.name} (${bookingData.date} at ${bookingData.time})`,
      text: emailContent,
      html: emailContent.replace(/\n/g, '<br>')
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', info.messageId);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        messageId: info.messageId
      })
    };

  } catch (error) {
    console.error('Error sending email:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};

function formatEmailContent(bookingData, conversationSummary) {
  return `
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
}
