import { Module } from '@nestjs/common';
import { HiveModule } from './hive.module';
import { HiveService } from './hive.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReplyService } from './reply.service';
import { SteemModule } from './steem.module';
import { SteemService } from './steem.service';

@Module({
  imports: [ HiveModule, SteemModule ],
  controllers: [AppController],
  providers: [
    AppService, 
    ReplyService, 
    HiveService,
    SteemService,
  ],
})
export class AppModule {}
