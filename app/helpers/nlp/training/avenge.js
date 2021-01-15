const talkify = require('talkify');
const BotTypes = talkify.BotTypes;
const TrainingDocument = BotTypes.TrainingDocument;


module.exports = [
    new TrainingDocument('avenge', 'toothbrush'),
    new TrainingDocument('avenge', 'avenge'),
    new TrainingDocument('avenge', 'bathroom'),
    new TrainingDocument('avenge', 'wash up'),
    new TrainingDocument('avenge', 'wash-up'),
    new TrainingDocument('avenge', 'washroom'),
    new TrainingDocument('avenge', 'wash hand'),
    new TrainingDocument("avenge", "only you can avenge us from the terror of their heartless torsos"),
    new TrainingDocument('avenge', 'restroom')
]
