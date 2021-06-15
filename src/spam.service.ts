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
const THREE_MINUTES = 180000
const TWO_MINUTES = 120000
const SIX_MINUTES = 360000
const TEN_MINUTES = 600000
const FIFTEEN_MINUTES = 898000
const THIRTY_MINUTES = 1800000
const SECONDS_PER_HOUR = 3600
const PERCENT_PER_DAY = 20
const HOURS_PER_DAY = 24
const MAX_VOTING_POWER = 10000
const DAYS_TO_100_PERCENT = 100 / PERCENT_PER_DAY
const SECONDS_FOR_100_PERCENT = DAYS_TO_100_PERCENT * HOURS_PER_DAY * SECONDS_PER_HOUR
const RECOVERY_RATE = MAX_VOTING_POWER / SECONDS_FOR_100_PERCENT
const DEFAULT_THRESHOLD = 9500
const ONE_HOUR = 3600000
const SIX_HOUR = ONE_HOUR * 6
const ONE_DAY = 86400
const ONE_WEEK = ONE_DAY * 7
const ONE_MONTH = ONE_DAY * 30
const SIX_MONTH = ONE_MONTH * 6
const ONE_YEAR = ONE_MONTH * 12
const MAX_VOTE = 10000

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    protected reply_queue: any[]
    protected last_pop: Date
    constructor() {
        this.reply_queue = []
    }
    length() { return this.reply_queue.length }
    push(obj) { return this.reply_queue.push(obj) }
    pop() {
        this.last_pop = new Date()
        return this.reply_queue.pop() 
    }
    shift() { return this.reply_queue.shift() }
    unshift(obj) { 
        this.last_pop = new Date()
        return this.reply_queue.unshift(obj)
    }
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
export class SpamService {
    private hiveService: HiveService;
    private steemService: SteemService;
    private author:Author
    private queue: ReplyQueue
    private last_reply_time: Date

