const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const fs = require('fs');

const request = require('request');


const port = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(cors());

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    // cb(null, Date.now() + '-' + file.originalname);
    cb(null, file.originalname); //altered to match fs call on DELETE? try other way next?
  }
});

//fild upload handling?
const upload = multer({
  storage: storage,
  onError: function (err, next) {
    console.log('error', err);
    next(err);
  }
});

app.post('/send-email', upload.array('files'), function (req, res) { //changed from upload.array('files')
  console.log('Received email request:', req.body);
  console.log(req.files);
  const { name, email, message, subject, phone, listOpt } = req.body;
  const files = req.files;

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
    html: `<p>${message}<br>reply to: ${email}, phone: ${phone}<br>Mail List?: <span style="color: ${listOpt === 'true' ? 'green' : 'red'}">${listOpt}</span></p>`,
    attachments: files.map((file) => {
      return {
        filename: file.originalname,
        path: file.path
      };
    })
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

//remove file from server once emailed
app.delete('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  fs.unlink(`./uploads/${filename}`, (err) => {
    if (err) {
      console.error(err);
      console.log(filename);//delete?
      res.sendStatus(500);
    } else {
      console.log(`${filename} deleted successfully`);//delete?
      res.sendStatus(200);
    }
  });
});


//GET request to instagram app for media display
app.get('/api/instagram', (req, res) => {
  // Make a request to the Instagram API to fetch the media objects for the user with the access token
  const access_token = process.env.INSTA_TOKEN;
  const options = {
    url: `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url&access_token=${access_token}`,
    json: true
  };

  request.get(options, (error, response, body) => {
    if (error) {
      // Handle errors
      console.error(error);
      res.status(500).json({ message: 'Error fetching Instagram media' });
    } else {
      // Process the response from the Instagram API and send back the relevant data to the client
      res.json(body);
    }
  });
});

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});