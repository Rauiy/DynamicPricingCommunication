/**
 * Created by Steven on 2018-03-13 sly@kth.se
 * Tools that translate a specific type of database data into json format
 *
 * Location has no hierarchy, everything's in parking area rows
 *
 * CSV har the hierarchy of Tariff Table (Partly tariff and valid start times)
 *                            | -> Tariff Units (Partly tariff and valid use times)
 *                                   | -> Tariff Prices (Rates)
 *
 * BucketCSV has the hierarchy of Tariff Table (valid times)
 *                                   | -> Tariff Units (rates)
 *                                   | -> Taxable Time (TeaTime)
 */

const pwt = require('./protocolWritingToolsJson'),
    data = require('./fakeDatabase');

// jsonObject describing data fields relations.
// Should add as a config file or something
let jsonMaps = {
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
    tariff: ['tariffId', 'locationId', 'supersedes', 'rates', 'activeSchedules', 'validSchedules', 'restrictions', 'log'],
    rates: ['rate'],
    rate: ['order', 'value', 'interval', 'repeat', 'intervals', 'unit', 'max', 'countOnlyPaidTime'],
    activeSchedules: ['activeSchedule'],
    validSchedules: ['validSchedule'],
    activeSchedule: ['activeScheduleId', 'startTime', 'endTime', 'days'],
    validSchedule: ['validScheduleId', 'validFrom', 'validTo', 'validTimeFrom', 'validTimeTo', 'validDays'], // special case as the elements have other names in different
    restrictions: ['tariffType', 'maxFee', 'minFee', 'maxPaidParkingTime', 'maxParkingTime', 'prepaid', 'resetTime', 'targetGroup', 'vehicle'],
    log: ['updated', 'user', 'created', 'author'],
};

// Lookup table to translate source element names into JSON element names
const transToFormat = {

    // Location Elements
    location_ID_element: 'locationId',
    area_name_element: 'name',
    area_number_element: 'areaNumber',
    street_element: 'street',
    postalcode_element: 'postalCode',
    city_element: 'city',
    country_element: 'country',
    timezone_element: 'timeZone',

    // Active Schedule Element
    starttime_element: 'startTime',
    endtime_element: 'endTime',
    days_element: 'days',

    // Valid Schedule Elements
    validfrom_element: 'validFrom', // Date
    validto_element: 'validTo', // Date
    validtimefrom_element: 'validTimeFrom',
    validtimeto_element: 'validTimeTo',
    validdays_element: 'validDays',

    // Rate Elements
    value_element: 'value',
    interval_element: 'interval',
    intervals_element: 'intervals',
    repeat_element: 'repeat',
    max_element: 'max',
    unit_element: 'unit',

    // Restrictions Elements
    maxfee_element: 'maxFee',
    minfee_element: 'minFee',
    maxparkingtime_element: 'maxParkingTime',
    targetgroup_element: 'targetGroup',
    tarifftype_element: 'tariffType',
    prepaid_element: 'prepaid',

    // Type conversions
    hourly_tarifftype: 'REGULAR',
    fixed_tarifftype: 'FIXED',

    // Target audience conversions
    public_audience: 'PUBLIC',
    residential_audience: 'RESIDENTIAL',
    personnel_audience: 'PERSONNEL',
    individual_audience: 'INDIVIDUAL',

    // Unit values
    MINUTE: 1, // 1
    HOUR: 60, // 60 x 1
    DAY: 1440, // 60 x 24
    WEEK: 10080, // 60 x 24 x 7
    MONTH: 40320, // 60 x 24 x 30
    YEAR: 525600, // 60 x 24 x 30 x 12 or 60 x 24 x 365
};

// Lookup table for translating JSON elements to source format elements
const transToSrc = {
    // Basically the opposite of transToFormat
};

// Date function to get IsoString format with GMT sign
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
 * Convert data rows with tariff information into tariff objects
 * @param{Object} data - Data rows to convert to json, should be key separated
 * @returns {*} array of tariff objects or error
 */
