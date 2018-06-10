/**
 * Created by Steven on 2018-03-13 sly@kth.se
 * tools to build a json object according to dynamic pricing communication protocol
 */
const uuidv4 = require('uuid/v4');
const fs = require('fs');

// jsonObject describing data fields relations. Only parents has keys
// Should add as a config file or something
const order = {
    location: ['name', 'areaNumber', 'description', 'address', 'geoLocations', 'advancedLocation', 'contact', 'auxiliary', 'areas', 'occupancies', 'tariffs', 'log'],
    address: ['number', 'street', 'postalCode', 'city', 'country'],
    geoLocations: ['geoLocation'],
    geoLocation: ['latitude', 'longitude', 'geoType', 'locationName'],
    contact: ['contactName', 'organization', 'email', 'phonenumber'],
    auxiliary: ['public', 'paid', 'locationType', 'timeZone', 'operatingHours', 'surcharges'],
    operatingHours: ['schedule'],
    surcharges: ['taxIncluded', 'tax', 'other'],
    areas: ['area'],
    area: ['areaName', 'areadDescription', 'geoLocation'],
    occupancies: ['occupancy'],
    occupancy: ['locationId', 'supply', 'occupied', 'occupiedPct', 'average', 'parkingSpaces', 'log'],
    parkingSpaces: ['parkingSpace'],
    parkingSpace: ['spaceId', 'spaceNumber', 'status', 'frequency', 'occupationStart', 'occupationEnd', 'spaceType', 'detectionType', 'updated'],
    tariffs: ['tariff'],
    tariff: ['tariffId', 'locationId', 'supersedes','restrictions', 'rates', 'activeSchedules', 'validSchedules', 'log'],
    rates: ['rate'],
    activeSchedules: ['activeSchedule'],
    validSchedules: ['validSchedule'],
    restrictions: ['tariffType', 'maxFee', 'minFee', 'maxPaidParkingTime', 'maxParkingTime', 'prepaid', 'resetTime', 'targetGroup', 'vehicle'],
    rate: ['order', 'value', 'interval', 'repeat', 'intervals', 'unit', 'max', 'countOnlyPaidTime'],
    activeSchedule: ['activeScheduleId', 'startTime', 'endTime', 'days'],
    validSchedule: ['validScheduleId', 'validFrom', 'validTo', 'validTimeFrom', 'validTimeTo', 'validDays'],
    log: ['updated', 'user', 'created', 'author'],
};

// Special case elements, maybe put them in a single
const special = ['geoLocation', 'area', 'occupancy', 'parkingSpace', 'tariffs', 'rates', 'activeSchedules', 'validSchedules', 'days', 'validDays', 'targetGroup'];
const boolean = ['repeat', 'taxIncluded', 'public', 'paid'];
const date = ['validTo', 'validFrom'];
const time = ['startTime', 'endTime'];

let days = { // Could use
    MONDAY: 'MONDAY',       //0
    TUESDAY: 'TUESDAY',     //1
    WEDNESDAY: 'WEDNESDAY', //2
    THURSDAY: 'THURSDAY',   //3
    FRIDAY: 'FRIDAY',       //4
    SATURDAY: 'SATURDAY',   //5
    SUNDAY: 'SUNDAY',       //6
    DAY_BEFORE_RED_DAY: 'DAY_BEFORE_RED_DAY', //7
    HOLIDAY: 'HOLIDAY',     //8
};

// Date function to get IsoString format with GMT signs
Date.prototype.toIsoString = function () {
    let tzo = -this.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function (num) {
            let norm = Math.floor(Math.abs(num));
            return (norm < 10 ? '0' : '') + norm;
        };
    return this.getFullYear() +
        '-' + pad(this.getMonth() + 1) +
        '-' + pad(this.getDate()) +
        'T' + pad(this.getHours()) +
        ':' + pad(this.getMinutes()) +
        ':' + pad(this.getSeconds())
        + dif + pad(tzo / 60) + ':' + pad(tzo % 60);
};

