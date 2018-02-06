'use strict'

const scheduler = require('node-schedule')
const EVERY_20_SECONDS = '* * * * * *'


module.exports = {
    run
}

function run() {
    // scheduler.scheduleJob(EVERY_20_SECONDS, require('./reply'))
    var reply_task = require('./reply')
    new Promise((resolve, reject) => {
        var retval = reply_task.execute()
        
    })
}