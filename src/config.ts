const config = {
    steemEnabled: process.env.STEEM_ENABLED || false,
    user: process.env.STEEM_NAME || "YOU NEED TO FILL THIS IN ICEHOLE",
    wif: process.env.STEEM_WIF || "YOU NEED TO FILL THIS IN ICEHOLE",
    weight: parseInt(process.env.VOTE_WEIGHT) || 400,
    reply_delay: 300000,
    post_delay: 1810000,
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
    ],
}
export { config }