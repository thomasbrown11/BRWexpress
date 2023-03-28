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
// const upload = multer(); //this only lets you accept one file?

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage }).fields([{ name: 'files', maxCount: 10 }]);

app.post('/send-email', upload, (req, res) => {
  console.log('Received email request:', req.body);
  const { name, email, message, subject, phone } = req.body; //deleted files from here which was working before

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
    //can you push files from angular to this? Works with local files
    attachments: [
      {
        filename: 'hello1.png',
        path: '/Users/thomasbrown/projects/Brier/BrierServer/hello1.png'
      },
      {
        filename: 'test.csv',
        path: '/Users/thomasbrown/projects/Brier/BrierServer/test.csv'
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

