'use strict'

const Promise = require('bluebird')
const steem = Promise.promisifyAll(require('steem'))
const { user, wif, weight, blacklist } = require('../../config')
const moment = require('moment')
const schedule = require('node-schedule')
const bot = require('../nlp/talkify');
const setTimeoutAsync = Promise.promisify(setTimeout)

const resolve = Promise.promisify(bot.resolve);

module.exports = {
    execute
}

const REPLY_DELAY = 300000 // minutes
const POST_DELAY = 1810000 // minutes
var delay = moment()
let counter = 0
var cache = []

function in_cache(permlink) {
    return cache.filter((cachelink) => cachelink == permlink).length > 0
}


/*
 * About Rules
 * 
 *
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

function handle(sentence, comment) {
    let timeout = REPLY_DELAY
    if (comment.parent_author != '') {
        timeout = POST_DELAY
    }

    delay = delay.add(timeout, 'minutes')
    var later = delay.toDate()
    return resolve(1, sentence)
        .each((message) => {
            console.log("Rescheduling reply until ", later)
            reply(comment, message.content)
            /*
            schedule.scheduleJob(later, function() {
                var promise = reply(comment, message.content)
            })*/
            delay = delay.add(REPLY_DELAY, 'minutes')            
        })
        .catch((err) => {
            // console.log("Error resolving ", err)
        })
}

function reply(comment, message) {
    console.log("Replying to ", {author: comment.author, permlink: comment.permlink})

    var permlink = 're-' + comment.author.replace(/[\.]/, '-')
        + '-' + comment.permlink 
        + '-' + new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();

    // Check if we already put a reply on the exact same post
    return steem.api.getContentRepliesAsync(comment.author, comment.permlink).then((result) => {
        return result.filter((reply) => reply.author == user).length > 0
    }).then((result) => {
        if (result) {
            console.log("Rejecting post ")
            return Promise.reject('Duplicate post')
        }

        console.log("comment ", [wif,
            comment.author, // Leave parent author empty
            comment.permlink,
            user, // Author
            permlink, // Permlink
            permlink, // Title
            message])
        steem.broadcast.commentAsync(
            wif,
            comment.author, // Leave parent author empty
            comment.permlink,
            user, // Author
            permlink, // Permlink
            permlink, // Title
            message, // Body
            { "app": "auto-meme-steem-bot/0.1.0" }
        )
        .then((result) => {
            return steem.broadcast.commentOptionsAsync(
                    wif, 
                    user,
                    permlink,
                    "1000000.000 SBD", 10000, true, false, [])
                .then((results) => {
                    console.log("Options results ", results)
                    return results
                })
                .catch((err) => {
                    console.log("Unable to set options ", err)
                })
        })
        .then((result) => {
            return steem.broadcast.voteAsync(
                wif, 
                user, 
                comment.author,
                comment.permlink,
                weight
            )
            .then((results) =>  {
                console.log(results)
            })
            .catch((err) => {
                console.log("Vote failed: ", err)
            })
        }).catch((err) => {
            if (err.message.indexOf("STEEMIT_MIN_REPLY_INTERVAL") > -1) {
                return schedule_reply(comment, message, REPLY_DELAY)
            }
            else {
                console.log("Unable to process comment. ", err)
            }
        })
    }).catch((err) => {
        console.log("Skipping ", permlink, err)
    })
}

function is_english(sentence) {
    return sentence.indexOf(" is ") > -1
        || sentence.indexOf(" and ") > -1
        || sentence.indexOf(" or ") > -1
        || sentence.indexOf(" the ") > -1
}

function is_content_allowed(comment) {
    return steem.api.getContentAsync(comment.author, comment.permlink)
        .then((content) => {
            return is_not_resteem(content) && is_blog(content)
        })   
}

/**
 * Uses Promise.spread to prevent from making two consecutive calls to getContentAsync on the same content
 */
function is_not_resteem(content) {
    if (content.id == 0) {
        return false;
    }
    return true;
}

function is_blog(content) {
    const nonblog_tags = [ "spanish", "polish", "contest", "contests", "donation", "macrophotography", "naturephotography", "photography", "music", "poetry", "poem", "photocontest", "steemchurch", "dsound", "mondaymixtape", "life", "christianity", "christian-trail", "story", "freewrite", "writing" ]
    let metadata = {}

    if (content.json_metadata != '') {
        metadata = JSON.parse(content.json_metadata)
    }

    if (metadata.tags && metadata.tags.length > 0 && metadata.tags.filter) {
        return metadata.tags
            .filter((tag) => nonblog_tags.includes(tag)).length == 0
        
    }
    return false
}

