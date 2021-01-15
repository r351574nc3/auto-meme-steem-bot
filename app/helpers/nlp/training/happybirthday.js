const talkify = require('talkify');
const BotTypes = talkify.BotTypes;
const TrainingDocument = BotTypes.TrainingDocument;


module.exports = [
    new TrainingDocument('happy_birthday', "happy birthday"),
    new TrainingDocument('happy_birthday', "it's my birthday"),
    new TrainingDocument('happy_birthday', "it is my birthday"),
    new TrainingDocument('happy_birthday', "will be my birthday"),
    new TrainingDocument('happy_birthday', "today is my birthday"),
    new TrainingDocument('happy_birthday', "tomorrow is my birthday"),
    new TrainingDocument('happy_birthday', "yesterday was my birthday"),
    new TrainingDocument("happy_birthday", "Happy Birthday Brother Tikhub"),
    new TrainingDocument("happy_birthday", "happy birthday to you brother"),
    new TrainingDocument("happy_birthday", "A belated birthday gift and a token of gratitude for the people's whale - @surpassinggoogle"),
    new TrainingDocument("happy_birthday", "send subscribers happy birthday emails."),
    new TrainingDocument("happy_birthday", "it's my birthday today and i wasn't expecting to receive anything from bestie because she's in the us"),
    new TrainingDocument("happy_birthday", "happy birthday to him")
]