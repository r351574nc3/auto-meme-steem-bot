'use strict'

const Promise = require('bluebird')
const steem = Promise.promisifyAll(require('steem'))
const config = require('../../config')
const sleep = require('sleep')


module.exports = {
    execute
}

var cache = []

function in_cache(permlink) {
    return cache.filter((cachelink) => cachelink == permlink).length > 0
}


class Handler {
    constructor(handlerdef) {
        this.criteria = handlerdef.test
        this.meme = handlerdef.meme
    }

    test(comment) {
        var retval = -1
        this.criteria.some((match) => { 
            var check = comment.indexOf(' ' + match)
            if (check > -1) {
                retval = check
                return true
            }
            return false
        })
        return retval
    }

    excerpt(comment) {
        var index = this.test(comment.toLowerCase())
        var endidx = comment.indexOf(' ', index + 1)

        if (endidx < 0) {
            endidx = comment.length
        }

        if (index > 30) {
            var startidx = comment.indexOf(' ', index - 30)
            return comment.substring(startidx, endidx)
        }
        return comment.substring(0, endidx)
    }

    response(comment) {
        var excerpt = this.excerpt(comment)
        var message = "> " + excerpt + "\n\n"
            + "![](" + this.meme + ")"
        return message
    }
}

const defaults = {
    reply_map: [
        new Handler({ test: [ 'hungry', 'parrot' ],
            meme: 'https://steemitimages.com/DQmSdifbPzahC2RFFmpd7MY9MqrzUy34rjKhzkS522fTHDA/soon.jpg' }),
        new Handler({ test: [ 'nope' ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmebWy28k2K6qrzfDEGmei2QL87W748gf4x4LgwPe4oixC/spongebobno.gif' }), 
        new Handler({ test: [ 'benadryl', 'drug', 'narcotic' ], 
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmdtPzkWkVMM4wzyeevi5b4wcHJUrDcurvghfF3eYX9Hvr/benadryl.png' }), 
        new Handler({ test: [ 'monday' ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmebMtRTpNPbdNLeYqqtrsCMxwVeGYs58ANS41YZ1dXVJg/mondays.jpeg' }), 
        new Handler({ test: [ 'sleepy', 'yawn' ],
            meme: 'https://steemitimages.com/DQmTpAqe15wT6vZwGKPJnHR6HNyw2sW2RZa7RvbaZg8cPeM/kittyyawn.gif' }), 
        new Handler({ test: [ 'oh no', 'ohno', 'nooo' ],
            meme: 'https://steemitimages.com/DQmewZPadmQ5dP8EWC2JLwMkHMMLcdD4tX2NcstUDqCBeGP/ohnoes.gif' }), 
        new Handler({ test: [ 'mindblow', 'mind blow', 'mind-blow' ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmWKyX1knyGQp546ovy3wduYh4PLm9mu9dPMDTCmrsZheZ/kramermindblown.gif' }), 
        new Handler({ test: [ 'stormtrooper', 'storm trooper' ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmaNgiCGS3BcPLLDTABEMZahZitP6yKD3sG1JtYYHEje5q/dancingstormtroopers.gif' }), 
        new Handler({ test: [ 'avenge', 'toothbrush', 'bathroom', 'wash up', 'wash-up', 'wash hands', 'washroom', 'restroom' ],
            meme: 'https://steemitimages.com/DQme5t81e8aYmUfHF4CxaNq7XAw7AUmr9CCYePQUhWRiUTK/avengers.gif' }), 
        new Handler({ test: [ 'shock' ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmSRdJf6PfTRu7r3oqyywzgpVcxzMwY4dPQgaWh17qUjCg/mildshock.gif' }), 
        new Handler({ test: [ 'omg', 'omfg', 'gtfo', 'shut the front door', 'shut the frontdoor', 'my goodness', 'no way', "i don't believe" ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmbRfuLUQvqJpVezXMtdPqDBasxoXCcffTNcMG3KfWYdTv/kittyshocked.gif' }), 
        new Handler({ test: [ 'with fire' ],
            meme: 'https://steemitimages.com/DQmVRGZ6dAytVhcr4pTRdFnSnxj2J3tnhJJhrFFPTfWVYon/burningman.gif' }),
        new Handler({ test: [ 'happy birthday', "it's my birthday" ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmcEJYJP4CuCmSM6JtkfzYDbjm6PajWyGRhsUjsKDRSAfF/giphy%20(1).gif'}),
        new Handler({ test: [ 'facepalm', 'face palm', 'face-palm'],
            meme: 'https://steemitimages.com/DQmcEN577GiBqehZ7aa5woXL7vj72f7ZcM3iiwWbh7RVhUR/image.png' }),
        new Handler({ test: [ 'rage', 'frustration', 'frustrated', 'anger' ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmVuoC9KqWe9Lm2ZhNVBat9yio7VWZMDFgtovdSLcJrX7D/buttonmash.gif'}),
        new Handler({ test: [ 'challenge' ], 
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmTTXAf2n9W3x1nmSNuhx3jTDWDXPnUUfSGjKnTbh4c7Ma/giphy%20(2).gif' }),
        new Handler({ test: [ 'come at me', 'bring it', 'fight with me', 'argue with me' ],
            meme: 'https://steemitimages.com/DQmUSaniT7yoGFqM7zCjUSZPvo1dUXZ7txGTXnZbpZFUgKv/comeatmebro.gif' }),
        new Handler({ test: [ 'nailed it', 'stuck the landing', 'stuck it', 'great success' ],
            meme: 'https://steemitimages.com/DQmPMiZBzePcFiirBCQoDP1PzELK2K9etJSU7RTMvhQNvtW/huge.gif' }),
        new Handler({ test: [ 'rubix', 'puzzle' ],
            meme: 'https://steemitimages.com/0x0/https://steemitimages.com/DQmWb1B3Tiu9ZVQgMGNFPvy1wh26chCr5bhUAFRKsAF7ixG/easy.gif' })
    ]
}
/*
        new Handler({ test: [ 'thankyou', "thank you", 'gracias', 'thanks', 'danke' ],
            meme: 'https://steemitimages.com/DQmPtCFmLkJpNFWBZsZrGqhHiu3ni53hwzMrcq77akGTLaC/welcome.jpg'}),

            */
            
class Parent {
    constructor(comment_json) {
        this.author = comment_json.parent_author
        this.permlink = comment_json.parent_permlink
    }
}

class Comment {
    constructor(comment_json) {
        this.parent = new Parent(comment_json)
        this.title = comment_json.title
        this.author = comment_json.author
        this.permlink = comment_json.permlink
        this.body = comment_json.body
        this.url = this.reconstruct_url(comment_json)
    }

    reconstruct_url(comment) {
        var prefix = 'https://www.steemit.com'

        // get first tag
        if (comment.parent_author != '') {
            prefix = prefix + '/@' + comment.parent_author
        }
        else {
            prefix = prefix + '/@' + comment.author
        }

        if (comment.parent_permlink != '') {
            prefix = prefix + '/' + comment.parent_permlink
        }
        else {
            prefix = prefix + '/' + comment.permlink
        }
        return prefix
    }

    is_reply() {
        return this.parent.permlink != '' && this.title == ''
    }
}

function handle(comment, handler) {
    var permlink = 're-' + comment.author 
        + '-' + comment.permlink 
        + '-' + new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
    var user = config.user
    var wif = config.wif 

    if (in_cache(comment.permlink)) {
        return
    }

    if (cache.length > 200) {
        cache = []
    }

    cache.push(comment.permlink)

    // sleep.sleep(1)
    // Check if we already put a reply on the exact same post
    steem.api.getContentRepliesAsync(comment.author, comment.permlink).then((result) => {
        return result.filter((reply) => reply.author == user).length > 0
    }).then((result) => {
        if (result) {
            console.log("Rejecting post ")
            return Promise.reject('Duplicate post')
        }

        console.log("parent: ", comment.parent)
        console.log("author: ", comment.author)
        console.log("permlink: ", comment.permlink)
        console.log("newlink: ", permlink)
        steem.broadcast.commentAsync(
            wif,
            comment.author, // Leave parent author empty
            comment.permlink,
            user, // Author
            permlink, // Permlink
            permlink, // Title
            handler.response(comment.body), // Body
            { "app": "auto-meme-steem-bot/0.1.0" }
        ).then((result) => {
            console.log(result)
            sleep.sleep(120)
        }).catch((err) => {
            console.log("Unable to process comment. ", err)
            console.log("Bad comment: ", comment)
        })
    }).catch((err) => {
        console.log("Skipping ", permlink, err)
    })
}


function process(comment) {
    defaults.reply_map
        .filter((handler) => handler.test(comment.body.toLowerCase()) > -1 && comment.author != config.user)
        .forEach((handler) => handle(comment, handler))
}

function execute() {
    steem.api.streamOperations('head', (err, result) => {
        var user = config.user
        if (result && result.length > 0) {
            var operation_name = result[0]
            if (operation_name === 'comment') {
                var comment = new Comment(result[1])
                process(comment)
            }   
        }
    })
}