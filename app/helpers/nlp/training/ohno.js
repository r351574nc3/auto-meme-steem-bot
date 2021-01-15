const talkify = require('talkify');
const BotTypes = talkify.BotTypes;
const TrainingDocument = BotTypes.TrainingDocument;


module.exports = [
    new TrainingDocument('ohno', 'oh no'),
    new TrainingDocument('ohno', 'ohno'),
    new TrainingDocument("ohno", "oh no my banner doesnt work very well."),
    new TrainingDocument("ohno", "ah oh no, i clicked on upvote again."),
    new TrainingDocument("ohno", "ariel : oh no, no not use kilo but romeo after alpha."),
    new TrainingDocument('ohno', 'noooo')
]