function is_author_blacklisted(comment) {
    blacklist.filter((blacklisted) => blacklisted == comment.author).length > 0
}

function train(comment, body) {
    const sentences = body.replace(/([.?!])(?=[\s!?])(?=[\s!?a-z])(?=[\s!?a-z])/g, "$1|").split("|");
    return Promise.map(sentences, (sentence, index, length) => {
        sentence = sentence.replace(/\n/g, " ");
        if (sentence.indexOf("a parrot ") > -1
            || sentence.indexOf("the parrot ") > -1
            || sentence.indexOf("hungry") > -1
            || sentence.indexOf("hungrier") > -1
            || sentence.indexOf("hungriest") > -1) {
                
            return `> ${sentence}

![](https://steemitimages.com/DQmSdifbPzahC2RFFmpd7MY9MqrzUy34rjKhzkS522fTHDA/soon.jpg)`
        }

        if (sentence.indexOf("monday") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/0x0/https://steemitimages.com/DQmebMtRTpNPbdNLeYqqtrsCMxwVeGYs58ANS41YZ1dXVJg/mondays.jpeg)`
        }

        if (sentence.indexOf("come at me") > -1
            || sentence.indexOf("bring it") > -1
            || sentence.indexOf("fight me") > -1
            || sentence.indexOf("fight with me") > -1
            || sentence.indexOf("argue with me") > -1
            || sentence.indexOf("debate me") > -1
            || sentence.indexOf("debate with me") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/DQmUSaniT7yoGFqM7zCjUSZPvo1dUXZ7txGTXnZbpZFUgKv/comeatmebro.gif)`
        }

        // console.log("Checking for ", sentence)
        if (sentence.indexOf("shock") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/0x0/https://steemitimages.com/DQmSRdJf6PfTRu7r3oqyywzgpVcxzMwY4dPQgaWh17qUjCg/mildshock.gif)`
        }

        if (sentence.indexOf("puzzle") > -1
            || sentence.indexOf("rubix") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/0x0/https://steemitimages.com/DQmWb1B3Tiu9ZVQgMGNFPvy1wh26chCr5bhUAFRKsAF7ixG/easy.gif)`
        }

        if (sentence.indexOf("facepalm") > -1
            || sentence.indexOf("face palm") > -1
            || sentence.indexOf("face-palm") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/DQmcEN577GiBqehZ7aa5woXL7vj72f7ZcM3iiwWbh7RVhUR/image.png)`
        }

        if (sentence.indexOf("ohno") > -1
            || sentence.indexOf("oh no") > -1
            || sentence.indexOf("noooo") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/DQmewZPadmQ5dP8EWC2JLwMkHMMLcdD4tX2NcstUDqCBeGP/ohnoes.gif)`
        }

        if (sentence.indexOf("with-fire") > -1
            || sentence.indexOf("with fire") > -1
            || sentence.indexOf("withfire") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/DQmVRGZ6dAytVhcr4pTRdFnSnxj2J3tnhJJhrFFPTfWVYon/burningman.gif)`
        }
        

        if (sentence.indexOf("sleepy") > -1
            || sentence.indexOf("yawn") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/DQmTpAqe15wT6vZwGKPJnHR6HNyw2sW2RZa7RvbaZg8cPeM/kittyyawn.gif)`
        }
        
        
        if (sentence.indexOf("stormtrooper") > -1
            || sentence.indexOf("storm trooper") > -1
            || sentence.indexOf("storm-trooper") > -1
            || sentence.indexOf("darkside") > -1
            || sentence.indexOf("dark-side") > -1
            || sentence.indexOf("dark side") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/DQmcEN577GiBqehZ7aa5woXL7vj72f7ZcM3iiwWbh7RVhUR/image.png)`
        }

        if (sentence.indexOf("nailed it") > -1
            || sentence.indexOf("stuck the landing") > -1
            || sentence.indexOf("stuck it") > -1
            || sentence.indexOf("great success") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/DQmPMiZBzePcFiirBCQoDP1PzELK2K9etJSU7RTMvhQNvtW/huge.gif)`
        }
        
        if (sentence.indexOf("nope") > -1
            || sentence.indexOf("uh uh") > -1
            || sentence.indexOf("no no ") > -1
            || sentence.indexOf("no no.") > -1
            || sentence.indexOf("no no,") > -1
            || sentence.indexOf("no no!") > -1
            || sentence.indexOf("unacceptable") > -1
            || sentence.indexOf("no thank you") > -1
            || sentence.indexOf("no thankyou") > -1
            || sentence.indexOf("not at all") > -1
            || sentence.indexOf("never ever") > -1
            || sentence.indexOf("never never") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/0x0/https://steemitimages.com/DQmebWy28k2K6qrzfDEGmei2QL87W748gf4x4LgwPe4oixC/spongebobno.gif)`
        }

        if (sentence.indexOf("omg") > -1
            || sentence.indexOf("omfg") > -1
            || sentence.indexOf("gtfo") > -1
            || sentence.indexOf("shut the f") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/0x0/https://steemitimages.com/DQmbRfuLUQvqJpVezXMtdPqDBasxoXCcffTNcMG3KfWYdTv/kittyshocked.gif)`
        }
        
        if (sentence.indexOf(" rage") > -1
            || sentence.indexOf("frustrat") > -1
            || sentence.indexOf(" anger") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/0x0/https://steemitimages.com/DQmVuoC9KqWe9Lm2ZhNVBat9yio7VWZMDFgtovdSLcJrX7D/buttonmash.gif)`
        }

        if (sentence.indexOf("benadryl") > -1
            || sentence.indexOf("drug") > -1
            || sentence.indexOf("narcotic") > -1
            || sentence.indexOf("pills") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/0x0/https://steemitimages.com/DQmdtPzkWkVMM4wzyeevi5b4wcHJUrDcurvghfF3eYX9Hvr/benadryl.png)`
        }

        if (sentence.indexOf("avenge") > -1
            || sentence.indexOf("toothbrush") > -1
            || sentence.indexOf("wash hand") > -1
            || sentence.indexOf("wash up") > -1
            || sentence.indexOf("wash-up") > -1
            || sentence.indexOf("restroom") > -1
            || sentence.indexOf("bathroom") > -1
            || sentence.indexOf("washroom") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/DQme5t81e8aYmUfHF4CxaNq7XAw7AUmr9CCYePQUhWRiUTK/avengers.gif)`
        }
                
        if (sentence.indexOf("happy birthday") > -1
            || sentence.indexOf("it's my birthday") > -1
            || sentence.indexOf("it is my birthday") > -1
            || sentence.indexOf("today is my birthday") > -1
            || sentence.indexOf("my birthday is today") > -1
            || sentence.indexOf("tomorrow is my birthday") > -1
            || sentence.indexOf("my birthday is tomorrow") > -1
            || sentence.indexOf("yesterday was my birthday") > -1
            || sentence.indexOf("my birthday was tomorrow") > -1
            || sentence.indexOf("belated birthday") > -1) {
            return `> ${sentence}

