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
    async hasSiblingsIn(author: string, permlink: string): Promise {

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
