const moment = require('moment');
const nunjucks = require('nunjucks');

const highlighter = function (input, highlight) {
    if (highlight === null || highlight === 0) {
        return {
            highlights: '',
            rest: input
        };
    } else {
        var words = input.split(' ');
        return {
            highlights: words.slice(0, highlight).join(' '),
            rest: words.slice(highlight).join(' ')
        };
    }
};

const momentFilter = function (format, date) {
    return moment(date).format(format === undefined || format === '' ? 'ddd D MMM' : format);
};

const unix = function (timestamp, format) {
    return moment(timestamp).format(format === undefined || format === '' ? 'ddd D MMM' : format);
};


const tracking = function (format, after, at) {
    format = format === undefined || format === '' ? 'YYYYMMDD' : format;
    if (after) {
        return moment().add(after, 'minutes').format(format);
    } else if (at) {
        return moment(at).format(format);
    } else {
        return moment().format(format);
    }
};

const yyyymmdd = function (timestamp) {
    if (timestamp === '') {
        return moment().format('YYYYMMDD');
    } else {
        return moment(timestamp).format('YYYYMMDD');
    }
};

const hasValue = function (listOfValues, value) {
    return Object.prototype.toString.call(listOfValues) !== '[object Array]' ?
        false :
        listOfValues.indexOf(value) > -1;
};

const tagValue = function(inputTags, tagName, defaultValue){
    if(inputTags === undefined || inputTags === null || Object.prototype.toString.call(inputTags) !== '[object Array]') {
        return defaultValue ? defaultValue : undefined;
    }

    const tag = inputTags.find(function(t){
        return t.indexOf(tagName) === 0;
    });

    if(tag){
        return tag.split(':')[1];
    } else {
        return defaultValue ? defaultValue : undefined;
    }
};

const hasTag = function(tags, tagValue, tagField){

    if (!tags instanceof Array || typeof tags === 'string') {
        return false;
    }

    if (tagValue === undefined || tagValue === null) {
        return false;
    }

    if(tagField === undefined){
        return tags.some(function(tag){
            // Eg. Tag is "berlingske_header_name:Morgen"... we use "hasTag()"
            return tag === tagValue || tag.split(':')[0] === tagValue;
        });
    } else {
        return tags.some(function(tag){
            return tag[tagField] === tagValue;
        });
    }
};

const typeOfFilter = function (variable) {
    return Object.prototype.toString.call( variable );
};

const strreplace = function (input, substr, newSubStr) {
    return input.replace(substr, newSubStr);
};

const setAttribute = function(dictionary, key, value) {
    dictionary[key] = value;
    return dictionary;
};

const json = function (value, spaces) {
    if (value === undefined)
        return nunjucks.runtime.markSafe('undefined')
    if (value instanceof nunjucks.runtime.SafeString) {
        value = value.toString()
    }
    const jsonString = JSON.stringify(value, null, spaces).replace(/</g, '\\u003c')
    return nunjucks.runtime.markSafe(jsonString)
};

module.exports = (env) => {

    env.addFilter('highlighter', highlighter);

    env.addFilter('moment', momentFilter);

    env.addFilter('unix', unix);

    env.addFilter('tracking', tracking);

    env.addFilter('yyyymmdd', yyyymmdd);

    env.addFilter('hasValue', hasValue);

    env.addFilter('tagValue', tagValue);

    // Usage eg.
    //  node.taxonomyTags.presentationTags | hasTag("334794", "id")
    //  node.taxonomyTags.presentationTags | hasTag("www.b.dk > Artikel > I abonnement", "fullName")
    env.addFilter('hasTag', hasTag);

    env.addFilter('typeof', typeOfFilter);

    env.addFilter('stringreplace', strreplace);

    env.addFilter('setAttribute', setAttribute);

    env.addFilter('json', json)

}
