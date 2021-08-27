import { Injectable, Logger } from '@nestjs/common';
import { HiveService } from './hive.service';
import { SteemService } from './steem.service';
import { config } from './config';
import * as Promise from 'bluebird';
import * as moment from 'moment';
import * as fs from 'fs';
import * as bot from 'talkify';
import * as removeMd from 'remove-markdown'


const voting_queue = [];
const ONE_SECOND = 1000
const FIVE_SECONDS = 5000
const THREE_MINUTES = 150000
const TWO_MINUTES = 120000
const SIX_MINUTES = 360000
const TEN_MINUTES = 600000
const FIFTEEN_MINUTES = 898000
const THIRTY_MINUTES = 1800000

const follow = [
    "frontrunner",
    "sahra-bot"
]

const communities = {
    "hive-140217": "Hive Gaming",
    "hive-156509": "OnChainArt"
}

const allowed_tags = [
    "callofdutywarzone",
    "hive-140217",
    "task-development",
    "task-graphics",
    "task-bug-hunting",
    "task-social",
    "task-analysis",
    "task-documentation",
    "task-copywriting",
    "ideas",
    "blog",
    "tutorials",
    "video-tutorials",
    "graphics",
    "development",
    "bug-hunting",
    "analysis",
    "social",
    "documentation",
    "copywriting"
]

const instant_voters = [
]

const voting = {
    length: () => { return voting_queue.length },
    push: (obj) => { return voting_queue.push(obj) },
    pop: () => { return voting_queue.pop() },
    shift: () => { return voting_queue.shift() },
    unshift: (obj) => { return voting_queue.unshift(obj) }
}

const feed = {
    entries: {},
    min: 0.0,
    max: 0.0,
    avg: 0.0
}


class Parent {
    author: string
    permlink: string

    constructor(comment_json) {
        this.author = comment_json.parent_author
        this.permlink = comment_json.parent_permlink
    }
}

class Comment {
    protected parent: Parent
    protected title: string
    protected author: string
    protected permlink: string
    protected body: string
    protected url: string
    
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

interface ContentMetadata {
    tags: string[]
}

interface Author {
    name: string
    wif: string
    weight: string
}

class ReplyQueue {
    private reply_queue: any[]
    constructor() {
        this.reply_queue = []
    }
    length() { return this.reply_queue.length }
    push(obj) { return this.reply_queue.push(obj) }
    pop() { return this.reply_queue.pop() }
    shift() { return this.reply_queue.shift() }
    unshift(obj) { return this.reply_queue.unshift(obj) }
    contains(obj) { 
        return this.reply_queue.filter((reply) => {
            return obj.comment.author !== reply.comment.author
                && obj.comment.permlink !== reply.comment.permlink
        }).length > 0
    }
    isAtCapacity() { return this.reply_queue.length >= config.queue_capacity}
    remove(obj) {
        const index_pos = this.reply_queue.indexOf(obj)
        if (index_pos > -1) {
            return this.reply_queue.splice(index_pos, 1)
        }
    }
}
@Injectable()
export class ReplyService {
    private hiveService: HiveService;
    private steemService: SteemService;
    private author:Author
    private queue: ReplyQueue

    constructor(hiveService: HiveService,
            steemService: SteemService) {
        this.hiveService = hiveService;
        this.steemService = steemService;
        this.author = this.load_author()
        this.queue = new ReplyQueue()
    }

    api() {
        return config.steemEnabled ? this.steemService : this.hiveService;
    }

    url_to_post(url) {
        return new Promise((resolve, reject) => {
            if (!url.startsWith("https")) {
                return reject("Not a valid url")
            }
            if (url.indexOf("#") > -1) { // ignore comments
                return reject("Comments and replies are invalid")
            }
            if (url.indexOf('@') < 0) { // invalid path
                return reject("No author in path")
            }
            const path = url.split("@")[1] // there should only be one of these
            return resolve(path.split("/")) // valid url @author/permlink
        })
    }

    hasTag(comment, tag) {
    }

