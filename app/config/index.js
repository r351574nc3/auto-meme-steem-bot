config = {
    user: process.env.STEEM_NAME || "YOU NEED TO FILL THIS IN ICEHOLE",
    wif: process.env.STEEM_WIF || "YOU NEED TO FILL THIS IN ICEHOLE",
    weight: parseInt(process.env.VOTE_WEIGHT) || 400,
    steemit_url: "https://www.steemit.com",
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
        "sneaky-ninja"
    ]
}


module.exports = config