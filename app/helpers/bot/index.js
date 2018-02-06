'use strict'

const scheduler = require('node-schedule')
const EVERY_20_SECONDS = '* * * * * *'


module.exports = {
    run
}

function run() {
    // scheduler.scheduleJob(EVERY_20_SECONDS, require('./reply'))
    require('./reply').execute()
}