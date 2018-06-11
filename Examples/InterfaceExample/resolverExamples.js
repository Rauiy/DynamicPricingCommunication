const
    converter = require('./convertToJsonExample');
    //pwt = require('./protocolWritingToolsJson');

const resolvers = {
    location: (args) => {
        console.log("Fetching locations, arguments:" + JSON.stringify(args));
        // TODO
        // First, Get all matching data rows from database
        //let data = "database get locations matching args"

        // Second, If data is not in protocol format convert to format
        //let res = converter.convertLocationData(data);


        // Last, Return result
        //return res;
    },
    occupancy: (args) => {
        console.log("Fetching occupancies, arguments:" + JSON.stringify(args));
        // TODO
        // First, Get all matching data rows from database
        //let data = "database get occupancies matching args"

        // Second, If data is not in protocol format convert to format
        //let res = converter.converOccupancyData(data); // Do not exist

        // Last, Return result
        //return res;
    },
    tariff: (args) => {
        console.log("Fetching tariffs, arguments:" + JSON.stringify(args));
        // TODO
        // First, Get all matching data rows from database
        //let data = "database get tariffs matching args"

        // Second, If data is not in protocol format convert to format
        //let res = converter.convertTariffData(data);

        // Last, Return result
        //return res;
    },
};

function initDatabase(cb){
    // TODO: init connection to database
}
module.exports = {
    resolvers: resolvers,
    initDatabase: initDatabase,
};