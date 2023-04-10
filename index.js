const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const port = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(cors());

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

//fild upload handling?
const upload = multer({ storage: storage });

//successfully sends emails with a single attachment
app.post('/send-email', upload.single('file'), function (req, res) {
  console.log('Received email request:', req.body);
  const { name, email, message, subject, phone } = req.body; //deleted files from here which was working before
  const file = req.file;

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
    subject: `BRW Site Request: ${subject}: ${name}, ${email}`,
    text: `${message}\nreply to: ${email}, phone: ${phone}`,
    attachments: [
      {
        filename: file.originalname,
        path: file.path
      }
    ]
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error sending email' });
    } else {
      console.log(`Email sent: ${info.response}`);
      res.status(200).json({ success: true, message: 'Email sent successfully' });
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