    is_english(sentence) {
        return sentence.indexOf(" is ") > -1
            || sentence.indexOf(" and ") > -1
            || sentence.indexOf(" or ") > -1
            || sentence.indexOf(" the ") > -1
    }
    
    is_content_allowed(comment) {
        return this.api().getContent(comment.author, comment.permlink)
            .then((content) => {
                return this.is_not_resteem(content) && this.is_blog(content)
            })   
    }
    
    /**
     * Uses Promise.spread to prevent from making two consecutive calls to getContentAsync on the same content
     */
    is_not_resteem(content) {
        if (content.id == 0) {
            return false;
        }
        return true;
    }

    is_blog(content) {
        const nonblog_tags = [ 
            "spanish", "deutsch", "polish", "contest", "contests", "donation", "macrophotography", 
            "naturephotography", "photography", "music", "poetry", "poem", "photocontest", 
            "steemchurch", "dsound", "mondaymixtape", "life", "christianity", "christian-trail", "story", "freewrite", "writing",
        ]
        /* Maybe ignore these
                    "zzan",
            "dlike",
            "steemhunt",
        */
        let metadata = {} as ContentMetadata
    
        if (content.json_metadata != '') {
            metadata = JSON.parse(content.json_metadata)
        }
    
        if (metadata.tags && metadata.tags.length > 0 && metadata.tags.filter) {
            return metadata.tags
                .filter((tag) => nonblog_tags.includes(tag)).length == 0
            
        }
        return false
    }
    
    is_author_blacklisted(comment): boolean {
        return config.blacklist.filter((blacklisted) => blacklisted == comment.author).length > 0
    }

    processComment(comment) {
        const body = removeMd(comment.body)
            .replace(/<(?:.|\n)*?>/gm, '')
            .replace(/http[^\s]+\s/gm, '')
        return Promise.filter([ body ], (sentence, index, length) => {
                return this.is_english(sentence);
            })
            .map((sentence) => {
                return sentence.toLowerCase();
            })
            .filter((sentence) => comment.author != config.user)
            .filter((sentence) => (!this.is_author_blacklisted(comment)))
            .filter((sentence) => this.is_content_allowed(comment))
            .then((sentences) => {
                // return handle(sentences.pop(), comment)
                if (sentences.length > 0) {
                    return this.train(comment, sentences[0])
                }
            })
            .catch((err) => {
                console.log("problems processing: ", err)
            })
    }

    list_voters(author, permlink) {
        const buffer = fs.readFileSync(process.env.CONFIG_DIR + "/voters.json").toString();
        const voters = JSON.parse(buffer)
        return Promise.filter(voters, (voter, index, length) => {
            if (!(author && permlink)) {
                return true
            }
            const results = this.api().getActiveVotes(author, permlink)

            // Filter promises by checking if the voter name is among the active voters
            return this.api().getActiveVotes(author, permlink)
                .map((vote) => vote.voter)
                .then((target) => {
                    return !target.includes(voter.name)
                })
        })
    }

    list_whitelist() {
        const buffer = fs.readFileSync(process.env.CONFIG_DIR + "/whitelist.json")
        const retval = JSON.parse(buffer.toString());
        return Promise.resolve(retval)
    }

    list_blacklist() {
        return Promise.all(config.blacklist)
    }

    vote(post) {
        if (!post) {
            return Promise.reject(`Invalid post ${JSON.stringify(post)}`)
        }

        return this.list_blacklist()
            .filter((member) => member === post.author)
            .then((blacklist) => {
                Logger.log(`Checking if ${post.author} in blacklist`)
                if (blacklist.length > 0) {
                    return []
                }

                return this.list_voters(post.author, post.permlink)
            })
            .filter((voter) => (!post.whitelisted || !voter.skip_whitelist))
            .map((voter) => {
                const upvote_weight = post.weight ? post.weight : voter.weight
                Logger.log(`${voter.name} upvoting ${JSON.stringify(post)}, weight: ${upvote_weight}`)
                return this.api().vote(voter.wif, voter.name, post.author, post.permlink, upvote_weight)
                    .then((results) => {
                        Logger.log("Vote results ", JSON.stringify(results))
                        return results;
                    })
                    .catch((err) => {
                        Logger.error("Voting error ", JSON.stringify(err))
                        if (err.payload.indexOf("STEEMIT_MIN_VOTE_INTERVAL_SEC") > -1) {
                            setTimeout(() => {
                                this.vote(post)
                            }, ONE_SECOND)                        }
                    })
            })
    }

