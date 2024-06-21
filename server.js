// server.js
const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.APP_PASS
    }
});

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`${req.method} request for '${req.url}' - ${JSON.stringify(req.body)}`);
    next();
});

// Root route for testing
app.get('/', (req, res) => {
    res.send('Server is running. You can use /api/contact to send a message.');
});

// Contact route for form submissions
app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;

    const mailOptions = {
        from: {
            name: name, 
            address: process.env.EMAIL_USER
        },
        to: process.env.RECEIVER_EMAIL,
        subject: `Message from ${name} ref. Portfolio Contact Form`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${name} messaged you via portfolio</h2>
            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 5px;">
                <p style="font-size: 16px;"><b>Email:</b> ${email}</p>
                <p style="font-size: 16px;"><b>Message:</b></p>
                <p style="font-size: 16px; line-height: 1.6;">${message}</p>
            </div>
        </div>
    `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).send(error.toString());
        }
        console.log('Email sent:', info.response);
        res.status(200).send('Message sent: ' + info.response);
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
