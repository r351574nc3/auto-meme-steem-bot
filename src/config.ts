const config = {
    steemEnabled: process.env.STEEM_ENABLED || false,
    user: process.env.STEEM_NAME || "YOU NEED TO FILL THIS IN ICEHOLE",
    wif: process.env.STEEM_WIF || "YOU NEED TO FILL THIS IN ICEHOLE",
<<<<<<< HEAD:app/config/index.js
    weight: parseInt(process.env.VOTE_WEIGHT) || 300,
    steemit_url: "https://www.steemit.com",
=======
    weight: parseInt(process.env.VOTE_WEIGHT) || 400,
    reply_delay: 300000,
    post_delay: 1810000,
>>>>>>> nestjs:src/config.ts
    blacklist: [
        "banjo",
        "buildawhale",
        "booster",
        "drotto",
        "minibot",
        "microbot",
        "nanobot",
        "photocontests",
        "photocontests1",
        "photocontests2",
        "photocontests3",
        "photocontests4",
        "sneaky-ninja",
<<<<<<< HEAD:app/config/index.js
        "lenasveganliving"
    ]
}


module.exports = config
=======
        "SteemAlive"
    ],
}
export { config }
>>>>>>> nestjs:src/config.ts