// Try make it auto adapt for both buckets and regular
function convertTariffData(data) {
    // Get all tariff table id (outer restriction)
    let  locationIds = Object.keys(data.SU);

    // If neither was provided
    if(!data['TP'] && !data['BU'])
        return {error: 'Required data was not provided'};

    if (!locationIds.length)
        return {error: 'Could not find any location ids in provided data'};

    let tariffs = [];

    for (let i = 0; i < locationIds.length; i++) {
        let dat = {};

        // Filter out only relevant data for the locations
        // This is required because some tariff tables are reused by multiple locations
        // Only SU data might clash because of multiple location might have the same tarifftable
        dat.SU = data.SU[locationIds[i]];//getRowsWithId(data['SU'], transToCsv.locationId, locationIds[i]);

        let tariffTableIds = getKeyValues(dat.SU, transToCsv.tariffTableId);
        // Get tarifftableIds associated with location Id
        for(let j = 0; j < tariffTableIds.length; j++) {
            // Try convert into regular
            if (dat.TP)
                res = createTariffObjects(tariffTableIds[j], dat, tariffs);

            if (res && res.error) {
                //console.error('Error converting tariff object: ' + tariffTableIds[j] + '. ' + res.error);
            }

        }
    }
    return tariffs;
}

/**
 * UNDER CONSTRUCTION
 * @returns {{error: string}}
 */
function convertOccupancyData() {
    return {error: 'There is currently no way to convert occupancy data'};
}

/**
 * Convert date object into ISO string (with gmt notation)
 * @param date
 */
function convertDate(date) {
    date = new Date(date);

    return date.toIsoString();
}

/**
 * Example on how to create a tariff object
 * @param data - A set of data as JSON corresponding to a full tariff
 * @param tariffs - A JSON array to put generated tariffs at
 * @returns {Array} - Returns the tariffs array, in case no array was provided
 */
function createTariffObject(data, tariffs) {
    if(!tariffs)
        tariffs = [];
    // Example adds data in the order -> IDS -> Restrictions -> Rates -> Active Schedules -> Valid Schedules -> Log
    // However, the actual order after the IDs, do not matter.

    // Initiate the tariff object, by providing getting the tariff ID and location ID
    let tariff = pwt.createTariffBase(data['tariffID'], data['locationID']);

    // Create restrictions object
    let restrictions = pwt.createObjectBase('restrictions');
    // TODO: populate the restrictions object with necessary data
    pwt.addElementTo(tariff, null, 'restrictions', restrictions);

    // TODO: generate and populate rate objects
    // Get all the rate data for that specific tariff
    addRates(data['rateData'], tariff);

    // TODO: generate and populate active schedule objects
    // Get all active time data for that specific tariff
    addActiveSchedules(data['activeScheduleData'],tariff);

    // If valid 24/7 you can add the default object. (every day and time between 0 - 1440)
    pwt.addElementTo(tariff, null, 'achiveSchedules', pwt.getDefault('activeSchedule'));

    // TODO: generate and populate valid schedule objects
    addValidSchedules(data['validScheduleData'],tariff);

    // If the valid date is unknow or not decided you can use default values (every day and time from 0-1440, todays date to 2099-12-31T23:59:59 local time)
    pwt.addElementTo(tariff, null, 'achiveSchedules', pwt.getDefault('validSchedule'));


    // TODO: generate and populate log object
    // If the tariff is new and no log data exist
    pwt.addElementTo(tariff, null, 'log', pwt.logElement(new Date(), 'Updating user', new Date(), 'Creator'));

    // Add the newly created tariff to the colelction of tariffs
    tariffs.push(tariff);
    return tariffs;
}

/**
 * Example on adding active schedules to the tariff
 * @param{Object} scheduleData - Schedule data that defines when a tariff is active
 * @param{Object} tariff - The tariff object to add schedules to
 */
