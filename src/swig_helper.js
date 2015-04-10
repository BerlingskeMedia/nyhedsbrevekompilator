/*jshint node: true */
'use strict';

var swig = require('swig'),
    extras = require('swig-extras'),
    moment = require('moment');

moment.locale('da');

extras.useFilter(swig, 'split');
extras.useFilter(swig, 'trim');
extras.useFilter(swig, 'truncate');

swig.setDefaults({ cache: false }); /* must be turned of when in production*/

swig.setFilter('highlighter', function (input, highlight) {
  if (highlight === null || highlight === 0) {
    return input;
  } else {
    var words = input.split(' ');
    return {
      highlights: words.slice(0, highlight).join(' '),
      rest: words.slice(highlight).join(' ')
    };
  }
});

swig.setFilter('moment', function (date, format) {
  return moment(date).format(format === undefined ? 'ddd D MMM' : format);
});

module.exports = swig;