    constructor(hiveService: HiveService,
            steemService: SteemService) {
        this.hiveService = hiveService;
        this.steemService = steemService;
        this.author = this.load_author()
        this.queue = new ReplyQueue()
        this.last_reply_time = moment().add(3, 'm').toDate()
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
        //    .filter((sentence) => sentence.indexOf("WWW.QOO10.COM") > -1 || sentence === "<")
        /*
                    .then((sentences) => {
                return this.is_content_allowed(comment)
            })
            */
        return Promise.filter([ body ], (sentence, index, length) => {
                return comment.author != config.user
            })
            .map((sentence) => {
                return sentence.toLowerCase();
            })
            .then((sentence) => {
                return !this.is_author_blacklisted(comment)
            })
            .then((allowed) => {
                return allowed && this.spammers().filter((spammer) => comment.author === spammer.name).length > 0
            })
            .then((allowed) => {    
                if (allowed) {
                    return this.spam(comment, body.toLowerCase())
                }
            })
            .catch((err) => {
                Logger.error(`problems processing: ${JSON.stringify(err)}`, err)
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

    load_author(): Author {
        const buffer = fs.readFileSync(process.env.CONFIG_DIR + "/spam.json").toString();
        const author = JSON.parse(buffer)
        const retval = {
            name: author.name,
            wif: author.wif,
            weight: author.weight
        } as Author
        return retval
    }

    async spam(comment, body) {
        const memes = [
            "https://steemitimages.com/DQmSdifbPzahC2RFFmpd7MY9MqrzUy34rjKhzkS522fTHDA/soon.jpg",
            "https://steemitimages.com/0x0/https://steemitimages.com/DQmebMtRTpNPbdNLeYqqtrsCMxwVeGYs58ANS41YZ1dXVJg/mondays.jpeg",
            "https://steemitimages.com/DQmUSaniT7yoGFqM7zCjUSZPvo1dUXZ7txGTXnZbpZFUgKv/comeatmebro.gif",
            "https://steemitimages.com/0x0/https://steemitimages.com/DQmSRdJf6PfTRu7r3oqyywzgpVcxzMwY4dPQgaWh17qUjCg/mildshock.gif",
            "https://steemitimages.com/0x0/https://steemitimages.com/DQmWb1B3Tiu9ZVQgMGNFPvy1wh26chCr5bhUAFRKsAF7ixG/easy.gif",
            "https://steemitimages.com/DQmcEN577GiBqehZ7aa5woXL7vj72f7ZcM3iiwWbh7RVhUR/image.png",
            "https://steemitimages.com/DQmewZPadmQ5dP8EWC2JLwMkHMMLcdD4tX2NcstUDqCBeGP/ohnoes.gif",
            "https://steemitimages.com/DQmVRGZ6dAytVhcr4pTRdFnSnxj2J3tnhJJhrFFPTfWVYon/burningman.gif",
            "https://steemitimages.com/DQmTpAqe15wT6vZwGKPJnHR6HNyw2sW2RZa7RvbaZg8cPeM/kittyyawn.gif",
            "https://steemitimages.com/DQmcEN577GiBqehZ7aa5woXL7vj72f7ZcM3iiwWbh7RVhUR/image.png",
            "https://steemitimages.com/DQmPMiZBzePcFiirBCQoDP1PzELK2K9etJSU7RTMvhQNvtW/huge.gif",
            "https://steemitimages.com/0x0/https://steemitimages.com/DQmebWy28k2K6qrzfDEGmei2QL87W748gf4x4LgwPe4oixC/spongebobno.gif",
            "https://steemitimages.com/0x0/https://steemitimages.com/DQmbRfuLUQvqJpVezXMtdPqDBasxoXCcffTNcMG3KfWYdTv/kittyshocked.gif",
            "https://steemitimages.com/0x0/https://steemitimages.com/DQmVuoC9KqWe9Lm2ZhNVBat9yio7VWZMDFgtovdSLcJrX7D/buttonmash.gif",
            "https://steemitimages.com/0x0/https://steemitimages.com/DQmdtPzkWkVMM4wzyeevi5b4wcHJUrDcurvghfF3eYX9Hvr/benadryl.png",
            "https://steemitimages.com/DQme5t81e8aYmUfHF4CxaNq7XAw7AUmr9CCYePQUhWRiUTK/avengers.gif",
            "https://steemitimages.com/0x0/https://steemitimages.com/DQmcEJYJP4CuCmSM6JtkfzYDbjm6PajWyGRhsUjsKDRSAfF/giphy%20(1).gif",
            "https://steemitimages.com/p/RGgukq5E6HBM2jscGd4Sszpv94XxHH2uqxMY9z21vaqHt4gBsAYe24mgf78A5JP1wnKcfAsfnqGXxAP8CsjsfmP7hUWecay1k7S3Dv8EktAYyoUiYmqDWbrYASaDz1K?format=match&mode=fit",
            "https://steemitimages.com/p/HNWT6DgoBc14riaEeLCzGYopkqYBKxpGKqfNWfgr368M9UowcCRyH8gcSixiH5egfwu7T4Rh4LSP9FaMtcuQiCydjgqkwgiRjHvkAmVT1KCarpPVKHmvSRphbp9?format=match&mode=fit",
            "https://steemitimages.com/p/4i88GgaV8qiFU89taP2MgKXzwntUGAvkoQiKU7VxyD37q9FfkXRmza8i4BGz9rhzfHcytcvqSnc6m8nTz76ZuNbkKqZuiCfeHmQe142nDa3TVZ4g6ycYDUiXs3?format=match&mode=fit",
            "https://steemitimages.com/p/qjrE4yyfw5pEPvDbJDzhdNXM7mjt1tbr2kM3X28F6SraZjPqF1NVUJQrWeMo9X58edGHmmnSENFMg1cMgmXZCCLT6MeJSQSPxMoYDuMeNdHimNU2HE3LU6SZ?format=match&mode=fit",
            "https://steemitimages.com/p/3W72119s5BjVs3Hye1oHX44R9EcpQD5C9xXzj68nJaq3CeGDyfpobdH2eBwMoRpT5LZeFqP9zBk6BWYL44BvvrnhFiXhR1JryEKJTCsHYFrsnzBhjFcN4m?format=match&mode=fit",
            "https://steemitimages.com/p/6VvuHGsoU2QBt9MXeXNdDuyd4Bmd63j7zJymDTWgdcJjnzpaDH3SJo9GrF3CScdctcfvfLNWS77w8hSMeLBSzwCTBwmC7A5M4eNyzKSCQqVxMfeSqJMET12UbYE6Kf?format=match&mode=fit",
            "https://steemitimages.com/p/qjrE4yyfw5pEPvDbJDzhdNXM7mjt1tbr2kM3X28F6SraZdgTPBnRnnp3wbxL46RF2JrN4PUw965XPy9d6mENku89ucGzJeEcTM1wND3BXT6fx4RdvCP8BFsT?format=match&mode=fit",
            "https://steemitimages.com/p/6VvuHGsoU2QBt9MXeXNdDuyd4Bmd63j7zJymDTWgdcJjnzh9AfGXFkDKZrGwfydcTa917nZ7mdeo9VjjC5q4kKAu9K8T5AUPCuy3BuLpdpKKCRW61R4wTywM8wMLuK?format=match&mode=fit",
            "https://steemitimages.com/p/HNWT6DgoBc14riaEeLCzGYopkqYBKxpGKqfNWfgr368M9UowcCRyH8gcSixiH5egfwu7T4Rh4LSP9FaMtcuQiCydjgqkwgiRjHvkAmVT1KCarpPVKHmvSRphbp9?format=match&mode=fit",
            "https://steemitimages.com/p/HNWT6DgoBc14riaEeLCzGYopkqYBKxpGKqfNWfgr368M9WNB5UUjnhBYCrDGBgKwRioSC82rB73WWS9VSTToXpy38ApyR2QH9tJ4cTThJVXdYLWx7A456z7bFDf?format=match&mode=fit",
            "https://steemitimages.com/p/RGgukq5E6HBM2jscGd4Sszpv94XxHH2uqxMY9z21vaqHt2vKXDMuuN1PzGccCesV8nYforsXigN16gjxEyZkjaLwvw1Z9AfFW75DqJzRXidjHZYdgS67aE2ZqTc36uk?format=match&mode=fit&width=640",
            "https://steemitimages.com/p/vM1pGHgNcyCXUWJECrZbvn1NMPj1oFGUo3gYfF3NNPRD9VY7im7aGaAyRuUHqSPypccdZueViJPq1FCYDMAyhwuMguMpWy3y8hyMeqptXMZwLexgoQXKu3xJPQpBo5X2xwXK614?format=match&mode=fit&width=640"
        ]

        const random_meme = memes[Math.floor(Math.random() * Math.floor(memes.length))]
        const response = `![](${random_meme})`

        try {
            const age = moment().utc().local().diff(moment(comment.created).utc().local())
            Logger.log(`Comment age: ${age} milliseconds`)
            let timeout = age < config.spam_delay ? config.spam_delay - age : 0
            timeout = 1000
            if (comment.parent_author == '') {
                timeout = config.post_delay
            }
            return this.schedule_reply(comment, response, timeout)
        }
        catch (err) {
            Logger.error(`Caught an error training ${JSON.stringify(err)}`)
        }
        return 
    }
    
    reply(comment, message) {
        Logger.log(`Replying to ${JSON.stringify({author: comment.author, permlink: comment.permlink})}`)
    
        var permlink = 're-' + comment.author.replace(/[\.]/, '-')
            + '-' + comment.permlink 
            + '-' + new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
    
        // Check if we already put a reply on the exact same post
        return this.api().alreadyPosted(comment, this.author.name)
            .then((alreadyPosted) => {
                if (alreadyPosted) {
                    Logger.log(`Rejecting post ${comment.author}/${comment.permlink} as duplicate`)
                    return Promise.reject('Duplicate post')
                }
           
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
            }).catch((err) => {
                if (err.message.indexOf("STEEM_MIN_REPLY_INTERVAL_HF20") > -1) {
                    return this.schedule_reply(comment, message, THREE_MINUTES)
                }
                else {
                    Logger.error(`Unable to process comment. ${JSON.stringify(err)}`)
                }
            })
        }).catch((err) => {
            Logger.error(`Skipping ${permlink} ${JSON.stringify(err)}`)
        })
    }


    async schedule_reply(comment, response, timeout): Promise {
        if (this.queue.contains({ comment, response })) {
            Logger.warn("Reply already in queue or the queue is at capacity. Skipping...")
            return
        }

        return this.api().alreadyPosted(comment, this.author.name)
            .then((alreadyPosted) => {
                if (alreadyPosted) {
                    Logger.log(`Rejecting post ${comment.author}/${comment.permlink} as duplicate`)
                    return Promise.reject('Duplicate post')
                }
                /*
                const now = new Date()
                if (moment().add(timeout, 'ms').isBefore(this.last_reply_time)) {
                    timeout = moment(this.last_reply_time).add(3, 'm').diff(moment())
                    Logger.log(`Setting timeout to ${timeout}`)
                }
                this.last_reply_time = moment().add(timeout, 'ms').toDate()
                */
                Logger.log(`Scheduling reply for ${timeout}`)
                return setTimeout(() => { 
                    this.reply(comment, response)
                }, timeout)
            })
    }

    comments(author) {
        let weekOldPermlink = "";
        const base_query = {
            "start_author": author,
            "limit": 100,
            "truncate_body": 1
        }
        let permlink = ""
        const spamService = this
        return {
            async *[Symbol.asyncIterator]() {
                while (weekOldPermlink === "") {
                    for (let comment of await spamService.api().getComments(
                        {
                            ...base_query,
                            "start_permlink": permlink
                        }
                    )) {
                        permlink = comment.permlink
                        if (spamService.isYearOld(comment)) {
                            yield comment
                        }
                    }
                }        
            }
        }
    }

    current_voting_power(vp_last, last_vote) {
        Logger.log(`Comparing ${moment().utc().add(7, 'hours').local().toISOString()} to ${moment(last_vote).utc().local().toISOString()}`)
        const seconds_since_vote = moment().utc().local().diff(moment(last_vote).utc().local(), 'seconds')
        return (RECOVERY_RATE * seconds_since_vote) + vp_last
    }    

    time_needed_to_recover(voting_power, threshold) {
        return (threshold - voting_power) / RECOVERY_RATE
    }

    check_can_vote(voter) {
        return this.api().getAccounts([ voter ]).then((accounts) => {
            if (accounts && accounts.length > 0) {
                const account = accounts[0];
                Logger.log(`Getting voting power for ${account.voting_power}, ${account.last_vote_time}Z`)
                const voting_power = this.current_voting_power(account.voting_power, account.last_vote_time + "Z")
                Logger.log(`Comparing voting power ${voting_power} to threshold ${(config.threshold * 100)}`)
                if (!config.threshold || voting_power > (config.threshold * 100)) {
                    return true;
                }
            }
            return false;
        })
    }

    isWeekOld(content:any):boolean {
        const age_in_seconds = moment().utc().local().diff(moment(content.created).utc().local(), 'seconds')
        return ONE_WEEK <= age_in_seconds
    }

    is6MonthsOld(content:any):boolean {
        const age_in_seconds = moment().utc().local().diff(moment(content.created).utc().local(), 'seconds')
        return SIX_MONTH <= age_in_seconds
    }

    isYearOld(content: any): boolean {
        const age_in_seconds = moment().utc().local().diff(moment(content.created).utc().local(), 'seconds')
        return ONE_YEAR <= age_in_seconds
    }

    spammers() {
        const buffer = fs.readFileSync(process.env.CONFIG_DIR + "/spammers.json").toString();
        return JSON.parse(buffer)
    }

    batch() {
        Logger.log("Running batch")
        // search for comments of spammers
        const spammers = this.spammers()

        return Promise.filter(spammers, (spammer, index, length) => {
            this.processComments(spammer)
        })
    }

    async processComments(spammer) {
        Logger.log(`Processing comments for ${JSON.stringify(spammer)}`)
        for await (let comment of this.comments(spammer.name)) {
            await sleep(3000)
            this.processComment(comment)
        }
    }

    async processBullying(operation:any) {
        Logger.log(`Processing bullying for ${JSON.stringify(operation)}`)
        const comment = await this.api().getContent(operation.author, operation.permlink)
        const parent = await this.api().getContent(comment.parent_author, comment.parent_permlink)
        this.api().deleteComment(this.author.wif, comment)
        this.schedule_reply(parent, comment.body, FIVE_SECONDS)
    }

    run() {
        Logger.log("Streaming started")
        const retval = this.api().streamOperations(
            (results) => {
                return Promise.resolve(results.op).spread((operation_name, operation) => {
                    switch (operation_name) {
                        /*
                        case 'comment':
                            if (operation.parent_author !== '') {
                                return this.processComment(operation)
                                    .catch((err) => {
                                        Logger.error("Unable to process comment because ", err)
                                    })
                            }
                        */
                        case 'vote':
                            if (operation.weight < 0
                                && ['r351574nc3', 'perpetuator', 'exifr', 'exifr0', 'salty-mcgriddles'].includes(operation.author)) {
                                return this.processBullying(operation)
                            }
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