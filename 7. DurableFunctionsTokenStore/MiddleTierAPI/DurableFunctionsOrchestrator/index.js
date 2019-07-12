/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by an HTTP starter function.
 */

const df = require("durable-functions");
const moment = require("moment");
const config = require("../config");

module.exports = df.orchestrator(function* (context) {
    const outputs = [];
    const userOID = context.bindingData.input;
    const { durableFunc } = config;

    // create delay
    const deadline = moment.utc(context.df.currentUtcDateTime).add(30, 's');
    yield context.df.createTimer(deadline.toDate());
    
    outputs.push(yield context.df.callActivity(durableFunc.activityFuncName, userOID));

    return outputs;
});