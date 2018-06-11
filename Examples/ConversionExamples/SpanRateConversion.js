/**
 * Created by Steven on 2018-06-10 sly@kth.se
 *
 * The source data are provided in CSV files and consist of span of times and values. Example below (actual rates were given in German)
 *
 * Rate_ID, Tariff_ID,  Interval_from,  Interval_to,    Value_from, Value_to, ...   |
 * 0,       0,          0,              1440,           0,          240,            | -> 10 eur / 60 min, max 24h parking
 *
 * 1,       1,          0,              60,             10,         10,             | -> first hour 10 eur fixed
 * 2,       1,          60,             120,            20,         20,             | -> second hour 10 eur fixed
 * 3,       1,          120,            720,            20,         120,            | -> 10 eur / 60 min for 10 hours
 * 5,       1,          720,            1440,           120,        120,            | -> Then 12 hours free, i.e. 120euro max fee + max 24h parking
 *
 * 6,       2,          60,             720,            0,          110,            | -> First hours free, then 10 eur / 60 min for 11 hours
 * 7,       2,          720,            900,            110,        110,            | -> Three hours free, i.e. 110 euro max fee + max 15h parking
 *
 * 8,       1,          0,              60,             10,         20,             | -> Start fee of 10 Euro, then 10 Euro for rest 59 min (20 eur first hour)
 * 9,       1,          60,             120,            20,         30,             | -> 10 euro last hour, max 2h parking
 * ... etc
 */

const pwt = require('../../tools/protocolWritingToolsJson'),
    parser = require('../../tools/parseCSV');

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

let tariffData = {};
let maxTime = 0, maximumExceeded = 0;

console.log('Start parsing');
parser.parseFromFile('read path + input filename', ';', function (error, data) {
        console.log('Done parsing');
        console.log('Start converting');
        let tariffs = convertTariffs(tariffData);
        console.log('Done converting' + "\t" + tariffs.length + ' tariffs');
        pwt.writeFile('write path + output filename', JSON.stringify({tariffs: tariffs}));
    }, (obj) => {
        if (tariffData[obj.gebuehrenmodell])
            tariffData[obj.gebuehrenmodell].push(obj);
        else
            tariffData[obj.gebuehrenmodell] = [obj];
    }
);
/**/

function convertTariffs(data) {
    let loc = 0;
    let tariffs = [];
    for (let k in data) {
        if (!data.hasOwnProperty(k))
            continue;
        // Create tariff object
        let tariff = pwt.createTariffBase(k, '' + loc++);

        // Start populating tariff object

        // Create restrictions object, assumed values since no was provided
        let restrictions = pwt.createObjectBase('restriction');
        // Do not matter if restrictions object are added before or after populated
        pwt.addElementTo(tariff, null, 'restrictions', restrictions);

        // Populate restrictions object
        pwt.addElementTo(tariff, 'restrictions', 'prepaid', false); // Not prepaid, allows stoppable parking
        pwt.addElementTo(tariff, 'restrictions', 'tariffType', 'REGULAR'); // Regular tariffs by default, double check if fixed later
        pwt.addElementTo(tariff, 'restrictions', 'targetGroup', 'PUBLIC'); // Open to public since no other info was given

        // The span tariff only consist of rates
        convertRates(data[k], tariff);

        // Since we do not have any schedule data provided add for 24/7
        // However, important to get actual active hours (i.e. paid hours) and add them
        pwt.addElementTo(tariff, null, 'activeSchedules', pwt.getDefault('activeSchedule')); // Active 24/7

        // Its okay to assume that the tariff are valid 24/7
        pwt.addElementTo(tariff, null, 'validSchedules', pwt.getDefault('validSchedule'));

        tariffs.push(tariff);
    }
    return tariffs;
}

