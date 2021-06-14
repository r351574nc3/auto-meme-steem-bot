import { Injectable, Logger } from '@nestjs/common';
import { BlockchainMode, Client, PrivateKey } from '@hiveio/dhive';
import * as Promise from 'bluebird';

@Injectable()
export class HiveService {
    client: any;
    constructor() {
        this.client = new Client(
            [
                "https://api.hive.blog",
                "https://api.hivekings.com",
                "https://anyx.io",
                "https://api.openhive.network"
            ]
        );
    }

    getContent(author: string, permlink: string): any {
        return Promise.resolve(this.client.database.call('get_content', [author, permlink]));
    }

    async getContentReplies(author: string, permlink: string): Promise<any> {
        return this.client.database.call('get_content', [author, permlink]);
    }

    getParentOf(author: string, permlink: string): any {
        
    }

    replies(author: string, permlink: string): Promise {
        const service = this
        return {
            async *[Symbol.asyncIterator]() {
                const posts = [{ author, permlink }]
                while (posts.length > 0) {
                    const post = posts.pop()
                    const post_replies = await service.getContentReplies(post.author, post.permlink)
                    for (let reply of post_replies) {
                        posts.push(reply)
                        yield reply
                    }
                }
            }
        }
    }

    async hasSiblingsIn(author: string, permlink: string): Promise {

    }

    async alreadyPosted(post: any, author: string): Promise {
        const parent = await this.getParentOf(post.author, post.permlink);

        // Get all replies
        for await (let reply of this.replies(parent.author, parent.permlink)) {
            if (reply.author === author &&
                reply.body.indexOf(post.body)) {
                return true
            }
        }
        return false
    }

    async getAccounts(): Promise {
        return new Promise()
    }
    
    vote(posting_key, voter, author, permlink, weight): any {
        const key = PrivateKey.from(posting_key)
        return Promise.resolve(this.client.broadcast.vote(
            {
                voter: voter, 
                author: author, 
                permlink: permlink, 
                weight: weight
            },
            key
        ));
    }

    comment(posting_key: string, comment: any):any {
        const key = PrivateKey.from(posting_key)
        return this.client.broadcast.comment(comment, key)
    }

    async deleteComment(post: any): Promise {
        return await this.client.database.call('delete_comment', [ post.author, post.permlink ])
    }

    async getComments(query) {
        return this.client.database.call('get_discussions_by_comments', [query])
    }

    getActiveVotes(author, permlink): any {
        return Promise.resolve(
            this.client.database.call('get_active_votes', [author, permlink])
        )
    }

    streamOperations(handler, errors): Promise {
        const stream = this.client.blockchain.getOperationsStream();
        stream.on("data", handler)
        stream.on("error", errors)
    }
}
