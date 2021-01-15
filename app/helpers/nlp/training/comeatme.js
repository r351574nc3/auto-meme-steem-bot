const talkify = require('talkify');
const BotTypes = talkify.BotTypes;
const TrainingDocument = BotTypes.TrainingDocument;


module.exports = [
    new TrainingDocument('come_at_me', 'bring it'),
    new TrainingDocument('come_at_me', 'come at me'),
    new TrainingDocument('come_at_me', 'fight me'),
    new TrainingDocument('come_at_me', 'fight with me'),
    new TrainingDocument('come_at_me', 'argue with me'),
    new TrainingDocument('come_at_me', 'debate me'),
    new TrainingDocument('come_at_me', 'debate with me')
]