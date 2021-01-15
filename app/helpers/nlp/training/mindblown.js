const talkify = require('talkify');
const BotTypes = talkify.BotTypes;
const TrainingDocument = BotTypes.TrainingDocument;


module.exports = [
    new TrainingDocument('mindblown', 'mindblow'),
    new TrainingDocument('mindblown', 'mind blow'),
    new TrainingDocument('mindblown', 'mind-blow'),
    new TrainingDocument('mindblown', 'oh no'),
]