/**
 * Writes json object to file
 * @param{string} filename - path and filename
 * @param{json} data - Json object to write
 * @return
 */
function writeFile(filename, data) {
    fs.writeFile(
        filename,
        data,
        function (error) {
            if (error) {
                console.log(error);
            } else {
                console.log('The file was successfully saved as: ' + filename);
            }
        }
    );
}

/**
 * Creates a basic object with mandatory element placeholders
 * @param{string} type - Element type
 * @param{string} [id] - Element ID
 * @return{object} a basic object
 */
function createObjectBase(type, id) {
    let root = {};
    root['type'] = type;
    if (id)
        root[type + 'Id'] = id;
    //else
      //  root[type + 'Id'] = '-1';
    switch (type) {
        case 'rate':
            //root['rateId'] = -1;
            root['order'] = -1;
            root['value'] = 0;
            root['interval'] = 1;
            root['intervals'] = 1;
            root['unit'] = 'MIN';
            root['repeat'] = false;
            root['max'] = false;
            break;
        case 'restrictions':
            root['tariffType'] = '';
            root['targetGroup'] = [];
            break;
        case 'activeSchedule':
            root['startTime'] = 0;
            root['endTime'] = 0;
            root['days'] = [];
            break;
        case 'validSchedule':
            root['validFrom'] = -1;
            root['validTo'] = -1;
            root['validTimeFrom'] = -1;
            root['validTimeTo'] = -1;
            root['validDays'] = [];
            break;
        default:
            break;
    }

    return root;
}

/**
 * Creates a basic tariff object with mandatory element placeholders
 * @param{string, uuid} id - Tariff ID
 * @param{string} locationId - Location ID
 * @return{object} a base tariff object
 */
function createTariffBase(id, locationId) {
    let tariff = {};

    // Set a given id or randomize a new
    tariff['type'] = 'tariff';
    tariff['tariffId'] = ((id) ? id : uuidv4());
    tariff['locationId'] = locationId;
    tariff['restrictions'] = {}; // object
    tariff['rates'] = []; // array
    tariff['activeSchedules'] = []; // array
    tariff['validSchedules'] = []; // array
    tariff['log'] = logElement(new Date().toISOString(), 'auto', new Date().toISOString(), 'auto');

    return tariff;
}

/**
 * Creates a basic occupancy object with mandatory element placeholders
 * @param{string} locationId - Location id
 * @return{object} a basic occupancy object
 */
function createOccupancyBase(locationId) {
    let occupancy = {};
    occupancy['type'] = 'occupancy';
    occupancy['locationId'] = locationId;
    occupancy['areaName'] = '';
    occupancy['supply'] = 0;
    occupancy['occupied'] = 0;
    //occupancy['occupiedPct'] = 0;
    //detectionType
    //parkingSpace
    occupancy['log'] = logElement(new Date().toISOString(), 'auto', new Date().toISOString(), 'auto');
    return occupancy;
}

/**
 * Creates a basic location object with mandatory element placeholders
 * @param{string} id - Location id
 * @param{string, null} [name] - Location name
 * @param{string} [areaNumber] - Local area number
 * @return{object} a basic location object
 */
function createLocationBase(id, name, areaNumber) {
    let location = {};
    location['type'] = 'location';
    location['locationId'] = ((id) ? id : uuidv4());
    location['name'] = ((name) ? name : 'unnamed');
    location['areaNumber'] = areaNumber;
    location['address'] = {}; //object
    location['contact'] = {}; //object
    location['auxiliary'] = {}; // object
    location['log'] = logElement(new Date().toISOString(), 'auto', new Date().toISOString(), 'auto');
    return location;
}

// Function that adds element to an object under a specific element with id
/**
 * Adds element to an object (can be a child object) with specific ID
 * (Because there is only one id as input, multiple arrays cannot be traversed through
 * For example: Cannot find the right rate object from an array of tariffs)
 * @param{Object} root - The object to add the new element to
 * @param{String} type - The tag of the parent you want to add element to
 * @param{String} id - The id of the parent
 * @param{String} tag - The tag of the element
 * @param{*} value - The value of the element
 */
