const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Create Gmail transporter using your credentials
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Endpoint to send emails via Gmail SMTP
app.post('/send-gmail', async (req, res) => {
    try {
        const { to, subject, html, text, bookingData, conversationSummary } = req.body;
        
        console.log('Sending email via Gmail SMTP...');
        console.log('From:', process.env.EMAIL_USER);
        console.log('To:', to);
        console.log('Subject:', subject);
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject,
            text: text,
            html: html
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        
        res.json({ 
            success: true, 
            messageId: result.messageId,
            message: 'Email sent via Gmail SMTP' 
        });
    } catch (error) {
        console.error('Gmail SMTP error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Endpoint to get email configuration (without exposing credentials)
app.get('/get-email-config', (req, res) => {
    res.json({
        EMAIL_USER: process.env.EMAIL_USER ? 'configured' : 'not configured',
        EMAIL_PASS: process.env.EMAIL_PASS ? 'configured' : 'not configured'
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Local SMTP server running on port ${PORT}`);
    console.log('Email User:', process.env.EMAIL_USER ? 'configured' : 'NOT CONFIGURED');
    console.log('Email Pass:', process.env.EMAIL_PASS ? 'configured' : 'NOT CONFIGURED');
});

module.exports = app;
