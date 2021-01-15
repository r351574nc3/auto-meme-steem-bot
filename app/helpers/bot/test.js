// str = "wow! so unexpected and the first light i saw on this platform, greatly appreciated!!!";
str = `downloading from google play can also cause phone problems. if there is a problem in that app. take a look at the list of those harmful apps.

five night survival craft: game app this app may be a serious loss.

mcqueen car racing game: this is a car racing game. it may also be a serious loss.

addon eximbo: this is also a 3d game. the phone is not good to download.

cool craft: if the memory is not enough on the phone, it could be a terrible problem. uninstalling this game can be a lot of space on the phone.

draw kawai: this is also a feature game app. this can be done through small drawings. the app is good for spending time, but bad for the phone.

subway banana runway surfer: it's an app like a subway surfer. it also has problems.

drawing lessons angry bird: this is a drawing app. harmful for the phone.

girl's exploration (lite): 2d game app so far, google play has downloaded over 5 million.`
sentences = str.replace(/([.?!])(?=[\s!?])(?=[\s!?a-z])(?=[\s!?a-z])/g, "$1|").split("|")
console.log(sentences)