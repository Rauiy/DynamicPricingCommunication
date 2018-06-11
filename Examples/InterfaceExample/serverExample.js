const express = require('express');
const graphqlHTTP = require('express-graphql');
const { buildSchema } = require('graphql');
const fs = require('fs');
const resolvers = require('./resolverExamples.js');
const compression = require('compression');

let schema;

let root;
let app = express();
app.use(compression());

// Load schema
fs.readFile('../../FormatSchema/formatSchema.graphql' , 'utf8', function(err, data){
    if(err) throw err;

    schema = buildSchema(data);
    initServer();
});

function initServer() {

    // TODO: set up connection with database and build server
    resolvers.initDatabase(function(err, data){
        if(err) throw err;

        // Set-up resolvers
        root = resolvers.resolvers;
        console.log(data);

        // Init express server with graphql
        app.use('/graphql', graphqlHTTP({
            schema: schema,
            rootValue: root,
            graphiql: true,
        }));

        // Start server
        app.listen(4000, () => console.log('Now browse to localhost:4000/graphql'));

    });
}