function addActiveSchedules(scheduleData, tariff) {

    for (let i = 0; i < scheduleData.length; i++) {
        // Create active schedule object using template
        let schedule = pwt.createObjectBase('activeSchedule');

        // TODO: Populate schedule with data

        // autoAddElements can be used to automatically add elements to schedule object
        autoAddElements(jsonMaps.activeSchedule, scheduleData[i], schedule);

        // Or add them individually
        pwt.addElementTo(schedule, null, 'startTime', 0); // Starts 00:00:00
        pwt.addElementTo(schedule, null, 'endTime', 1440); // Ends 23:59:59

        pwt.addElementTo(schedule, null, 'days', 'MONDAY');
        // . . .
        pwt.addElementTo(schedule, null, 'days', 'FRIDAY');

        // Add the new schedule to the tariff
        // activeSchedules is a list element
        pwt.addElementTo(tariff, null, 'activeSchedules', schedule);
    }

    return tariff;
}

/**
 * Converts and adds rate objects to tariff object
 * @param{Array} rateData - Data rows containing rate data
 * @param{Object} tariff - A tariff object to put rates to
 * @param{Object} misc - Misc object containing additional information
 * @returns {Object} Tariff object
 */
function addRates(rateData, tariff, misc) {


    for (let i = 0; i < rateData.length; i++) {
        // Create rate object using template
        let rate = pwt.createObjectBase('rate');

        // TODO: Populate the rate object

        // Try automatically add elements to rate object
        autoAddElements(jsonMaps.rate, rateData[i], rate);

        // Or manually add them individually
        pwt.addElementTo(rate, null, 'value', 10); // 10 money
        pwt.addElementTo(rate, null, 'interval', 60); // 60 min i.e. 1 hour
        pwt.addElementTo(rate, null, 'intervals', 1); // valid for 1 time
        // Add additional data (if exists)
        pwt.addElementTo(rate, null, 'repeat', false); // Does not repeat
        pwt.addElementTo(rate, null, 'max', false); // Does not refer to a maximum fee

        pwt.addElementTo(tariff, null, 'rates', rate); // Add rate to tariff
    }

    return tariff;
}


// Help functions

function cloneObject(obj, id, number){
    if(number === 1)
        return [obj];
    else if(number < 1)
        return [];

    let clones = [];
    for(let i = 0; i < number; i++){
        clones.push(JSON.parse(JSON.stringify(obj))); // Create hard copy
        pwt.addElementTo(clones[i], null, id, obj[id] + 'TT' + i);
    }

    return clones;
}

/**
 *
 * @param{Array<string>} names - Name of the elements to add
 * @param{Object} row - Data row containing the sought after elements
 * @param{Object} data - Pointer to the object where to add elements to
 * @returns {{error: string}} error if failed otherwise success
 */
function autoAddElements(names, row, data) {
    if (!data) {
        return {error: 'no data array were provided'};
    }

    for (let i = 0; i < names.length; i++) {
        // Translates the csv data field name into xml data field name
        let tag = names[i];
        let trans = transToCsv[tag];

        // Could not find corresponding name in lookup, skip data field
        if (!trans) {
            continue;
        }

        // create a shortcut to data field value
        let val = row[trans];

        // No value to add skipp
        if (!val && val !== 0) // 0 is a value
            continue;

        val = fixType(tag, val);

        let res = pwt.addElementTo(data, null, tag, val);

        if (res.error) {
            console.error(res.error);
        }
    }
}

/**
 * Auto add element to object, based on the elements of the input data
 * @param data - csv row object that contains relevant data
 * @param object - Object to put the data to
 * @returns {*} The object with the new elements added
 */
function autoAdd(data, object) {
    if (!object)
        object = {};

    for (let k in data) {
        if (!data.hasOwnProperty(k) || k.indexOf('_id') !== -1) {
            continue;
        }

        let tag = transToFormat[k];

        if (!tag) {
            continue;
        }

        let val = fixType(tag, data[k]);
        let res = pwt.addElementTo(object, null, tag, val);

        if (res.error) {
            //console.error(res.error);
            // Ignoring the errorrs currently, as I probably just tries to add wrong element to wrong object
        }
    }
    return object;
}

