import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReplyService } from './reply.service';
import { VoteService } from './vote.service';
import * as Promise from 'bluebird';



async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const replyService = app.select(AppModule).get(ReplyService);
  const voteService = app.select(AppModule).get(VoteService);
  voteService.run()
  replyService.run()
  Logger.log("Done streaming")
}
bootstrap();
