const talkify = require('talkify');
const BotTypes = talkify.BotTypes;
const TrainingDocument = BotTypes.TrainingDocument;


module.exports = [
    new TrainingDocument('sleepy', 'the cat must have been sleepy.'),
    new TrainingDocument("sleepy", "the blindfolded, hungry, waterlogged, sleep deprived, physically exhausted, and shivering students (sometimes i could hear their teeth still chattering) are blindfolded, led to a darkened classroom and crammed into tiny first-grade size school desks."),
    new TrainingDocument('sleepy', 'yawn'),
    new TrainingDocument('sleepy', 'sleepy')
]