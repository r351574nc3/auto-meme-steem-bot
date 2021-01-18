import { Injectable, Logger } from '@nestjs/common';
import { BlockchainMode, Client, PrivateKey } from '@hiveio/dhive';
import { HiveService } from './hive.service';
import { SteemService } from './steem.service';
import { config } from './config';
import * as Promise from 'bluebird';
import * as moment from 'moment';
import * as fs from 'fs';
import * as bot from 'talkify';


const voting_queue = [];
const ONE_SECOND = 1000
const FIVE_SECONDS = 5000
const THREE_MINUTES = 150000
const TWO_MINUTES = 120000
const SIX_MINUTES = 360000
const TEN_MINUTES = 600000
const FIFTEEN_MINUTES = 898000
const THIRTY_MINUTES = 1800000
const ONE_HOUR = 3600000
const ONE_WEEK = 604800

const instant_voters = [
]

const voting = {
    length: () => { return voting_queue.length },
    push: (obj) => { return voting_queue.push(obj) },
    pop: () => { return voting_queue.pop() },
    shift: () => { return voting_queue.shift() },
    unshift: (obj) => { return voting_queue.unshift(obj) }
}

interface ContentMetadata {
    tags: string[]
}

interface Author {
    name: string
    wif: string
    weight: string
}

@Injectable()
export class VoteService {
    private hiveService: HiveService;
    private steemService: SteemService;
    private author: Author

    constructor(hiveService: HiveService,
            steemService: SteemService) {
        this.hiveService = hiveService;
        this.steemService = steemService;
        this.author = this.load_author()

        setInterval(() => {
            const to_vote = voting_queue.shift()
            this.vote(to_vote)
                .catch((err) => {
                })
        }, ONE_SECOND)
    }

    api() {
        return config.steemEnabled ? this.steemService : this.hiveService;
    }

    async url_to_post(url) {
        if (!url.startsWith("https")) {
            throw Error("Not a valid url")
        }
        if (url.indexOf("#") > -1) { // ignore comments
            throw Error("Comments and replies are invalid")
        }
        if (url.indexOf('@') < 0) { // invalid path
            throw Error("No author in path")
        }
        const path = url.split("@")[1] // there should only be one of these
        return path.split("/") // valid url @author/permlink
    }

    is_english(sentence) {
        return sentence.indexOf(" is ") > -1
            || sentence.indexOf(" and ") > -1
            || sentence.indexOf(" or ") > -1
            || sentence.indexOf(" the ") > -1
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
    
    is_author_blacklisted(comment): boolean {
        return config.blacklist.filter((blacklisted) => blacklisted == comment.author).length > 0
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
            return Promise.reject("Invalid post")
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
                            voting_queue.push(post)
                        }
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

    /**
     * For the account author find all replies with the criteria:
     * * specific author
     * * not older than 7 days
     */
    comments() {
        let weekOldPermlink = "";
        const base_query = {
            "start_author": this.author.name,
            "limit": 10,
            "truncate_body": 1
        }
        let permlink = ""
        const voteService = this
        return {
            async *[Symbol.asyncIterator]() {
                while (weekOldPermlink === "") {
                    for (let comment of await voteService.api().getComments(
                        {
                            ...base_query,
                            "start_permlink": permlink
                        }
                    )) {
                        permlink = comment.permlink
                        if (!voteService.isWeekOld(comment)) {
                            yield comment
                        }
                        else {
                            weekOldPermlink = comment.permlink
                        }
                    }
                }        
            }
        }
    }
    
    isWeekOld(content:any):boolean {
        const age_in_seconds = moment().utc().local().diff(moment(content.created).utc().local(), 'seconds')
        return ONE_WEEK <= age_in_seconds
    }

    async processComments() {
        for await (let comment of this.comments()) {
            Logger.log("Voting in an hour on ", JSON.stringify(
                {
                    author: comment.author,
                    permlink: comment.permlink,
                    weight: this.author.weight
                }
            ))
            setTimeout(() => {
                voting_queue.push(
                    {
                        author: comment.author,
                        permlink: comment.permlink,
                        weight: this.author.weight
                    }
                )
            }, ONE_HOUR)
        }
    }

    async run() {
        await this.processComments()
        setInterval(() => { this.processComments() }, ONE_HOUR)
    }
}
