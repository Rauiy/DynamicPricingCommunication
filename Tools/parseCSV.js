/**
 * Created by Steven on 2018-03-16.
 */
var fs = require('fs'),
    path = require('path');


let test =  'location_id,key2,key3\n'+
            'asd,asd2,asd3\n' +
            'asd,asd2,asd3';

let filename = "../res/originalcsv/PA.csv";

/*
parseFromFile(filename, ';', function(error, data){
    if(error) throw error;
},  function(obj){
        if(obj.parkingarea_id);
        console.log('new object' + JSON.stringify(obj));
    }
); /**/
/**
 * Event based callback
 * @callback EventCallback
 * @param {Object} jsonObject
 */

/**
 * Regular callback
 * @callback CallBack
 * @param {String} errorDescription
 * @param {Array} Converted data
 */


/**
 * Convert a CSV file into json object
 * @param {String} filepath - Path to the CSV file
 * @param {String} separator - The separating sign used in the CSV file
 * @param {CallBack} cb - Call back to
 * @param {EventCallback, null} func - Callback to return converted json object to
 */
function parseFromFile(filepath, separator, cb, func){
    fs.readFile(filepath, "utf8", function (err, data) {
        if (err) return cb(err);

        //Remove invisible chars in the beginning of the file
        if(data.charCodeAt(0) > 256) {
            console.error('[Parser]> Found invalid character data, removing it');
            data = data.substr(1);
        }

        // Remove return signs
        data = data.replace(/\r/g,"");
        data = convertToJson(data, separator, func);
        cb(null, data);
    });
}


function writeToFile(filepath, data, cb){
    fs.writeFile(filepath, data, "utf8", cb);
}

/**
 * Convert a csv data string into json
 * @param string
 * @param separator
 * @param cb
 */
function parseFromString(string, separator, cb){
    cb(null, convertToJson(string, separator));
}

/**
 * Function converts csv tabular data into JSON, either returns as an array or eventbased
 * Eventbased returns each converted object in a callback function
 * @param{String} strs - String to convert
 * @param{String} separator - The separator used in csv file, such as ";" or ","
 * @param{EventCallback, null} func - Callback to return converted json object to
 * @returns {Array}
 */
function convertToJson(strs, separator, func){
    // Split into separate lines
    let lines = strs.split('\n');

    // No separator was provided try figure out the separator
    if(!separator)
        separator = getSeperator(lines[0]);

    // Get list of keys (first line)
    let keys = splitLine(lines[0], separator);

    // Prepare array for json objects
    let arr = [];

    for(let i = 1; i < lines.length; i++){
        if(!lines[i]) // Skip last newline
            continue;

        // Split lines into values
        let values = splitLine(lines[i], separator);
        // Put the keys and values together (Builds the json object)
        let obj = createJsonObj(keys, values);

        // In case the user wants to order the objects by themselves
        if(func && typeof func === 'function')
            func(obj); // Return the json object using the callback
        else
            arr.push(obj); // Put the json object to the array
    }

    // Return all json objects
    return arr;
}

/**
 * Builds a json object with data from a single line
 * @param {Array} keys - The CSV keys
 * @param {Array} values - The CSV values
 * @returns {Object} the converted CSV line (json object)
 */
function createJsonObj(keys, values){
    let obj = {};

    // Populate the json object
    for(let i = 0; i < keys.length; i++){
        obj[keys[i]] = values[i];
    }

    return obj;
}


/**
 * Tries figure out what the CSV file uses as separator (Currently a bit too stupid method)
 * @param{String} lines - Key line to analyze
 * @returns {*} the separator
 */
function getSeperator(lines){
    if(lines.indexOf(';') !== -1){
        return ';';
    }else {
        return ',';
    }
}

/**
 * Splits a CSV line by the separators, i.e. converts the line to an array of values
 * @param {String} line - The CSV line to split
 * @param {String} separator - The separator used in the CSV file
 * @returns {Array} The values that was split
 */
function splitLine(line, separator){
    // Redefines the string into char array
    let chars = Array.from(line);

    // List of the values
    let values = [];
    // Current word (the value to be added)
    let value = [];

    // Counter for citation signs
    let pause = 0;

    for(let i in chars) {
        // Check if end of pause (ignores separator signs if paused)
        if (pause && chars[i] === '"') {
            pause--;
        }
        // Check for citation sign (pauses the search for separator)
        else if (!pause && chars[i] === '"') {
            pause++;
        }
        // Check for end of value
        else if (!pause && chars[i] === separator) {
            // add value to value list
            values.push(value.join(''));

            // Resets the value list
            value = [];
        }
        // Add character to the value list
        else {
            // Add char to word
            value.push(chars[i]);
        }
    }

    //
    if(value.length > 0)
        values.push(value.join(""));

    return values;
}

/**
 * Converts json data into CSV data
 * @param{Array} data - Array containing the CSV data as JSON objects.
 * @param{Array} keys - Array containing the CSV keys
 * @param{String} separator - separator sign
 * @returns {Array} The converted CSV data
 */
function convertToCsv(data, keys, separator){
    let strs = [];
    let str = "";
    // If no separator was provided using ";" as default separator
    if(!separator)
        separator = ';';

    // Create first CSV row (containing keys only)
    for(let i = 0; i < keys.length; i++){
        if(i > 0)
            str += separator;
        str += keys[i];
    }
    strs.push(str + "\n");

    // Converts rest of the data and add to array holding the CSV rows
    for(let i = 0; i < data.length; i++){
        strs.push(createCSVline(keys, data[i], separator));
    }

    return strs;
}

/**
 * Turns a json object into a CSV line
 * @param{Array} keys - Array containing the CSV keys
 * @param{Array} values - Array containing CSV entries
 * @param{String} seperator - The separator for the CSV file
 * @returns {string}
 */
function createCSVline(keys, values, seperator){
    let str = "";
    for(let i = 0; i < keys.length; i++){
        // If , separator is used, citations might be needed
        // TODO: Properly determine when citations should be used
        if(seperator === ',')
            str += '\"';

        // Do not add separator before first entry
        if(i > 0)
            str += seperator;

        // Add values to the CSV line
        if(values[keys[i]] || values[keys[i]] === 0)
            str += values[keys[i]];

        // End citation if it was started
        if(seperator === ',')
            str += '\"';
    }
    return str + "\n";
}

module.exports = {
    parseFromFile:parseFromFile,
    parseFromString:parseFromString,
    convertToCsv:convertToCsv,
    writeToFile:writeToFile,
}