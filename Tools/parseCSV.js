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

function parseFromFile(filepath, seperator, cb, func){
    fs.readFile(filepath, "utf8", function (err, data) {
        if (err) return cb(err);

        //console.log('First char is >' + data.charCodeAt(0) + '<');
        if(data.charCodeAt(0) > 256) {
            console.error('[Parser]> Found invalid character data, removing it');
            data = data.substr(1);
        }


        data = data.replace(/\r/g,"");
        data = convertToJson(data, seperator, func);
        cb(null, data);
    });
}

function writeToFile(filepath, data, cb){
    fs.writeFile(filepath, data, "utf8", cb);
}

function parseFromString(string, seperator, cb){
    cb(null, convertToJson(string, seperator));
}

function convertToJson(strs, separator, func){
    let lines = strs.split('\n');
    if(!separator)
        separator = getSeperator(lines[0]);


    let keys = splitLine(lines[0], separator);

    for(let i = 0; i < keys.length; i++){
        let test = {};
        test[keys[i]] = "test";
    }

    let arr = [];

    for(let i = 1; i < lines.length; i++){
        if(!lines[i]) // Skip last newline
            continue;

        let values = splitLine(lines[i], separator);
        let obj = createJsonObj(keys, values);

        // In case the user wants to order the objects by themselves
        if(func && typeof func === 'function')
            func(obj);
        else
            arr.push(obj);
    }

    return arr;
}

function createJsonObj(keys, values){
    let obj = {};
    for(let i = 0; i < keys.length; i++){
        obj[keys[i]] = values[i];
    }

    return obj;
}

function getSeperator(lines){
    if(lines.indexOf(';') !== -1){
        return ';';
    }else {
        return ',';
    }
}

function splitLine(line, separator){
    let chars = Array.from(line);
    let words = [];
    let word = [];
    let pause = 0;

    for(let i in chars) {
        if (pause && chars[i] === '"') {
            pause--;
        }
        else if (!pause && chars[i] === '"') {
            pause++;
        }
        else if (!pause && chars[i] === separator) {
            // add word to word list

            words.push(word.join(''));
            word = [];
        } else {
            // Add char to word
            word.push(chars[i]);
        }
    }

    if(word.length > 0)
        words.push(word.join(""));

    return words;
}

function convertToCsv(data, keys, separator){
    let strs = [];
    let str = "";
    if(!separator)
        separator = ';';

    for(let i = 0; i < keys.length; i++){
        if(i > 0)
            str += separator;

        str += keys[i];
    }
    strs.push(str + "\n");

    for(let i = 0; i < data.length; i++){
        strs.push(createCSVline(keys, data[i], separator));
    }
    return strs;
}

function createCSVline(keys, values, seperator){
    let str = "";
    for(let i = 0; i < keys.length; i++){
        if(seperator === ',')
            str += '\"';

        if(i > 0)
            str += seperator;

        if(values[keys[i]] || values[keys[i]] === 0)
            str += values[keys[i]];

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