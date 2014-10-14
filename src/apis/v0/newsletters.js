/*jshint node: true */

'use strict';

var AWS = require('aws-sdk'),
    ses = new AWS.SES(),
    http = require('http'),
    https = require('https'),
    eventEmitter = require('events').EventEmitter,
    workerEmitter = new eventEmitter(),
    database = require('../../mdb_client.js');

module.exports = [
  {
    method: 'get',
    path: '/newsletters',
    handler: selectAllNewsletters
  },{
    method: 'get',
    path: '/newsletters/{id}',
    handler: selectNewsletter
  // },{
  //   method: ['post','put'],
  //   path: '/newsletters/{id}',
  //   handler: newsletters.saveNewsletter
  },{
    method: 'get',
    path: '/newsletters/{id}/subscribers',
    handler: selectNewsletterSubscribers
  },{
    method: 'options',
    path: '/newsletters/{id}/subscribers',
    handler: selectNewsletterSubscribersCount
  },{
    method: 'get',
    path: '/newsletters/{id}/subscribers/count',
    handler: selectNewsletterSubscribersCount
  },{
    method: ['put','post'],
    path: '/newsletters/{id}/send',
    handler: sendNewsletter
  },{
    method: 'get',
    path: '/newsletters/identities',
    handler: listSendGridIdentities
  },{
    method: 'get',
    path: '/newsletters/templates',
    handler: listNewsletterTemplates
  }
];

function selectAllNewsletters (request, reply) {
  var sql = [
    'SELECT tbl_nyhedsbrev.*, tbl_publisher.publisher_navn',
    'FROM tbl_nyhedsbrev',
    'LEFT JOIN tbl_publisher ON tbl_publisher.publisher_id = tbl_nyhedsbrev.publisher_id'].join(' ');

  database.query(sql, function (err, result) {
    if (err) return reply(err);
    reply(result.rows);
  });
};

function selectNewsletter (request, reply) {
  var sql = [
    'SELECT *',
    'FROM tbl_nyhedsbrev',
    'LEFT JOIN tbl_publisher ON tbl_publisher.publisher_id = tbl_nyhedsbrev.publisher_id',
    'WHERE nyhedsbrev_id = ' + request.params.id].join(' ');

  database.queryOne(sql, function (err, result) {
    if (err) return reply(err).code(509);
    else if (result === null)
      reply().code(404);
    else
      reply(result);
  });
};


// function saveNewsletter (request, reply) {
//   var subscription = request.payload;
//   var sql = ['UPDATE subscription SET',
//     ['publisher_id = ' + subscription.publisher_id,
//     'name=' + database.escape(subscription.name),
//     'active=' + subscription.active,
//     'display_text=' + database.escape(subscription.display_text),
//     'description=' + database.escape(subscription.description),
//     'html_url=' + database.escape(subscription.html_url)].join(','),
//     'WHERE id=' + subscription.id].join(' ');

//   database.query(sql, function (err, result) {
//     console.log(err, result);
//     if (err)
//       reply(err);
//     else if (result.affectedRows === 0)
//       reply().code(404);
//     else 
//       reply();
//   });
// };


function selectNewsletterSubscribers (request, reply) {
  var sql = ['SELECT member_id',
    'FROM subscription_member',
    'WHERE active = 1 AND subscription_id = ' + request.params.id].join(' ');
  
  database.query(sql, function (err, result) {
    if (err) return reply(err);
    else {
        // Mapping the result down to
        //  [107043, 104760, 1657432, 385718]
        // instead of 
        //  [ { "member_id": 107043 }, { "member_id": 104760 }]

      reply(result.map(function (member) {
        return member.member_id;
      })).
      header('X-Member-Count', result.length);
    }
  });
};

function selectNewsletterSubscribersCount (request, reply) {
  var sql = ['SELECT count(id) as count',
    'FROM subscription_member',
    'WHERE active = 1 AND subscription_id = ' + request.params.id].join(' ');
  
  database.queryOne(sql, function (err, result) {
    if (err) return reply(err);
    else reply(result).header('X-Member-Count', result.count);
  });
};


function sendNewsletter (request, reply) {
  var newsletterId = request.params.id;

  var sql = ['SELECT subscription.*, publisher.from_email, publisher.from_name FROM subscription',
    'LEFT JOIN publisher ON subscription.publisher_id = publisher.id',
    'WHERE subscription.id = ' + newsletterId ].join(' ');

  database.queryOne(sql, function (err, data) {
    if (err) return reply(err);

    // TODO: test that from_email, subject is present
    // if (data[0].html_url === null)
    //   return reply().code(400);

    if (data.html_url.indexOf('http://') !== 0 || data.html_url.indexOf('https://') !== 0) {
      if (data.html_url.charAt(0) === '/') {
        data.html_url = request.server.info.uri + data.html_url;
      } else {
        data.html_url = request.server.info.uri + '/' + data.html_url;
      }
    }

    selectNewsletterRecipientEmails(newsletterId, function (err, recipients_email_addresses) {
      //data.recipients = recipients_email_addresses;
      data.recipients = ['dako@berlingskemedia.dk'];

      downloadEmailHtml(data.html_url, function (err, html) {
        if (err) reply(err);
        if (html === null) reply().code(509);
        else {
          data.message = html;

          sendPreview(data, function (err, result) {
            console.log('AWS send', err, result);
            if (err) reply(err);
            else reply(result);
          });
        }
      });
    });
  });
};


