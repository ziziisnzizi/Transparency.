// Shared by the browser and server so crisis situations never become sales copy.
// This is a conservative safeguard, not a diagnosis or a complete classifier.
const crisis = /자살|자해|죽고\s*싶|죽을|죽었|사망|살해|살인|살고\s*싶지|살기\s*싫|학대|폭행|폭력|성폭력|성추행|강간|강제추행|스토킹|범죄|전쟁|전사|학살|테러|재난|비극|장례|유산|사별|이별|이혼|헤어졌|실연|슬픔|슬퍼|괴로|트라우마|응급|중독|약물|마약|불법|우울|공황|trauma|suicid|self[ -]?harm|rape|murder|assault|abuse|violence|death|dying|kill myself|overdose/i;
export function isCrisisConcern(query) { return typeof query === 'string' && crisis.test(query); }
