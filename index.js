const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

app.post('/send-email', (req, res) => {
  console.log('Received email request:', req.body);
  const { name, email, message, subject } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: email,
    to: 'thomas.s.brown@gmail.com',
    subject: `${subject}: ${name}, ${email}`,
    // text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
    text: message
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).send('Error sending email');
    } else {
      console.log(`Email sent: ${info.response}`);
      res.status(200).send('Email sent successfully');
    }
  });
});

app.get('/api/data', (req, res) => {
  const data = { message: 'Hello from Express!' };
  res.json(data);
});

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});