/**
 * Checks and change the value type to the proper one
 * @param tag - the tag, to check type from
 * @param val - value to adjust to right type (if not supposed to be string)
 * @returns {*} transformed value or string
 */
function fixType(tag, val) {
    // Check value might need to be transformed, start end time values
    if (tag.indexOf('interval') !== -1 || (tag.indexOf('max') !== -1 && tag.indexOf('Fee') === -1)) {
        val = parseInt(val);
    } else if (tag === 'value' || tag.indexOf('Fee') !== -1) {
        val = parseFloat(val);
    } else if (tag.indexOf('Time') !== -1) {
        // Protocol displays time in minutes past 00:00, convert time into minutes
        val = convertTime(val);
    } else if (tag.indexOf('valid') !== -1 && tag !== 'validDays') {
        val = convertDate(val);
    }

    return val;
}

/**
 * Transform time (hh:mm:ss) into minutes, works for both 12h and 24h format
 * @param{string} time - The time to convert
 * @returns {number} time expressed in minutes
 */
function convertTime(time) {

    // Split if am or pm is provided
    let parts = time.split(' ');

    // Split into hours, minutes and seconds
    let comp = parts[0].split(':');

    // Convert hours into minutes and add to minutes
    let t = parseInt(comp[0]) * 60 + parseInt(comp[1]);

    if(comp[2] > 30)
        t++;

    // Double check if in 12h or 24h format
    // If 12h fix values, if am and 12:00:00 remove 12hrs of minutes
    // if pm add missing 12hrs of minutes
    if (parts[1]) {
        if (parts[1] === 'PM')
            t = (t + (12 * 60));
        else if (parts[0].substr(0, 2) == '12')
            t -= (12 * 60);
    }

    return t;
}

/**
 * Gets all rows that matches a certain value
 * @param{Array<Object>} rows - Data rows
 * @param{string} key - The tag of the element value to match
 * @param{string} value - The value to match
 * @param{boolean} [valid] - If only valid rows are sought after
 * @returns {Array, boolean} array with all matching rows (empty array if no was found)
 */
function getRowsWithId(rows, key, value, valid) {
    if(!rows || !rows.length) {
        return [];
    }

    let array = [];

    // Iterate over an array of rows
    for (let i = 0; i < rows.length; i++) {
        if (valid) {
            continue;
        }

        // Check if data contains right value
        if (rows[i][key] === value) {
            // Push row into array
            array.push(rows[i]);
        }
    }

    return array;
}

/**
 * Gets all rows that matches any of the provided value
 * @param{Array<Object>} rows - Data rows
 * @param{string} key - The tag of the element value to match
 * @param{Array<String>} value - The value to match
 * @param{boolean} [valid] - If only valid rows are sought after
 * @returns {Array, boolean} array with all matching rows (empty array if no was found)
 */
function getRowsWithValues(rows, key, value, valid){
    if(!rows) {
        return [];
    }

    let array = [];

    // Iterate over an array of rows
    for (let i = 0; i < rows.length; i++) {
        if (valid && new Date(rows[i][transToCsv.validTo]) < new Date()) {
            continue;
        }

        // Check if data contains right value
        if (value.indexOf(rows[i][key]) !== -1) {
            // Push row into array
            array.push(rows[i]);
        }
    }

    return array;
}

/**
 * Gets the first row that matches a certain value
 * @param{Array<object>} rows - Data rows
 * @param{string} key - The tag of the element value to match
 * @param{string} value - The value to match
 * @returns {*} the first data row that has the matching value or false if not found
 */
function getRowWithId(rows, key, value) {
    if(!rows)
        return false;
    // Iterate over an array of rows
    for (let i = 0; i < rows.length; i++) {
        // Check if data contains right value
        if (rows[i][key] === value) {
            // Push row into array
            return rows[i];
        }
    }
    return false;
}

