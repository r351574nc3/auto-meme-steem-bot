const config = {
    steemEnabled: process.env.STEEM_ENABLED || false,
    user: process.env.STEEM_NAME || "YOU NEED TO FILL THIS IN ICEHOLE",
    wif: process.env.STEEM_WIF || "YOU NEED TO FILL THIS IN ICEHOLE",
    weight: parseInt(process.env.VOTE_WEIGHT) || 400,
    reply_delay: 300000,
    post_delay: 259200000,
    queue_capacity: 60,
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
        "lenasveganliving",
        "SteemAlive",
        "wootzu",
        "ghost-of-galt",
        "thehockeyfan-at",
        "aman9675",
        "hafiz34",
        "y0gi",
        "azure-infero",
        "ecosynthesizer",
        "imran15",
        "rasel72",
        "por500bolos68",
        "rcestrella24"
    ]
}
export { config }