    load_author(): Author {
        const buffer = fs.readFileSync(process.env.CONFIG_DIR + "/reply.json").toString();
        const author = JSON.parse(buffer)
        const retval = {
            name: author.name,
            wif: author.wif,
            weight: author.weight
        } as Author
        return retval
    }

    train(comment, body) {
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

            if (sentence.indexOf(" wow ") > -1
                || sentence.indexOf("amaze") > -1
                || sentence.indexOf("amazing") > -1) {
                return `> ${sentence}

![](https://steemitimages.com/p/RGgukq5E6HBM2jscGd4Sszpv94XxHH2uqxMY9z21vaqHt4gBsAYe24mgf78A5JP1wnKcfAsfnqGXxAP8CsjsfmP7hUWecay1k7S3Dv8EktAYyoUiYmqDWbrYASaDz1K?format=match&mode=fit)`
            }

            if (sentence.indexOf("big fruit") > -1
                || sentence.indexOf("deep root") > -1
                || sentence.indexOf("big balls") > -1
                || sentence.indexOf("giant balls") > -1
                || sentence.indexOf("enormous balls") > -1
                || sentence.indexOf("testicles") > -1
                || sentence.indexOf("huge balls") > -1) {
                return `> ${sentence}

![](https://steemitimages.com/p/HNWT6DgoBc14riaEeLCzGYopkqYBKxpGKqfNWfgr368M9UowcCRyH8gcSixiH5egfwu7T4Rh4LSP9FaMtcuQiCydjgqkwgiRjHvkAmVT1KCarpPVKHmvSRphbp9?format=match&mode=fit)`
            }   

            if (sentence.indexOf("fixed it") > -1
                || sentence.indexOf("fix it") > -1) {
                return `> ${sentence}

![](https://steemitimages.com/p/4i88GgaV8qiFU89taP2MgKXzwntUGAvkoQiKU7VxyD37q9FfkXRmza8i4BGz9rhzfHcytcvqSnc6m8nTz76ZuNbkKqZuiCfeHmQe142nDa3TVZ4g6ycYDUiXs3?format=match&mode=fit)`
            }   

            if (sentence.indexOf("hodl") > -1
                || sentence.indexOf("made of money") > -1
                || sentence.indexOf("dive in") > -1) {
                return `> ${sentence}

![](https://steemitimages.com/p/qjrE4yyfw5pEPvDbJDzhdNXM7mjt1tbr2kM3X28F6SraZjPqF1NVUJQrWeMo9X58edGHmmnSENFMg1cMgmXZCCLT6MeJSQSPxMoYDuMeNdHimNU2HE3LU6SZ?format=match&mode=fit)`
            }   

            if (sentence.indexOf("it's fine") > -1
                || sentence.indexOf("everything is fine") > -1
                || sentence.indexOf(" is fine") > -1
                || sentence.indexOf(" that's fine") > -1
                || sentence.indexOf("nothing is wrong") > -1
                || sentence.indexOf("everything is ok") > -1) {
                return `> ${sentence}

![](https://steemitimages.com/p/3W72119s5BjVs3Hye1oHX44R9EcpQD5C9xXzj68nJaq3CeGDyfpobdH2eBwMoRpT5LZeFqP9zBk6BWYL44BvvrnhFiXhR1JryEKJTCsHYFrsnzBhjFcN4m?format=match&mode=fit)`
            }   

            if (sentence.indexOf("unstoppable") > -1
                || sentence.indexOf("don't stop") > -1
                || sentence.indexOf("never stop") > -1
                || sentence.indexOf("keep going") > -1
                || sentence.indexOf("won't stop") > -1
                || sentence.indexOf("will not be stop") > -1
                || sentence.indexOf("cannot be stop") > -1
                || sentence.indexOf("can't stop") > -1
                || sentence.indexOf("cannot stop") > -1) {
                return `> ${sentence}

![](https://steemitimages.com/p/3W72119s5BjVs3Hye1oHX44R9EcpQD5C9xXzj68nJaq3CeGDyfpobdH2eBwMoRpT5LZeFqP9zBk6BWYL44BvvrnhFiXhR1JryEKJTCsHYFrsnzBhjFcN4m?format=match&mode=fit)`
        }   

            return -1
        })
        .filter((response) => response != -1)
        .each((response) => {
            let timeout = config.reply_delay
            if (comment.parent_author == '') {
                timeout = config.post_delay
            }
        
            return this.schedule_reply(comment, response, timeout)
        })
    }
    
    reply(comment, message) {
        Logger.log(`Replying to ${JSON.stringify({author: comment.author, permlink: comment.permlink})}`)
    
        var permlink = 're-' + comment.author.replace(/[\.]/, '-')
            + '-' + comment.permlink 
            + '-' + new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
    
        // Check if we already put a reply on the exact same post
        return this.api().getContentReplies(comment.author, comment.permlink).then((result) => {
            return result.filter((reply) => reply.author == config.user).length > 0
        }).then((result) => {
            if (result) {
                Logger.log("Rejecting post ")
                return Promise.reject('Duplicate post')
            }
    
            Logger.log(`comment ${[this.author.wif,
                comment.author, // Leave parent author empty
                comment.permlink,
                this.author.name, // Author
                permlink, // Permlink
                permlink, // Title
                message]}`)
            this.api().comment(
                this.author.wif,
                {
                    parent_author: comment.author, // Leave parent author empty
                    parent_permlink: comment.permlink,
                    author: this.author.name, // Author
                    permlink: permlink, // Permlink
                    title: permlink, // Title
                    body: message, // Body
                    json_metadata: ""
                }
            )
            .then((result) => {
                // We replied successfully, please remove the item from the queue
                this.queue.remove({comment, message})

                const age_in_seconds = moment().utc().local().diff(moment(comment.created).utc().local(), 'seconds')
                const wait_time = (TWO_MINUTES - (age_in_seconds * 1000)) > 0 ? 
                        (TWO_MINUTES - (age_in_seconds * 1000)) : 0
                console.log(`Queueing for ${wait_time} milliseconds`)
                setTimeout(() => {
                    this.vote(
                        {
                            author: comment.author,
                            permlink: comment.permlink,
                            weight: this.author.weight,
                        }
                    )
                }, wait_time)
            }).catch((err) => {
                if (err.message.indexOf("STEEMIT_MIN_REPLY_INTERVAL") > -1) {
                    return this.schedule_reply(comment, message, config.reply_delay)
                }
                else {
                    Logger.error("Unable to process comment. ", err)
                }
            })
        }).catch((err) => {
            Logger.error("Skipping ", permlink, err)
        })
    }

    schedule_reply(comment, response, timeout) {
        Logger.log("Rescheduling reply for ", timeout)
        if (this.queue.contains({ comment, response })
            || this.queue.isAtCapacity()) {
            Logger.warn("Reply already in queue or the queue is at capacity. Skipping...")
            return
        }
        return setTimeout(() => { 
            this.reply(comment, response)
        }, timeout)
    }

    run() {
        const permlink =  Math.random().toString(36).substring(7)
        Logger.log("Got here")
        this.api().getParentOf('r351574nc3', 'https://steemit.com/hive-175254/@r351574nc3/re-tfame3865-re-sumit71428-qo652q-20210207t171656118z')

        Logger.log("Streaming started")
        const retval = this.api().streamOperations(
            (results) => {
                return Promise.resolve(results.op).spread((operation_name, operation) => {
                    switch (operation_name) {
                        case 'comment':
                            return this.processComment(operation)
                                .catch((err) => {
                                    Logger.error("Unable to process comment because ", err)
                                })
                        default:
                            break;
                    }
                })
                    .catch((err) => {
                        Logger.error("Bot died. Restarting ... ", err)
                    })
            },
            (error) => {
                Logger.error(`Failed ${JSON.stringify(error)}`)
                this.run()
            })
    }
}
