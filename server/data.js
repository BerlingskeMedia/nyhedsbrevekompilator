/*jshint node: true */
'use strict';

const Http = require('http');
const Joi = require('joi');

module.exports.name = 'data';
module.exports.register = function (plugin, options) {

  plugin.route({
    method: 'GET',
    path: '/',
    config: {
      validate: {
        query: Joi.object({
          u: Joi.string().uri().required()
        }),
      }
    },
    handler: function (request) {
      return get(request.query.u);
    }
  });
};

module.exports.name = 'data';

function get (url) {
  return new Promise((r, j) => {
    download(url, function (err, data) {
      if (err) return j(err);
      if (data === null) return r(null);

      if (data.type !== undefined && ['nodequeue', 'latest_news', 'news_article'].indexOf(data.type) > -1) {
        orderBondImages(data);
        data.subject = subjectSuggestion(data);
        r(data);
      // } else if (data.type === 'nodequeue' && data.nodes.length === 0 ) {
        // callback(null, null);

        // Example of a response from a nodequeue that doesn't exist
        //   { type: 'nodequeue',
        //     id: '4222222626',
        //     loadType: 'fullNode',
        //     title: null,
        //     nodes: [] }
      } else {
        r(data);
      }
    });
  })
}
module.exports.get = get;


function download (url, callback) {
  Http.get(url, function( response ) {

    if (response.statusCode === 401) {
      return callback (null, null);
    } else if (response.statusCode === 302) {
      return download (response.headers.location, callback);
    } else if (response.statusCode !== 200) {
      return callback (response.statusCode, null);
    }

    var data = '';
    response.setEncoding('utf8');

    response.on('data', function ( chunk ) {
      data += chunk;
    });

    response.on('end', function() {
      callback(null, JSON.parse(data), response.headers);
    });
  }).on('error', function(e) {
    console.log('Got error while requesting HTML (' + url + '): ' + e.message);
    callback(e, null);
  });
}


function orderBondImages (data) {
  if (data === null) return;

  if (data.type === 'nodequeue' || data.type === 'latest_news') {
    for (var i = data.nodes.length - 1; i >= 0; i--) {
      orderBondImages(data.nodes[i]);
    };
  } else if (data.images !== undefined && data.images !== null && Object.prototype.toString.call( data.images ) === '[object Object]') {
    var images = [];
    Object.keys(data.images).forEach(function (key) {
      images.push(data.images[key]);
    });
    delete data.images;
    data.images = images.sort(sortImages);
  }
}


function sortImages(bondImageA, bondImageB) {
  if (bondImageA.position < bondImageB.position) {
    return -1;
  } else if (bondImageA.position > bondImageB.position) {
    return 1;
  } else {
    return 0;
  }
}


function subjectSuggestion (data) {
  if (data === null) return '';
  var maxLength = 255;

  if (data.type === 'nodequeue' || data.type === 'latest_news') {
    var temp = [];
    for (var i = 0; i < 3; i++) {
      if (data.nodes[i] && data.nodes[i].title) {
        temp.push(data.nodes[i].title);
      }
    }
    return temp.join(' | ').substring(0, maxLength);
  } else {
    return data.title.substring(0, maxLength);
  }
}
