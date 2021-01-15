const talkify = require('talkify');
const BotTypes = talkify.BotTypes;
const TrainingDocument = BotTypes.TrainingDocument;


module.exports = [
    new TrainingDocument('withfire', 'i guess the old saying if you play with fire you will get burned.'),
    new TrainingDocument('withfire', 'with-fire'),
    new TrainingDocument('withfire', 'withfire'),
    new TrainingDocument('withfire', 'with fire')
]