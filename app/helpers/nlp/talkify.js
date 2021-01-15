const talkify = require('talkify');
const Bot = talkify.Bot;

// Types dependencies
const BotTypes = talkify.BotTypes;
const Message = BotTypes.Message;
const SingleLineMessage = BotTypes.SingleLineMessage;
const MultiLineMessage = BotTypes.MultiLineMessage;
 
// Skills dependencies
const Skill = BotTypes.Skill;
 
// Training dependencies
const TrainingDocument = BotTypes.TrainingDocument;

const bot = new Bot()

const training_arr = [
    new TrainingDocument('sleepy', 'sleepy'),
    new TrainingDocument('stormtrooper', 'storm trooper'),
    new TrainingDocument('challenge', 'challenge')
].concat(require("./training/happybirthday"))
    .concat(require("./training/avenge"))
    .concat(require("./training/comeatme"))
    .concat(require("./training/facepalm"))
    .concat(require("./training/hungry"))
    .concat(require("./training/mindblown"))
    .concat(require("./training/monday"))
    .concat(require("./training/nope"))
    .concat(require("./training/nailedit"))
    .concat(require("./training/narcotic"))
    .concat(require("./training/ohno"))
    .concat(require("./training/puzzle"))
    .concat(require("./training/omg"))
    .concat(require("./training/rage"))
    .concat(require("./training/shock"))


bot.trainAll(training_arr, function() {});


const skill_meme_tuple = [
    {
        skill: "hungry_skill", 
        topic: "hungry", 
        meme: "![](https://steemitimages.com/DQmSdifbPzahC2RFFmpd7MY9MqrzUy34rjKhzkS522fTHDA/soon.jpg)"
    },
    {
        skill: "nope_skill", 
        topic: "nope", 
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmebWy28k2K6qrzfDEGmei2QL87W748gf4x4LgwPe4oixC/spongebobno.gif)"
    },
    {
        skill: "puzzle_skill",
        topic: "puzzle",
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmWb1B3Tiu9ZVQgMGNFPvy1wh26chCr5bhUAFRKsAF7ixG/easy.gif)"
    },
    {
        skill: "happy_birthday_skill",
        topic: "happy_birthday",
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmcEJYJP4CuCmSM6JtkfzYDbjm6PajWyGRhsUjsKDRSAfF/giphy%20(1).gif)"
    },
    {
        skill: "shock_skill",
        topic: "shock",
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmSRdJf6PfTRu7r3oqyywzgpVcxzMwY4dPQgaWh17qUjCg/mildshock.gif)"
    },
    {
        skill: "rage_skill",
        topic: "rage",
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmVuoC9KqWe9Lm2ZhNVBat9yio7VWZMDFgtovdSLcJrX7D/buttonmash.gif)"
    },
    {
        skill: "mondays_skill",
        topic: "mondays",
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmebMtRTpNPbdNLeYqqtrsCMxwVeGYs58ANS41YZ1dXVJg/mondays.jpeg)"
    },
    {
        skill: "omg_skill",
        topic: "omg",
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmbRfuLUQvqJpVezXMtdPqDBasxoXCcffTNcMG3KfWYdTv/kittyshocked.gif)"
    },
    {
        skill: "avenge_skill",
        topic: "avenge",
        meme: "![](https://steemitimages.com/DQme5t81e8aYmUfHF4CxaNq7XAw7AUmr9CCYePQUhWRiUTK/avengers.gif)"
    },
    {
        skill: "narcotic_skill",
        topic: "narcotic",
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmdtPzkWkVMM4wzyeevi5b4wcHJUrDcurvghfF3eYX9Hvr/benadryl.png)"
    },
    {
        skill: "nailed_it_skill",
        topic: "nailed_it",
        meme: "![](https://steemitimages.com/DQmPMiZBzePcFiirBCQoDP1PzELK2K9etJSU7RTMvhQNvtW/huge.gif)"
    },
    {
        skill: "come_at_me_skill",
        topic: "come_at_me",
        meme: "![](https://steemitimages.com/DQmUSaniT7yoGFqM7zCjUSZPvo1dUXZ7txGTXnZbpZFUgKv/comeatmebro.gif)"
    },
    {
        skill: "facepalm_skill",
        topic: "facepalm",
        meme: "![](https://steemitimages.com/DQmcEN577GiBqehZ7aa5woXL7vj72f7ZcM3iiwWbh7RVhUR/image.png)"
    },
    {
        skill: "mindblown_skill",
        topic: "mindblown",
        meme: "![](https://steemitimages.com/0x0/https://steemitimages.com/DQmWKyX1knyGQp546ovy3wduYh4PLm9mu9dPMDTCmrsZheZ/kramermindblown.gif)"
    },
    {
        skill: "ohno_skill",
        topic: "ohno",
        meme: "![](https://steemitimages.com/DQmewZPadmQ5dP8EWC2JLwMkHMMLcdD4tX2NcstUDqCBeGP/ohnoes.gif)"
    }
    
]

for (const tuple of skill_meme_tuple) {
    const { skill, topic, meme } = tuple;

    bot.addSkill(new Skill(skill, topic, (context, request, response, next) => {
        console.log("Skill ", request.skill.current)
        response.message = new SingleLineMessage(`> ${request.skill.current.sentence}
${meme}`)
        next();
    }))   
}

/*
bot.addSkill(new Skill("challenge_skill", "challenge", (context, request, response, next) => {
    response.message = new SingleLineMessage(`> ${request.skill.current.sentence}
![](https://steemitimages.com/0x0/https://steemitimages.com/DQmTTXAf2n9W3x1nmSNuhx3jTDWDXPnUUfSGjKnTbh4c7Ma/giphy%20(2).gif)`)
    next();
}))
bot.addSkill(new Skill("withfire_skill", "withfire", (context, request, response, next) => {
    response.message = new SingleLineMessage(`> ${request.skill.current.sentence}
![](https://steemitimages.com/DQmVRGZ6dAytVhcr4pTRdFnSnxj2J3tnhJJhrFFPTfWVYon/burningman.gif)`)
    next();
}))
bot.addSkill(new Skill("stormtrooper_skill", "stormtrooper", (context, request, response, next) => {
    response.message = new SingleLineMessage(`> ${request.skill.current.sentence}
![](https://steemitimages.com/0x0/https://steemitimages.com/DQmaNgiCGS3BcPLLDTABEMZahZitP6yKD3sG1JtYYHEje5q/dancingstormtroopers.gif)`)
    next();
}))
*/
module.exports = bot;
