import { Injectable, Logger } from '@nestjs/common';
import { BlockchainMode, Client, PrivateKey } from 'dsteem';
import * as Promise from 'bluebird';

@Injectable()
export class SteemService {
    client: any;
    constructor() {
        this.client = new Client("https://api.steemit.com", {});
    }

    getContent(author: string, permlink: string): any {
        return Promise.resolve(this.client.database.call('get_content', [author, permlink]));
    }

    async getContentReplies(author: string, permlink: string): Promise {
        return this.client.database.call('get_content_replies', [author, permlink]).catch((e) => Logger.log(`Caught ${JSON.stringify(e)}`));
    }

    async getParentOf(author: string, permlink: string): Promise {
        let post = await this.client.database.call('get_content', [author, permlink])
        while (post.parent_author !== '' && post.parent_permlink !== '') {
            post = await this.client.database.call('get_content', [post.parent_author, post.parent_permlink])
        }
        return post
    }
    
    async deleteComment(post: any): Promise {
        return await this.client.database.call('delete_comment', [ post.author, post.permlink ])
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

    async hasSiblingsIn(post: any, author: string): Promise {
        const parent = await this.getParentOf(post.author, post.permlink);

        // Get all replies
        for await (let reply of this.replies(parent.author, parent.permlink)) {
            if (reply.author === author) {
                return true
            }
        }
        return false
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

    comment(posting_key: string, comment: any): any {
        const key = PrivateKey.from(posting_key)
        return this.client.broadcast.comment(comment, key)
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

    async getAccounts(accounts: string[]): Promise {

    }
}