// Generic function to group rows depending on the value of a specific field, can group depending on additional fields
/**
 * Groups some rows according to id and some values
 * @param rows - Data rows to group
 * @param idTag - The tag which has the ID to match
 * @param [keys] - Additional values to match when grouping entries
 * @returns {object} object with the rows grouped
 */
function groupRows(rows, idTag, keys) {
    let arrays = {};

    let groups = '';

    // If additional fields was provided, requires a sorter array
    if (keys)
        groups = 0;

    if(keys.indexOf(idTag) === -1)
        keys.push(idTag);

    for (let i = 0; i < rows.length; i++) {
        // If additional field was provided, create additional subgroups
        let k = rows[i][idTag] + groups;

        if (keys && i > 0) {
            k = findGroup(arrays, rows[i], keys);
            if (!k) {
                groups++;
                k = rows[i][idTag] + groups;
            }
        }

        if (!arrays[k]) {
            arrays[k] = [];
        }
        // Push data to the group
        arrays[k].push(rows[i]);
    }

    return arrays;
}

/**
 * Get a group key from an object (key-value list) that matches an object
 * @param{object} groups - Key-value list (an object as value)
 * @param{object} obj - Object to match with the objects in the key-value list
 * @param{Array<string>} keys - An array of the keys that needs to match for the groups
 * @returns {*} group key if found or '0' if not found
 */
function findGroup(groups, obj, keys) {
    if (!keys)
        return -1;

    for (let k in groups) {
        if (!groups.hasOwnProperty(k))
            continue;

        if (cmpValues(groups[k][0], obj, keys)) {
            // Found a matching group
            return k;
        }
    }
    return 0;
}


/**
 * Compare if two objects matches in some specific values
 * @param{object} obj1 - First object to compare
 * @param{object} obj2 - Second object to compare
 * @param{Array<string>} [keys] - An array of strings, the keys to compare
 * @returns {boolean} true if all the keys matched or false if at least one value was different
 */
function cmpValues(obj1, obj2, keys) {
    for (let i = 0; i < keys.length; i++) {
        if (obj1[keys[i]] !== obj2[keys[i]]) {
            return false;
        }
    }
    return true;
}

/**
 * Gets all unique values of every row that matches an ID
 * @param{Array<object>} rows - The data rows which contains the key-value pair
 * @param{string} targetKey - The key tag of the value you want
 * @param{string} [value] - The value to match
 * @param{string} [valueKey] - The tag of the value to match
 * @returns {Array<string>} Array containing all values or empty array if no matching row was found
 */
function getKeyValues(rows, targetKey, value, valueKey) {
    let values = [];
    for (let i = 0; i < rows.length; i++) {
        if (value && rows[i][valueKey] !== value)
            continue;

        let curr = rows[i][targetKey];
        if (values.indexOf(curr) === -1) {
            values.push(curr);
        }
    }

    return values;
}

/**
 * Gets a specific value of the first row that matches specific key
 * @param{Array<object>} rows - The data rows which contains the key-value pair
 * @param{string} targetKey - The key tag of the value you want
 * @param{string} [value] - The value to match
 * @param{string} [valueKey] - The tag of the value to match
 * @returns {*} the value found or false if no matching row was found
 */
function getKeyValue(rows, targetKey, value, valueKey) {
    if(!value)
        return rows[0][targetKey];

    for (let i = 0; i < rows.length; i++) {
        if (value && rows[i][valueKey] === value)
            return rows[i][targetKey];
    }
    return false;
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
        default:
            break;
    }

    return root;
}

module.exports = {
    convertTariffData: convertTariffData,
    convertLocationData: convertLocationData,
    getRowWithId: getRowWithId,
    getRowsWithId: getRowsWithId,
    getRowsWithValues: getRowsWithValues,
    getKeyValue: getKeyValue,
    getKeyValues: getKeyValues,
    transToCsv: transToCsv,
};