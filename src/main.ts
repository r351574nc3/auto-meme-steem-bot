import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SpamService } from './spam.service';
import { VoteService } from './vote.service';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const voteService = app.select(AppModule).get(VoteService);
  const spamService = app.select(AppModule).get(SpamService);
  // voteService.run()
  // spamService.batch()
  // spamService.run()
  Logger.log("Done streaming")
}
bootstrap();
