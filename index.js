const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');

//3rd party email handler
const nodemailer = require('nodemailer');
//security implementation check .env
require('dotenv').config();

const fs = require('fs');

//axios for api request parsing
const axios = require('axios');

//port config
const port = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(cors());

//temp caching solution for instagram data (api request limiter)
//NodeCache (and its calls in instagram endpoints) needs to change when hosted remotely
//may need to use amazon solution with AWS Lambda or look at other cache options 
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // Set TTL (time-to-live) to 600 seconds (10 minutes)


//file upload handler
const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    //change to '/tmp' later for lambda.. will store in cloud tmp folder instead of local
    cb(null, './tmp'); //changed to tmp for AWS Lambda compatibility... must be literally '/tmp' rather than './tmp' when uploaded to AWS
  },
  filename: function (req, file, cb) {
    // cb(null, Date.now() + '-' + file.originalname);
    cb(null, file.originalname); //altered to match fs call on DELETE? try other way next?
  }
});

//field upload handlings
const upload = multer({
  storage: storage,
  onError: function (err, next) {
    console.log('error', err);
    next(err);
  }
});

// Private method for email validation using MailboxValidator API
const validateEmail = async (email) => {
  const apiUrl = `https://api.mailboxvalidator.com/v1/validation/single?email=${encodeURIComponent(email)}&key=${process.env.MAILBOX_VALIDATOR_TOKEN}`;

  try {
    const response = await axios.get(apiUrl);
    const responseData = response.data;

    console.log(responseData);

    //test validation response JSON 
    //Bad config from MailValidator where booleans are actually strings for future reference
    if (responseData.is_verified === 'True' && responseData.is_suppressed === 'False' && responseData.is_high_risk === 'False') {
      // Email is validated
      return { isValidated: true, errorCode: null };
    } else if (responseData.is_verified === '-') {
      console.log('velidation not applicable')
      return { isValidated: false, errorCode: 'validation not applicable' }
    }
    else {
      // Email validation failed with possible error. Here's map:
      //     // 100	Missing parameter.
      //     // 101	API key not found.
      //     // 102	API key disabled.
      //     // 103	API key expired.
      //     // 104	Insufficient credits.
      //     // 105	Unknown error.
      const errorCode = responseData.error_code || 'UnknownError';
      return { isValidated: false, errorCode: errorCode };
    }
  } catch (error) {
    console.error('MailboxValidator API error:', error);
    return { isValidated: false, errorCode: 'ValidationAPIError' };
  }

};

app.get('/api/data', (req, res) => {
  const data = { message: 'Hello from Express!' };
  res.json(data);
});

