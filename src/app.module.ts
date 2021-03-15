import { Module } from '@nestjs/common';
import { HiveModule } from './hive.module';
import { HiveService } from './hive.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpamService } from './spam.service';
import { VoteService } from './vote.service';
import { SteemModule } from './steem.module';
import { SteemService } from './steem.service';

@Module({
  imports: [ HiveModule, SteemModule ],
  controllers: [AppController],
  providers: [
    AppService, 
    SpamService, 
    VoteService, 
    HiveService,
    SteemService,
  ],
})
export class AppModule {}
