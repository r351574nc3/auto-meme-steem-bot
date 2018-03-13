config = {
    user: process.env.STEEM_NAME || "YOU NEED TO FILL THIS IN ICEHOLE",
    wif: process.env.STEEM_WIF || "YOU NEED TO FILL THIS IN ICEHOLE",
    weight: parseInt(process.env.VOTE_WEIGHT) || "PLEASE SET THIS ",
    steemit_url: "https://www.steemit.com"
}


module.exports = config