![](https://steemitimages.com/0x0/https://steemitimages.com/DQmcEJYJP4CuCmSM6JtkfzYDbjm6PajWyGRhsUjsKDRSAfF/giphy%20(1).gif)`
        }

        return -1
    })
    .filter((response) => response != -1)
    .each((response) => {
        let timeout = REPLY_DELAY
        if (comment.parent_author != '') {
            timeout = POST_DELAY
        }
    
        return schedule_reply(comment, response, timeout)
    })
}

function schedule_reply(comment, response, timeout) {
    console.log("Reschduling reply for ", timeout)
    return setTimeout(() => { 
        reply(comment, response)
    }, timeout)
}

function process(comment) {
    const body = comment.body.replace(/<(?:.|\n)*?>/gm, '').replace(/http[^\s]+\s/gm, '');
    return Promise.filter([ body ], (sentence, index, length) => {
            return is_english(sentence);
        })
        .map((sentence) => {
            return sentence.toLowerCase();
        })
        .filter((sentence) => comment.author != user)
        .filter((sentence) => (!is_author_blacklisted(comment)))
        .filter((sentence) => is_content_allowed(comment))
        .then((sentences) => {
            // return handle(sentences.pop(), comment)
            if (sentences.length > 0) {
                return train(comment, sentences[0])
            }
        })
        .catch((err) => {
            console.log("problems processing: ", err)
        })
}

function execute() {
    steem.api.streamOperations('head', (err, result) => {
        if (counter % 1000 == 0) {
            counter = 0
            console.log("Processing %s on %s", result, new Date())
        }

        if (err) {
            console.log("Unable to stream operations %s", err)

            execute();
        }

        Promise.all(result).spread((operation_name, operation) => {
            switch(operation_name) {
                case 'comment':
                    return Promise.resolve(operation);
                    break;
                default:
                    return Promise.reject(operation)
                    break;
            }   
        })
        .then((operation) => process(new Comment(operation)))
        .catch((exception) => {
            // console.log("Not supported operation", exception)
        })
        counter++;
    })
}