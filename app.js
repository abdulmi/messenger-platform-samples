/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
'use strict';

const
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  request = require('request'),
  Food = require('./helpers/food/foodPlaces.js'),
  ExamSchedule = require('./helpers/courses/exams/examSchedule.js'),
  NextSection = require('./helpers/courses/sections/nextSection.js');

var app = express();

app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

// App Secret from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// page access token from App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * using my own validation token. Check that the token used in the Webhook
 * setup is the same token used here. This gets verified only once, when the webhook is 
 * being setup in the dashboard
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. 
 *
 */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else {
          receivedMessage(messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // must send back a 200, within 20 seconds to let messenger know that we
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Delivery Confirmation Event
 * This event is sent to confirm the delivery of a message
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 *
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}


/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 *
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageText = message.text;
  if (messageText) {
    sendTextMessage(senderID, messageText);
  }
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  analyzeMessage(messageText,function(res) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: res,
        metadata: "DEVELOPER_DEFINED_METADATA"
      }
    };
    console.log("here is res" + res);
    console.log(messageData);
    callSendAPI(messageData);
  });
}

/*
* analyzing message based on differnet categories(exams, open hours, lectures...)
*/
function analyzeMessage(message,callback) {
  var messageStr = String(message);
  var upperText = messageStr.toUpperCase();
  if(upperText.indexOf("EXAM") != -1) {
    ExamSchedule.formatExam(message,function(res) {
      callback(res);
    });
  }
  else if(upperText.indexOf("NEXT") != -1) {
    NextSection.formatSection(message,function(res) {
      callback(res);
    });
  }
  else if(upperText.indexOf("HOURS") != -1) {
    var foodObject = Food.findEatingPlace(message);
    if(foodObject != null) {
      var foodLocation = Food.findFoodBuilding(message,foodObject);
      Food.formatRestaurant(foodObject["name"],foodLocation,true,function(formattedAnswer) {
        callback(formattedAnswer);
      });
    } else {
      callback("food place invalid")
    }
  } else if(upperText.indexOf("OPEN") != -1) {
    var foodObject = Food.findEatingPlace(message);
    if(foodObject != null) {
      var foodLocation = Food.findFoodBuilding(message,foodObject);
      Food.formatRestaurant(foodObject["name"],foodLocation,false,function(formattedAnswer) {
        callback(formattedAnswer);
      });
    } else {
      callback("food place invalid")
    }
  } else if(messageStr.toUpperCase() === "HELP") {

      var response =  "Keywords for Asking:\n" +
                      "Food Place Hours: hours, [NAME]\n" +
                      "Food Place Open?: open, [NAME]\n" +
                      "Exam Times: exam, [COURSECODE(no spaces)]\n" +
                      "Class Times: next, [COURSECODE](no spaces)\n" +
                      "send us feedback @aalmetwa@uwaterloo.ca\n"
      callback(response)
  }
  else {
      console.log("invalid command");
      callback("sorry, invalid command");
  }
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s",
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s",
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid
// certificate authority.

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


module.exports = app;