app.post('/send-email', upload.array('files'), async function (req, res) { //changed from upload.array('files')
  console.log('Received email request:', req.body);
  console.log(req.files);
  const { name, email, message, subject, phone, listOpt } = req.body;
  const files = req.files;

  //use private method to validate entered email
  const validationResponse = await validateEmail(email);
  console.log(validationResponse)

  if (!validationResponse.isValidated) {
    if (validationResponse.errorCode === 'validation not applicable') {
      return res.status(400).json({ success: false, errorCode: 'validation not applicable' })
    }
    // Email validation failed.. return 400 status and error code.. handle in app
    return res.status(400).json({ success: false, errorCode: validationResponse.errorCode });
  } else {
    console.log('email validated')
  }


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

//quick sub to newletter
app.post('/send-email/newsletter-sub', async function (req, res) {
  console.log('Received email request:', req.body);
  const { email } = req.body;

  //use private method to validate entered email
  const validationResponse = await validateEmail(email);
  console.log(validationResponse)

  if (!validationResponse.isValidated) {
    if (validationResponse.errorCode === 'validation not applicable') {
      return res.status(400).json({ success: false, errorCode: 'validation not applicable' })
    }
    // Email validation failed.. return 400 status and error code.. handle in app
    return res.status(400).json({ success: false, errorCode: validationResponse.errorCode });
  } else {
    console.log('email validated')
  }


  //transporter config to send email to user from business
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  //email config send to request newsletter sub to business
  const mailOptions = {
    from: email,
    to: 'thomas.s.brown@gmail.com',
    subject: `Else Werner Glass Site Newsletter Request for ${email}`,
    html: `${email} would like to be added to the newsletter for Else Werner Glass`
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
        subject: 'Thank you for your subscription!',
        html: '<p>Thank you for subscribing to the Else Werner Glass newsletter! Keep a look out for events, sales and more! Unsubscribe any time by visiting: http://localhost:4200/unsubscribe</p><br><p><span style="color: red">Warning: This is an automated response from an unmonitored email. Please do not reply as responses will not be recieved.</span></p>'
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

//unsubscribe email handling
app.post('/send-email/news-unsubscribe', async function (req, res) {
  console.log('Received email request:', req.body);
  const { email } = req.body;

  //use private method to validate entered email
  const validationResponse = await validateEmail(email);
  console.log(validationResponse)

  if (!validationResponse.isValidated) {
    if (validationResponse.errorCode === 'validation not applicable') {
      return res.status(400).json({ success: false, errorCode: 'validation not applicable' })
    }
    // Email validation failed.. return 400 status and error code.. handle in app
    return res.status(400).json({ success: false, errorCode: validationResponse.errorCode });
  } else {
    console.log('email validated')
  }


  //transporter config to send email to user from business
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  //email config send to request newsletter sub to business
  const mailOptions = {
    from: email,
    to: 'thomas.s.brown@gmail.com',
    subject: `Else Werner Glass Site- Unsubscribe ${email}`,
    html: `<span style="color: red">${email} would like to be removed from the newsletter for Else Werner Glass</span>`
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
        subject: 'Unsubscribed from Newsletter',
        html: '<p>You have successfully unsubscribed from the Else Werner Glass Newsletter! Join again any time by visiting: http://localhost:4200/home</p><br><p><span style="color: red">Warning: This is an automated response from an unmonitored email. Please do not reply as responses will not be recieved.</span></p>'
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

//remove file from server once emailed
app.delete('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  //change to /tmp/${filename} when uploaded to AWS lambda.. delete from lambda tmp, not local
  fs.unlink(`./tmp/${filename}`, (err) => {
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

//***INSTAGRAM ENDPOINTS***
//axios request for first 16 instagram posts (change limit in query if you want more)
app.get('/api/instagram', async (req, res) => {
  try {

    const cacheKey = 'instagramData'; // Cache key for the Instagram data

    // Check if the data is already cached
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log('Data from cache:', cachedData); // Log the cached data
      res.json(cachedData);
      return; //end method to prevent api call
    }

    console.log('no values cached... making api request')

    const access_token = process.env.INSTA_TOKEN;
    const apiUrl = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,children{media_type,media_url},timestamp&limit=16&access_token=${access_token}`;

    const response = await axios.get(apiUrl);
    const responseData = response.data;

    // Cache the data for future use
    cache.set(cacheKey, responseData);
    console.log('Data cached:', responseData); // Log the cached data

    res.json(responseData);
    // console.log(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching Instagram media' });
  }
});

app.get('/api/instagram/:after', async (req, res) => {
  try {
    const cacheKey = 'instagramData'; // Cache key for the Instagram data

    // Check if the data is already cached
    const cachedData = cache.get(cacheKey);

    // Get the current 'data' array and 'after' value from the cache
    const data = cachedData?.data || [];
    // const after = cachedData?.paging?.cursors?.after || '';

    const access_token = process.env.INSTA_TOKEN;
    const apiUrl = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,children{media_type,media_url},timestamp&limit=16&after=${req.params.after}&access_token=${access_token}`;

    const response = await axios.get(apiUrl);
    const responseData = response.data;

    // Append the new data to the existing 'data' array
    const newData = [...data, ...responseData.data];

    // Check if responseData.data has less than 16 objects
    //less than 16 implies no more posts
    if (responseData.data.length < 16) {
      newAfter = '';
    } else {
      newAfter = responseData.paging.cursors.after;
    }

    // Update the cache object with the new data and 'after' value
    cache.set(cacheKey, {
      data: newData,
      paging: {
        cursors: {
          after: newAfter
        }
      }
    });

    res.json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching Instagram media' });
  }
});

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