function sendTestEmail (request, reply) {
  var data = request.payload;

  if (data.from_email === undefined ||
      data.from_name === undefined ||
      data.subject === undefined ||
      data.html_url === undefined ||
      data.recipients === undefined) {

    reply().code(400);

  } else {

    var sendTail = request.tail('Send email');

    downloadEmailHtml(data.html_url, function (err, message) {
      data.display_text = 'FAKE';
      data.message = message;
      sendPreview(data, function (err, data) {
        console.log('AWS send', err, data);
        sendTail();
      });
    });
    
    reply().code(200);
  }
};


function selectNewsletterRecipientEmails (newsletterId, callback) {
  var sql = ['SELECT email.email_address',
    'FROM subscription_member',
    'LEFT JOIN email ON email.id = subscription_member.email_id',
    'WHERE subscription_id = ' + newsletterId ].join(' ');

  database.query(sql, function (err, subscription_members) {
    if (err) return callback(err);

    var recipients_email_addresses = subscription_members.map(function (subscription_member) {
      return subscription_member.email_address;
    });
    callback(null, recipients_email_addresses);
  });
}


function downloadEmailHtml (url, callback) {
  console.log('Requesting on', url);

  http.get(url, function( response ) {

    console.log('HTTP ' + response.statusCode + ' response from', url);

    if (response.statusCode === 401) {
      return callback (null, null);
    } else if (response.statusCode !== 200) {
      return callback (response.statusCode, null);
    }

    var data = '';
    response.setEncoding('utf8');

    response.on('data', function ( chunk ) {
      data += chunk;
    });

    response.on('end', function() {
      callback(null, data);
    });
  }).on('error', function(e) {
    console.log('Got error while requesting HTML: ' + e.message);
    callback(e, null);
  });
}


function sendPreview (data, callback) {

  // We're only accepting @berlingskemedia.dk emails
  data.recipients = data.recipients.filter(function (email) {
    return email.indexOf("@berlingskemedia.dk") === email.lastIndexOf("@");
  });

  var params = {
    Destination: { /* required */
      // BccAddresses: [
      //   'STRING_VALUE',
      //   /* more items */
      // ],
      // CcAddresses: [
      //   'STRING_VALUE',
      //   /* more items */
      // ],
      ToAddresses: data.recipients
    },
    Message: { /* required */
      Body: { /* required */
        Html: {
          Data: data.message, /* required */
          Charset: 'UTF-8'
        },
        Text: {
          Data: 'To be filled out.', /* required */
          Charset: 'UTF-8'
        }
      },
      Subject: { /* required */
        Data: data.display_text, /* required */
        Charset: 'UTF-8'
      }
    },
    Source: 'dako@berlingskemedia.dk', /* required */
    ReplyToAddresses: [
      'dako@berlingskemedia.dk',
      /* more items */
    ],
    ReturnPath: 'dako@berlingskemedia.dk'
  };

  console.log('SES sendEmail params:', params);

  ses.sendEmail(params, callback);
}


function listNewsletterTemplates (request, reply) {
  reply(['/1', '/template']);
}


function listSendGridIdentities (request, reply) {
  callSendGrid('/api/newsletter/identity/list.json', null, function (err, data) {
    if (err) return reply(err).code(500);
    else reply(data);
  });
}


function callSendGrid (path, body, callback) {
  var data = '';

  if (callback === undefined && typeof body === 'function') {
    callback = body;
    body = '';
  }

  if (body === null)
    body = '';
  else if (body !== '')
    body = body + '&';

  body = body + 'api_user=' + encodeURIComponent(process.env.SENDGRID_API_USER) + '&api_key=' + encodeURIComponent(process.env.SENDGRID_API_KEY);

  console.log('body', body);

  var options = {
    hostname: 'api.sendgrid.com',
    port: 443,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  var req = https.request(options, function(res) {

    res.on('data', function(d) {
      data = data + d;
    });

    res.on('end', function() {
      data = JSON.parse(data);
      if (data.error || res.statusCode > 300)
        callback(data, null);
      else
        callback(null, data);
    });
  });

  req.write(body);
  req.end();

  req.on('error', function(e) {
    callback(e);
  });
}