function addElementToId(root, type, id, tag, value) {
    if(!type || !id)
        return {failurePath:['addElementToId'], error:'Type or Id are missing',success:false};
    else if(!tag || !value)
        return {failurePath:['addElementToId'], error:'Element tag or value are missing',success:false};

    let path = getPath(root.type, type);
    console.log(path);
    path = path.path;
    let curr = root;
    for(let i = 1; i < path.length; i++){
        if(curr[path[i]]) {
            curr = curr[path[i]];
            console.log('->' + JSON.stringify(curr));
        }
        else if(Array.isArray(curr) && i === path.length-1 && curr[0].type === type){
            console.log('found holding array');
        }else{
            return {failurePath:['addElementToId'], error:'root object was missing a ' + path[i] + ' object', success:false};
        }
    }

    for(let i = 0; i < curr.length; i++){
        if(curr[i][type+'Id'] === id){
            curr = curr[i];
            // Found right parent add the element
            let res = addElementTo(curr, null, tag, value);
            if(res.error) {
                res.failurePath.push('addElementToId');
            }
            return res;
        }
    }

    return {failurePath:['addElementToId'], error:'could not find parent ' + type + ' with id ' + id, success:false};
}

/**
 * Adds an element to an object
 * @param{Object} root - An object to add element to
 * @param{string, null} type - The tag of the expected parent
 * @param{string} tag - The tag of element to be added
 * @param{*} value - The value of element to be added
 * @param{boolean} [forceOverwrite] - If existing entry values is to be overwritten
 * @return{object} result - success or error - error message
 */
function addElementTo(root, type, tag, value, forceOverwrite) {
    if (!type)
        type = findParent(tag);

    //if(tag === 'maxFee') if any specific element fails...
    //console.log(root.type + ':' + type + ' : ' + tag)

    if (type === root.type) {
        // Element parent is the root object
        addValue(root, tag, value, forceOverwrite);
    }
    else if (order[root.type].indexOf(type) !== -1) {
        // Element parent is a direct child of the root object
        let res;

        // Double check so the parent exists
        if (root[type])
            res = addValue(root[type], tag, value, forceOverwrite);
        else {
            // Parent element is missing so add the parent first
            let tmp = {}; // Initiate an empty object (for a parent element)
            addValue(root, type, tmp);
            res = addValue(root[type], tag, value, forceOverwrite);
        }

        if (res.error) {
            res.failurePath.push('addElementTo');
            return res;
        }
    }
    else {
        // Possible to add hierarchy search and then add element to right place
        return {error: 'could not add element ' + tag + ' to ' + root.type};
    }

    return {success:true};

}

/**
 * Adds an element value to an parent element
 * @param{Object} parent - Parent element
 * @param{string} tag - The tag of the element
 * @param{string, {}} value - The value of the element
 * @param{boolean} [forceOverwrite] - If existing entry values is to be overwritten
 */
function addValue(parent, tag, value, forceOverwrite) {
    if (!parent)
        return {failurePath:['addValue'], error:'Parent element for ' + tag + ' is missing'};

    // Check if element is part of a list
    if (special.indexOf(tag) === -1) {
        // Element is not part of a list

        // If the value to be added is not the same as the current value, overwrite the value
        if (parent[tag] && parent[tag] !== -1 && parent[tag] !== '-1' && tag.indexOf('Id') !== -1 && !forceOverwrite) {
            // Element is of type ID, and have been assigned a value (Not initial -1)
            // Do not want to accidently overwrite ID
            return {failurePath:['addValue'], error:'ID element ' + tag + ' is already assigned, if intentional use force overwrite'};;
        }
        else if (parent[tag] !== value || forceOverwrite) {
            // Overwrite value
            parent[tag] = value;
        }
    }
    else if (parent[tag] && !forceOverwrite) {
        // Parent element is a list object which is initiated
        // Only used for enum tokens

        // Add new value to list
        if (parent[tag].indexOf(value) === -1)  // Make sure the content is unique, no duplicate days etc...
            parent[tag].push(value);
    }
    else {
        // Parent element is a list object which is not initiated

        // Add and initiate as a list
        parent[tag] = [value];
    }
    return {result: 'success'};
}