// Compared to hourly fee, this format require a lot more small fixes
function convertRates(data, tariff) {
    // Sort all rates so they are in order
    data.sort((a, b) => a.intervall_von - b.intervall_von);

    // Check rates if fixed only
    let sum = 0;
    data.forEach((a) => sum += a.gebuehr_bis - a.gebuehr_von);

    // Quick fix for rates that only has fixed rates
    if (!sum) {
        // Have fixed sums only
        //console.log('Fixed values: ' + data[0].gebuehrenmodell);
        for (let i = 0; i < data.length; i++) {
            let rate = pwt.createObjectBase('rate');

            // Get interval data
            let intTo = parseInt(data[i].intervall_bis);
            let intFr = parseInt(data[i].intervall_von);

            // Previous interval
            let preIn = 0;

            // Check if not first rate object
            if (i > 0)
                preIn = parseInt(data[i - 1].intervall_bis); // Get actual previous interval end

            if (preIn && preIn !== intFr) // Check if previous end matches with current
                intFr = preIn;

            pwt.addElementTo(rate, null, 'interval', intTo - intFr); // Calculate interval and add to rate
            pwt.addElementTo(rate, null, 'intervals', 1); // 1 intervals by default, since fixed value
            // calculate rate value and att to rate
            pwt.addElementTo(rate, null, 'value', data[i].gebuehr_von - ((data[i - 1]) ? data[i - 1].gebuehr_bis : 0));
            // Add rate number
            pwt.addElementTo(rate, null, 'order', tariff.rates.length);

            // Add rate to tariff
            pwt.addElementTo(tariff, null, 'rates', rate);

            // Adjust tariff type, since it is fixed rates
            pwt.addElementTo(tariff, null, 'tariffType', 'FIXED');
        }

    } else {
        // Regular rates, might be mixed with fixed rates

        for (let i = 0; i < data.length; i++) {
            let rate = pwt.createObjectBase('rate');

            // Get interval
            let intFr = parseInt(data[i].intervall_von); // Parse interval from
            let intTo = parseInt(data[i].intervall_bis); // Parse interval to
            let interval = intTo - intFr; // Calculate the interval

            // Get value
            let valFr = parseInt(data[i].gebuehr_von); // Parse rate value from
            let valTo = parseInt(data[i].gebuehr_bis); // Parse rate value to
            let value = valTo - valFr; // Calculate the rate value

            let prev = 0, preIn = 0;
            if (i > 0) {
                prev = parseInt(data[i - 1].gebuehr_bis);
                preIn = parseInt(data[i - 1].intervall_bis);
            }

            // Check if fixed rate
            if (value === 0 && valFr > 0) {
                // From and to values were the same so must be fixed

                // Get the actual value
                value = valFr;

                // Since it is total cost, the actual fee might not be so big. Deduct last value if exist
                if (i > 0)
                    value -= prev;

                if (value > 0) {
                    // Add fixed value as first minute cost full rate, while rest of the block is free
                    pwt.addElementTo(rate, null, 'interval', 1); // Full cost counts only for first minute this block
                    pwt.addElementTo(rate, null, 'intervals', 1); // Full cost only valid once
                    pwt.addElementTo(rate, null, 'value', value); // Full cost for this first minute
                    pwt.addElementTo(rate, null, 'order', tariff.rates.length); // Add rate number
                    pwt.addElementTo(tariff, null, 'rates', rate); // Add rate to tariff

                    // The intervals left should then be free until next rate block
                    value = 0;

                    // Check if the rates was already properly defined or not
                    if (intFr === preIn) {
                        // Rate intervals were not properly defined
                        // Adjust interval since 1 second is taken for min fee
                        interval -= 1;
                    }

                    // The free block will be added after the if-statement
                }
            }
            // Tariff might have a pseudo minimum fee (minimum fee, but there is a gap -> free parking followed by a minimum fee)
            // Identified by value of rate block 0 is not 0
            else if (intFr !== preIn && valFr !== prev) {
                // Not actual minimum fee since there is a gap
                // Check if the gap is larger than 1
                intFr -= preIn;
                if (intFr > 1) {
                    // The gap is larger than 1 fix by adding a free block
                    pwt.addElementTo(rate, null, 'interval', intFr - 1);
                    pwt.addElementTo(rate, null, 'intervals', 1);
                    pwt.addElementTo(rate, null, 'value', 0);
                    pwt.addElementTo(rate, null, 'order', 0); // First block
                    pwt.addElementTo(tariff, null, 'rates', rate);
                }

                // Add the full cost on the new block
                rate = pwt.createObjectBase('rate');
                pwt.addElementTo(rate, null, 'interval', 1); // Similar as fixed fee, all cost is put on the first minute
                pwt.addElementTo(rate, null, 'intervals', 1); // Valid once only
                pwt.addElementTo(rate, null, 'value', valFr - prev); // Determine the start cost (difference between rate block i-1 and block i)
                pwt.addElementTo(rate, null, 'order', 1); // Second block
                pwt.addElementTo(tariff, null, 'rates', rate);
                // The rest of the rate block will be added as usual (third block)
            }
            // Tariff might begin with free parking
            // Identified by the rate block i starts at > 0 but cost starts at 0
            // Only valid for first rate
            else if (intFr !== preIn && valFr === prev) {
                pwt.addElementTo(rate, null, 'interval', intFr - preIn); // Add the free block interval
                pwt.addElementTo(rate, null, 'intervals', 1); // valid once
                pwt.addElementTo(rate, null, 'value', 0); // free
                pwt.addElementTo(rate, null, 'order', 0); // Should be the firs trate
                pwt.addElementTo(tariff, null, 'rates', rate);
            }
            // Tariff might have a minimum fee
            // Identified by the start value is > 0
            else if (valFr !== prev) {
                // if it is the first rate then it is a minimum fee as well (since no gap)
                if (i === 0)
                    pwt.addElementTo(tariff, null, 'minFee', valFr);

                // Add the minimum fee as first minute
                pwt.addElementTo(rate, null, 'interval', 1);
                pwt.addElementTo(rate, null, 'intervals', 1);
                pwt.addElementTo(rate, null, 'value', valFr - prev);
                pwt.addElementTo(rate, null, 'order', 0);
                pwt.addElementTo(tariff, null, 'rates', rate);

                // Deduct the taken minute
                interval -= 1;
            }

            // Make sure the value wont be negative because of above if statement
            if (value < 0)
                value = 0;

            // Create new rate object, if the old was hijacked
            rate = pwt.createObjectBase('rate');

            // Populate rate object and shorten the interval to be more understandable
            if (interval % 60 === 0 && value % (interval / 60) === 0) {
                // Can be expressed as an hourly rate
                pwt.addElementTo(rate, null, 'interval', 60);
                pwt.addElementTo(rate, null, 'intervals', interval / 60);
                pwt.addElementTo(rate, null, 'value', value / (interval / 60));
                //interval = 60;
            } else if (interval % 30 === 0 && value % (interval / 30) === 0) {
                // Can be expressed as a rate per half hour
                pwt.addElementTo(rate, null, 'interval', 30);
                pwt.addElementTo(rate, null, 'intervals', interval / 30);
                pwt.addElementTo(rate, null, 'value', value / (interval / 30));
                //interval = 30;
            } else if (interval % 20 === 0 && value % (interval / 20) === 0) {
                // Can be expressed as a rate per 20 min
                pwt.addElementTo(rate, null, 'interval', 20);
                pwt.addElementTo(rate, null, 'intervals', interval / 20);
                pwt.addElementTo(rate, null, 'value', value / (interval / 20));
                //interval = 20;
            } else if (interval % 15 === 0 && value % (interval / 15) === 0) {
                // Can be expressed as a rate per 15 min
                pwt.addElementTo(rate, null, 'interval', 15);
                pwt.addElementTo(rate, null, 'intervals', interval / 15);
                pwt.addElementTo(rate, null, 'value', value / (interval / 15));
                //interval = 15;
            } else if (interval % 5 === 0 && value % (interval / 5) === 0) {
                // Can be expressed as rate per 5 min
                pwt.addElementTo(rate, null, 'interval', 5);
                pwt.addElementTo(rate, null, 'intervals', interval / 5);
                pwt.addElementTo(rate, null, 'value', value / (interval / 5));
                //interval = 5;
            } else if (value % interval === 0 && value !== 0) {
                // Can be expressed as a minute rate
                pwt.addElementTo(rate, null, 'interval', 1);
                pwt.addElementTo(rate, null, 'intervals', interval);
                pwt.addElementTo(rate, null, 'value', value / interval);
                //interval = 1;
            } else {
                // Could not shorten the rate
                pwt.addElementTo(rate, null, 'interval', interval);
                pwt.addElementTo(rate, null, 'value', value);
            }

            // Add order number
            pwt.addElementTo(rate, null, 'order', tariff.rates.length);
            // Add rate to tariff
            pwt.addElementTo(tariff, null, 'rates', rate);
        }
    }

    // Get max parking time (for this format it is defined by when the last rate stops)
    let maxParkingTime = parseInt(data[data.length - 1].intervall_bis);
    pwt.addElementTo(tariff, 'restrictions', 'maxParkingTime', maxParkingTime);

    // Merge and remove duplicate rates
    tariff.rates = removeDuplicateRate(tariff.rates);

    // Fix rates to utilize repeat element
    additionalRateFix(tariff.rates, maxParkingTime);
}

