const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');

//3rd party email handler
const nodemailer = require('nodemailer');
//auto update server
require('dotenv').config();

const fs = require('fs');

const request = require('request');

//port config
const port = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(cors());

//file upload handler
const multer = require('multer');

//config email validation api
const MailboxValidator = require("mailboxvalidator-node");
//link to token
const mailboxValidator = MailboxValidator(process.env.MAILBOX_VALIDATOR_TOKEN);

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

  //transporter config to send email to user from business
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  //email config for business to user message
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
  //send email to user
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error sending email' });
    } else {
      console.log(`Email sent: ${info.response}`);

      //if successful send a confirmation email
      //configure new transporter for noreply email
      const confirmationTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'dev.testb5a@gmail.com',
          //MUST populate via gmail. hasn't been enabled yet so will be broken
          pass: process.env.CONFIRM_EMAIL_PASS
        }
      });
      //build noreply thank you email
      const confirmationMailOptions = {
        //replace with noreplay@domain.com when registered
        from: 'Else Werner Glass <dev.testb5a@gmail.com>',
        //replace when registered
        replyTo: 'dev.testb5a@gmail.com',
        //replace when registered
        sender: 'Else Rose Werner Glass <dev.testb5a@gmail.com>',
        to: email,
        subject: 'Thank you for contacting us',
        html: '<p>Thank you for contacting Else Werner Glass! We have received your message and will get back to you as soon as possible.</p><br><p><span style="color: red">Warning: This is an automated response from an unmonitored email. Please do not reply as responses will not be recieved.</span></p>'
      };
      //send noreply
      confirmationTransporter.sendMail(confirmationMailOptions, (error, info) => {
        if (error) {
          console.error(error);
        } else {
          console.log(`Confirmation email sent: ${info.response}`);
        }
      });
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
      console.log(`${filename} deleted successfully`);//delete
      res.sendStatus(200);
    }
  });
});


//GET request to instagram app for media display
app.get('/api/instagram', (req, res) => {
  // Make a request to the Instagram API to fetch the media objects for the user with the access token
  const access_token = process.env.INSTA_TOKEN;
  //this is the full url for the next 16.. the next batch has its own next property (data.paging.next)
  //there's also a data.paging.previous if you wanted to go back
  const options = {
    //this url now contains '&limit=16' meaning load only the first 16 resources
    //**add '&after=${after}' to get next 16 after limit.. data.paging.cursors.after**
    //'@after
    url: `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,children{media_type,media_url},timestamp&limit=16&access_token=${access_token}`,
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
      // console.log(body);
    }
  });
});

//get next 16 via after variable
app.get('/api/instagram/:after', (req, res) => {
  const access_token = process.env.INSTA_TOKEN; //this is referenced elswhere
  const options = {
    url: `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,children{media_type,media_url},timestamp&limit=16&after=${req.params.after}&access_token=${access_token}`,
    json: true
  }

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
})

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
