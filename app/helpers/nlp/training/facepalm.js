const talkify = require('talkify');
const BotTypes = talkify.BotTypes;
const TrainingDocument = BotTypes.TrainingDocument;


module.exports = [
    new TrainingDocument('facepalm', 'face palm'),
    new TrainingDocument('facepalm', 'facepalm'),
    new TrainingDocument('facepalm', 'face-palm')
]