/**
 * Gets the parent tag of the element
 * @param{string} child - the tag of the child element
 * @returns{string, null} the tag of the parent
 */
function findParent(child) {
    // Search in the hierarchy lists after a parent tag for the child
    if (order[child + 's']) {
        return child + 's';
    }
    else {
        for (let k in order) {
            //console.log(k + ' parent to ' + child + ' = ' + (order[k].indexOf(child) != -1));
            if (order[k].indexOf(child) !== -1) {
                return k;
            }
        }
    }
    return '';
}

/**
 * Gets the hierarchy path from an element (Parent) to an element (Child)
 * @param{String} from - where path should start from
 * @param{String} to - where path should lead to
 * @returns {{path:Array}, {failurePath:*, error:*}}
 */
function getPath(from, to){
    if(from === to){
        // If someone tried getting the element from itself
        return {path:[to]};
    }

    let path = [to];

    // Path start was not provided, assume path goes from root
    if(!from)
        from = 'root';

    let curr = to;
    while(curr !== from){
        // Get parent of current element
        let res = findParent(curr);

        if(!res){
            return {failurePath: ['getPath'],error: 'could not find path between ' + from + " to " + to  + '. ' + curr + ' has no parent'};
        }

        curr = res;

        // Add tag to path list
        if(curr !== 'root')
            path.push(curr);
    }

    path = path.reverse();
    return  {path};
}


/**
 * Creates a log object
 * @param{Date} updated - Date of when the object was latest updated
 * @param{string} user - Name or alias of the user to updated the object
 * @param{Date} created - Date of when the object was created
 * @param{string} creator - Name or alias of the creator of the object
 * @return{object} a log object
 */
function logElement(updated, user, created, creator) {
    var log = {};

    log['updated'] = new Date(updated).toIsoString();
    log['user'] = user;
    log['created'] = new Date(created).toIsoString();
    log['author'] = creator;

    return log;
}

function getDefault(type){
    let root = {};
    switch (type){
        case 'activeSchedule':
            root['activeScheduleId'] = 0;
            root['startTime'] = 0;
            root['endTime'] = 1440;
            root['days'] = [
                'MONDAY',
                'TUESDAY',
                'WEDNESDAY',
                'THURSDAY',
                'FRIDAY',
                'SATURDAY',
                'SUNDAY',
                'DAY_BEFORE_RED_DAY',
                'HOLIDAY'
            ];
            break;
        case 'validSchedule':
            root['validScheduleId'] = 0;
            root['validFrom'] = new Date().toIsoString();
            root['validTo'] = new Date('2099-12-31T23:59:59').toIsoString();
            root['validTimeFrom'] = 0;
            root['validTimeTo'] = 1440;
            root['validDays'] = [
                'MONDAY',
                'TUESDAY',
                'WEDNESDAY',
                'THURSDAY',
                'FRIDAY',
                'SATURDAY',
                'SUNDAY',
                'DAY_BEFORE_RED_DAY',
                'HOLIDAY'
            ];
            break;
        default:
            break;
    }

    return root;
}

/**
 * Generates a unique UUID
 * @return{uuid} a unique UUID
 */
function getUniqueId() {
    return uuidv4();
}

module.exports = {
    addElementTo: addElementTo,
    //addElementToId: addElementToId,
    logElement: logElement,
    writeFile: writeFile,
    createTariffBase: createTariffBase,
    createLocationBase: createLocationBase,
    createOccupancyBase: createOccupancyBase,
    createObjectBase: createObjectBase,
    getUniqueId: getUniqueId,
    getDefault: getDefault,
    days: days,
}