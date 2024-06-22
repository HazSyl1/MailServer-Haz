const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const Message = require('./models/Message');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLEAI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
const app = express();
app.use(bodyParser.json());

app.use(cors(
    {
        origin: ["*"],
        methods:["POST","GET"],
        credentials:true
    }
));
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

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

// Default route
app.get('/', (req, res) => {
    res.send('Server is running. You can use /contact to send a message.');
});

app.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find();
        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.put('/messages/:id/star', async (req, res) => {
    const { id } = req.params;
    const { starred } = req.body;

    try {
        const message = await Message.findByIdAndUpdate(id, { starred }, { new: true });
        if (!message) {
            return res.status(404).send('Message not found');
        }
        res.status(200).json(message);
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).send('Internal Server Error');
    }
});

const isMessageRelevant = async (message) => {
    try {
        const prompt = `Check if the following message is relevant to professional inquiries/ portfolio (project) site/ general talks related to any project or product :\n\nMessage: "${message}"\n\nRelevance (Yes or No):`;
        const result = await model.generateContent(prompt);
        const response = result.response;
        const output = response.text().trim();
        return output.toLowerCase() === 'yes';
    } catch (error) {
        console.error('Error checking relevancy with GoogleAI:', error);
        return false;
    }
};


// Contact route for form submissions
app.post('/contact', async (req, res) => {
    const { name, email, message } = req.body;
    const relevant = await isMessageRelevant(message);
    const newMessage = new Message({ name, email, message, relevant });

    try {
        await newMessage.save();
    } catch (error) {
        console.error('Error saving message to database:', error);
        return res.status(500).send('Internal Server Error');
    }

    if (!relevant) {
        console.log('Message is not relevant');
        return res.status(400).send('Message is not relevant');
    }
    else{
        console.log('Message is relevant');
    }
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