/**
 * A function that merge and remove duplicate rates
 * @param rates - Collection of all rates of the tariff
 * @returns {Array} - Adjusted rates or input
 */
function removeDuplicateRate(rates) {
    if (rates.length <= 1) // Must at least be two or more rates to have anything to merge
        return rates;

    let last; // Reference to last seen rate
    let unique = []; // list containing every unique rate
    for (let i = 0; i < rates.length; i++) {

        if (last && isSimilar(last, rates[i], ['order', 'intervals'])) {
            last.intervals += rates[i].intervals;
        } else {
            unique.push(rates[i]);
            last = rates[i];
        }
    }

    return unique;
}

/**
 * Adjusts rates
 * @param rates - The rates to adjust
 * @param maxTime - Max parking time as reference
 * @returns {String} token describing type of rates
 */
function additionalRateFix(rates, maxTime) {

    // Rate might be infinitely repeated, if tariff only consist of one rate that covers max parking
    if (rates.length === 1 && rates[0].interval * rates[0].intervals >= maxTime) {
        rates[0].intervals = 1;
        rates[0].repeat = true;
        return 'LINEAR';
    }
    // Fix rates where there are more than one rate
    else if (rates.length > 1) {

    }


    return 'PROGRESSIVE';
}

function isSimilar(a, b, skip) {
    for (let k in a) {
        if (!a.hasOwnProperty(k) || skip.indexOf(k) !== -1) {
            continue;
        } else if (!b.hasOwnProperty(k)) {
            return false;
        }

        if (a[k] !== b[k])
            return false;
    }

    return true;
}

/**
 * Return random integer up to max - 1
 * @param{number} max - maximum integer to randomize
 * @returns {number}
 */
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}