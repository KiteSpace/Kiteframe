import { coffeeShopSchema, type CoffeeShop } from "./types";
import { pooledPhoto } from "./photo-pool";

/**
 * The atlas entries.
 *
 * Everything here is seeded sample content: the cafes are real and the
 * coordinates point at the right block, but the notes are neutral descriptions
 * rather than first-hand accounts, and the photography is openly-licensed stock
 * standing in for real visit photos. Every entry is therefore marked
 * `sample: true`, which the UI surfaces so placeholder copy is never mistaken
 * for a review of your own.
 *
 * To make an entry yours: rewrite `summary`/`review`/`orderThis`, set your own
 * `visits` and `rating`, drop your photos into `client/public/coffee/photos/`
 * and reference them directly, then remove `sample: true`. See
 * client/src/coffee/README.md.
 */
const RAW_SHOPS: CoffeeShop[] = [
  // --- Tokyo: three entries in one city, so the map has something to cluster.
  {
    slug: "fuglen-tokyo",
    name: "Fuglen Tokyo",
    neighborhood: "Tomigaya",
    city: "Tokyo",
    region: "Kanto",
    country: "Japan",
    coords: [139.6907, 35.6684],
    visits: ["2024-04-12", "2023-10-02"],
    rating: 4.5,
    priceBand: 2,
    tags: ["laptop-friendly", "late-hours", "outdoor-seating", "buzzy"],
    brewMethods: ["espresso", "pour-over", "batch-filter"],
    recommended: true,
    orderThis: "Aeropress of the light Nordic single origin, black",
    summary:
      "An Oslo transplant on a quiet Shibuya backstreet: mid-century Norwegian furniture, light roasts, and cocktails after dark.",
    review: `A Norwegian coffee bar that moved to Shibuya and kept both halves of its
personality. Daytime it is a filter bar working through very light Nordic
roasts; after dark the same room turns into a cocktail bar, which means the
espresso machine and the bottle shelf share a counter.

The furniture is the other draw — the room doubles as a showroom for
mid-century Scandinavian pieces, and most of what you sit on is for sale.

**Worth knowing:** the walk from Yoyogi-koen station takes about four minutes
and the seating is tight at weekends. Mornings are the calm window.`,
    photos: [
      pooledPhoto(
        "2019-11-08-inside-cafe-main-church-street-cromer",
        "Bright cafe interior with wooden seating",
      ),
      pooledPhoto("drip-coffee-bangkok", "Filter coffee brewing on the bar"),
    ],
    website: "https://fuglen.no/",
    sample: true,
  },
  {
    slug: "koffee-mameya",
    name: "Koffee Mameya",
    neighborhood: "Omotesando",
    city: "Tokyo",
    region: "Kanto",
    country: "Japan",
    coords: [139.7096, 35.6664],
    visits: ["2024-04-14"],
    rating: 5,
    priceBand: 3,
    tags: ["no-laptops", "counter-only", "quiet"],
    brewMethods: ["espresso", "pour-over"],
    recommended: true,
    orderThis: "Whatever the counter recommends after you describe what you like",
    summary:
      "A bean dispensary behind a garden wall. No menu, no seats — you talk through what you want and they brew it.",
    review: `Less a cafe than a consultation. You step through a small garden into a
standing-room counter, describe what you normally drink, and a member of staff
walks you through beans from a rotating set of roasters until something is
chosen for you.

There is nowhere to sit and nothing to do but pay attention, which is the
point. Expect to spend fifteen minutes and to leave with a bag of something
you would not have picked yourself.

**Worth knowing:** it is genuinely counter-only, so this is a stop rather than
a place to work. Queues form outside by late morning.`,
    photos: [
      pooledPhoto(
        "barista-prepares-espresso-at-coffee-shop",
        "Barista preparing espresso at the counter",
      ),
      pooledPhoto("unroasted-coffee", "Green coffee beans before roasting"),
    ],
    sample: true,
  },
  {
    slug: "glitch-coffee-roasters",
    name: "Glitch Coffee & Roasters",
    neighborhood: "Kanda-Nishikicho",
    city: "Tokyo",
    region: "Kanto",
    country: "Japan",
    coords: [139.7596, 35.6944],
    visits: ["2023-10-05"],
    rating: 4.5,
    priceBand: 2,
    tags: ["roaster-on-site", "laptop-friendly", "quiet"],
    brewMethods: ["pour-over", "espresso"],
    recommended: true,
    orderThis: "A side-by-side of two washed Ethiopians",
    summary:
      "Roasts about as light as light roasting goes, poured over at a long communal table in a quiet office district.",
    review: `Glitch roasts at the pale end of the spectrum and pours almost everything as
filter. The tasting notes on the board read like a fruit stall, and the coffee
mostly delivers on them.

The room is a single long table in an office district that empties out at
weekends, which makes it one of the more comfortable places in central Tokyo to
sit with a laptop and a flight of two coffees.`,
    photos: [
      pooledPhoto("coffee-roaster-1", "Drum roaster in a cafe"),
      pooledPhoto(
        "beans-dropping-from-a-coffee-roaster",
        "Roasted beans dropping into the cooling tray",
      ),
    ],
    sample: true,
  },

  // --- Melbourne
  {
    slug: "patricia-coffee-brewers",
    name: "Patricia Coffee Brewers",
    neighborhood: "CBD",
    city: "Melbourne",
    region: "Victoria",
    country: "Australia",
    coords: [144.9576, -37.8138],
    visits: ["2023-02-20"],
    rating: 4.5,
    priceBand: 2,
    tags: ["counter-only", "no-laptops", "buzzy"],
    brewMethods: ["espresso", "batch-filter"],
    recommended: true,
    orderThis: "A magic — Melbourne's double-ristretto-in-a-small-cup",
    summary:
      "Standing-room-only laneway corner that helped define the Melbourne cafe template. No seats, no laptops, no fuss.",
    review: `A small corner site with no chairs at all: you stand at the ledge or you take
it away. What arrives is fast, consistent, and unfussy, which is roughly the
whole argument of Melbourne coffee compressed into one room.

Order the magic if you want the local idiom — a double ristretto in a 160ml
cup, stronger than a flat white and smaller than a latte.

**Worth knowing:** the queue at 8am moves quickly. There is a pastry case and
not much else.`,
    photos: [
      pooledPhoto("the-magnetic-counter-01-8034827583", "Cafe counter and pastry case"),
      pooledPhoto("cappuccino-latte-art-2006-04-14", "Latte art in a small cup"),
    ],
    sample: true,
  },
  {
    slug: "market-lane-prahran",
    name: "Market Lane Coffee",
    neighborhood: "Prahran Market",
    city: "Melbourne",
    region: "Victoria",
    country: "Australia",
    coords: [144.9942, -37.8482],
    visits: ["2023-02-22"],
    rating: 4,
    priceBand: 2,
    tags: ["outdoor-seating", "great-pastries", "dog-friendly"],
    brewMethods: ["espresso", "batch-filter", "pour-over"],
    recommended: false,
    orderThis: "Batch filter and a slice of whatever came out of the market bakery",
    summary:
      "A market-stall coffee bar where the produce halls do the atmosphere for you. Reliable rather than surprising.",
    review: `Attached to Prahran Market, which means the room is essentially a stall and the
seating is whatever you can find among the shoppers. The coffee is carefully
run and the filter is always on, but the reason to come is the setting — you
end up doing a lap of the produce halls with a cup in hand.

**Worth knowing:** market hours, so check before making a Monday trip.`,
    photos: [
      pooledPhoto(
        "dscf1086-a-quiet-covered-wooden-walkway-lined-with-cozy-seat",
        "Covered walkway with cafe seating and string lights",
      ),
      pooledPhoto("hot-coffee-on-a-rainy-day-flickr-deapeajay", "A mug of black coffee"),
    ],
    sample: true,
  },
  {
    slug: "proud-mary-collingwood",
    name: "Proud Mary",
    neighborhood: "Collingwood",
    city: "Melbourne",
    region: "Victoria",
    country: "Australia",
    coords: [144.9873, -37.7991],
    visits: ["2023-02-25"],
    rating: 4,
    priceBand: 3,
    tags: ["roaster-on-site", "great-pastries", "buzzy"],
    brewMethods: ["espresso", "batch-filter", "cold-brew"],
    recommended: true,
    orderThis: "A rare-lot filter, then the breakfast menu",
    summary:
      "A roastery and a serious brunch kitchen sharing one loud room in Collingwood.",
    review: `Proud Mary runs two operations at once: a roastery working through some
genuinely expensive micro-lots, and a full brunch kitchen. The result is a
noisy, busy room where the coffee list reads like a wine list and the food
arrives on the same scale.

If you only want a cup, the takeaway window is faster than the dining room.

**Worth knowing:** weekend waits are long and they do not take bookings for
small groups.`,
    photos: [
      pooledPhoto(
        "beans-dropping-from-a-coffee-roaster",
        "Beans dropping into the cooling tray",
      ),
      pooledPhoto("coffee-roaster-1", "Roasting drum in the cafe"),
    ],
    sample: true,
  },

  // --- Oslo
  {
    slug: "tim-wendelboe",
    name: "Tim Wendelboe",
    neighborhood: "Grünerløkka",
    city: "Oslo",
    region: "Oslo",
    country: "Norway",
    coords: [10.7594, 59.9243],
    visits: ["2022-06-11"],
    rating: 5,
    priceBand: 3,
    tags: ["roaster-on-site", "quiet", "counter-only"],
    brewMethods: ["espresso", "pour-over"],
    recommended: true,
    orderThis: "A cupping flight, if the counter is quiet enough to offer one",
    summary:
      "The reference point for Nordic light roasting: a small espresso bar and roastery that treats coffee like single-vineyard wine.",
    review: `A small, spare room in Grünerløkka that has had an outsized influence on how
light roasting is done everywhere else. The lots are traceable to the farm, the
roasting is deliberately pale, and the staff will talk through any of it at
length if the counter is not busy.

The coffee is not trying to be comforting. It is acidic, tea-like, and closer
to fruit juice than to what most people mean by coffee — which is the whole
proposition.

**Worth knowing:** tiny, with a handful of seats. Take the tram to
Olaf Ryes plass and walk.`,
    photos: [
      pooledPhoto(
        "2019-11-08-coffee-barista-inside-cafe-main-church-street-cro",
        "Barista at work behind the bar",
      ),
      pooledPhoto("unroasted-coffee", "Unroasted green coffee"),
    ],
    website: "https://timwendelboe.no/",
    sample: true,
  },
  {
    slug: "fuglen-oslo",
    name: "Fuglen Oslo",
    neighborhood: "Sentrum",
    city: "Oslo",
    region: "Oslo",
    country: "Norway",
    coords: [10.7418, 59.9209],
    visits: ["2022-06-12"],
    rating: 4,
    priceBand: 2,
    tags: ["late-hours", "outdoor-seating", "buzzy"],
    brewMethods: ["espresso", "pour-over", "aeropress"],
    recommended: false,
    orderThis: "Filter in the afternoon, an aquavit cocktail after seven",
    summary:
      "The original of the pair — a 1960s-furnished coffee bar that becomes a cocktail bar in the evening.",
    review: `The Oslo original, and the template the Tokyo branch copied: vintage
Norwegian furniture, filter coffee by day, cocktails by night. Coming to it
after Tokyo is slightly disorienting, because the Shibuya version is the more
polished room.

**Worth knowing:** the transition hour around six is the awkward one — half
cafe, half bar, and busy in both directions.`,
    photos: [
      pooledPhoto(
        "dfc-4594-empty-seaside-terrace-at-dusk-shaded-by-triangular-",
        "Cafe terrace seating at dusk",
      ),
      pooledPhoto("cold-drip-coffee-2", "Cold drip coffee served over ice"),
    ],
    sample: true,
  },

  // --- London
  {
    slug: "monmouth-borough-market",
    name: "Monmouth Coffee Company",
    neighborhood: "Borough Market",
    city: "London",
    region: "Greater London",
    country: "United Kingdom",
    coords: [-0.0908, 51.5052],
    visits: ["2024-01-18", "2022-09-03"],
    rating: 4,
    priceBand: 2,
    tags: ["counter-only", "buzzy", "great-pastries", "cash-only"],
    brewMethods: ["espresso", "pour-over"],
    recommended: true,
    orderThis: "Filter, brewed one cup at a time, plus a bowl of the market's bread",
    summary:
      "A London institution beside Borough Market that has been brewing one cup at a time since long before it was fashionable.",
    review: `Monmouth predates the current London coffee scene by decades and has not
changed much in response to it. Filter is brewed to order, cup by cup, and the
queue snakes out into the market.

The roasting is darker and more chocolatey than the Nordic bars, which after a
week of pale filter is a relief rather than a compromise.

**Worth knowing:** it is standing-room and it is busy. Saturday mornings at
Borough are a poor plan unless the queue is part of the appeal.`,
    photos: [
      pooledPhoto("drip-coffee-bangkok", "Filter brewed one cup at a time"),
      pooledPhoto("the-magnetic-counter-01-8034827583", "Cups and glassware on the counter"),
    ],
    sample: true,
  },
  {
    slug: "prufrock-coffee",
    name: "Prufrock Coffee",
    neighborhood: "Leather Lane",
    city: "London",
    region: "Greater London",
    country: "United Kingdom",
    coords: [-0.1092, 51.5204],
    visits: ["2024-01-19"],
    rating: 4.5,
    priceBand: 2,
    tags: ["laptop-friendly", "quiet", "tea-program"],
    brewMethods: ["espresso", "pour-over", "batch-filter", "aeropress"],
    recommended: true,
    orderThis: "Espresso, then the same coffee as filter to compare",
    summary:
      "A training-room-turned-cafe on Leather Lane, and one of the few central London rooms where working all morning is genuinely fine.",
    review: `Prufrock started as much as a training space as a cafe, and it shows in how
methodically the bar is run. Most coffees are available both as espresso and as
filter, which makes side-by-side comparison easy and is the best reason to sit
down here.

The back of the room is quiet, has power, and nobody minds a laptop, which is
rarer in central London than it should be.`,
    photos: [
      pooledPhoto(
        "making-of-latte-art-of-cappuccino-on-coffee-right-in-brno-br",
        "Pouring latte art",
      ),
      pooledPhoto("drip-coffee-bangkok", "Pour-over setup on the bar"),
    ],
    sample: true,
  },

  // --- Continental Europe
  {
    slug: "the-barn-mitte",
    name: "The Barn",
    neighborhood: "Mitte",
    city: "Berlin",
    region: "Berlin",
    country: "Germany",
    coords: [13.4022, 52.5287],
    visits: ["2022-06-18"],
    rating: 4,
    priceBand: 2,
    tags: ["no-laptops", "quiet", "roaster-on-site"],
    brewMethods: ["espresso", "pour-over", "batch-filter"],
    recommended: true,
    orderThis: "Batch filter, no milk — they would rather you did not add any",
    summary:
      "Berlin's strictest filter bar. Famously opinionated house rules, and coffee good enough to justify them.",
    review: `The Barn has a reputation for house rules — no laptops, no large milk drinks,
opinions freely offered — and mostly earns it. The roasting is precise and the
filter program is the reason to come.

Taken in the right spirit it is enjoyable rather than annoying: this is a room
that has decided what it is for and does not negotiate.`,
    photos: [
      pooledPhoto(
        "figaro-coffee-shop-interior-in-salawag-dasmarin-as-cavite-19",
        "Cafe interior with stairs and window seating",
      ),
      pooledPhoto("beans-dropping-from-a-coffee-roaster", "Beans leaving the roaster"),
    ],
    sample: true,
  },
  {
    slug: "coffee-collective-godthabsvej",
    name: "Coffee Collective",
    neighborhood: "Frederiksberg",
    city: "Copenhagen",
    region: "Capital Region",
    country: "Denmark",
    coords: [12.5241, 55.6866],
    visits: ["2022-06-15"],
    rating: 4.5,
    priceBand: 2,
    tags: ["roaster-on-site", "laptop-friendly", "outdoor-seating"],
    brewMethods: ["espresso", "pour-over", "batch-filter"],
    recommended: true,
    orderThis: "The Kieni, if it is on — it usually is",
    summary:
      "A roastery bar built around direct-trade relationships, and one of the calmest places in Copenhagen to spend a morning.",
    review: `Coffee Collective publishes what it pays growers, which is still unusual, and
the sourcing story is genuinely the centre of the operation rather than
marketing around the edges.

The Godthåbsvej site has the roaster in the room, a long bar, and enough space
that it never feels like you are being turned over. Good filter, good espresso,
no theatre.`,
    photos: [
      pooledPhoto(
        "cappuccino-with-latte-art-on-coffee-right-in-brno-brno-city-",
        "Cappuccino with latte art",
      ),
      pooledPhoto("coffee-roaster-1", "Roaster in the middle of the room"),
    ],
    sample: true,
  },
  {
    slug: "santeustachio-il-caffe",
    name: "Sant'Eustachio Il Caffè",
    neighborhood: "Sant'Eustachio",
    city: "Rome",
    region: "Lazio",
    country: "Italy",
    coords: [12.4756, 41.8986],
    visits: ["2023-05-30"],
    rating: 4,
    priceBand: 1,
    tags: ["counter-only", "buzzy", "cash-only"],
    brewMethods: ["espresso", "moka"],
    recommended: true,
    orderThis: "Gran caffè, and tell them senza zucchero if you mean it",
    summary:
      "A Roman standing bar near the Pantheon where the espresso arrives pre-sweetened and whipped unless you say otherwise.",
    review: `An entirely different tradition from the Nordic bars: dark roast, tiny cup,
drunk standing at the counter in under two minutes. The house gran caffè is
whipped with sugar before it reaches you, which is the signature and also the
thing to decline if you want to taste the coffee.

Paying at the till first and then presenting the receipt at the bar is the
local choreography.

**Worth knowing:** sitting at a table costs several times what standing at the
bar does. This is normal and not a scam.`,
    photos: [
      pooledPhoto("cappuccino-latte-art-2006-04-14", "Espresso in a small cup"),
      pooledPhoto("juan-gris-le-moulin-a-cafe-google-art-project", "Coffee mill still life"),
    ],
    sample: true,
  },

  // --- North America
  {
    slug: "coava-coffee-grand",
    name: "Coava Coffee Roasters",
    neighborhood: "Central Eastside",
    city: "Portland",
    region: "Oregon",
    country: "United States",
    coords: [-122.6598, 45.5103],
    visits: ["2024-08-09"],
    rating: 4.5,
    priceBand: 2,
    tags: ["roaster-on-site", "laptop-friendly", "quiet", "dog-friendly"],
    brewMethods: ["espresso", "pour-over"],
    recommended: true,
    orderThis: "A Kone-brewed single origin",
    summary:
      "A roastery sharing a cavernous woodshop, with metal-filter pour-overs and a lot of daylight.",
    review: `Coava shares its building with a bamboo woodshop, so the room is enormous,
timber-lined, and full of light. Pour-overs are brewed through their own metal
cone, which gives a heavier, oilier cup than paper does — a useful contrast if
you have been drinking Nordic filter all week.

Plenty of table space and no hostility to laptops.`,
    photos: [
      pooledPhoto(
        "urban-bean-coffee-shop-uptown-minneapolis-17198299107",
        "Airy cafe interior with counter",
      ),
      pooledPhoto("beans-dropping-from-a-coffee-roaster", "Beans dropping from the roaster"),
    ],
    sample: true,
  },
  {
    slug: "heart-coffee-burnside",
    name: "Heart Coffee Roasters",
    neighborhood: "East Burnside",
    city: "Portland",
    region: "Oregon",
    country: "United States",
    coords: [-122.6503, 45.5227],
    visits: ["2024-08-10"],
    rating: 4,
    priceBand: 2,
    tags: ["laptop-friendly", "buzzy", "roaster-on-site"],
    brewMethods: ["espresso", "pour-over", "batch-filter"],
    recommended: false,
    orderThis: "An espresso — the light roast is the house argument",
    summary:
      "White-tiled Burnside corner room, Nordic-leaning roasting, and a permanent low hum of conversation.",
    review: `Founded by a Finnish former snowboarder, which explains the very pale roasting
in a city that otherwise leans darker. The espresso is bright to the point of
being divisive.

The room is bright white tile with big windows onto Burnside. It gets loud, and
seating fills up by mid-morning.`,
    photos: [
      pooledPhoto("hot-coffee-on-a-rainy-day-flickr-deapeajay", "Coffee on a wet morning"),
      pooledPhoto(
        "barista-prepares-espresso-at-coffee-shop",
        "Barista pulling a shot of espresso",
      ),
    ],
    sample: true,
  },
  {
    slug: "elm-coffee-roasters",
    name: "Elm Coffee Roasters",
    neighborhood: "Pioneer Square",
    city: "Seattle",
    region: "Washington",
    country: "United States",
    coords: [-122.3318, 47.5995],
    visits: ["2024-08-13"],
    rating: 4,
    priceBand: 2,
    tags: ["laptop-friendly", "quiet", "roaster-on-site"],
    brewMethods: ["espresso", "batch-filter", "cold-brew"],
    recommended: false,
    orderThis: "Batch filter and a canelé",
    summary:
      "A calm, pale-wood room in Pioneer Square — the quiet counterargument to Seattle's dark-roast reputation.",
    review: `Seattle's coffee reputation was built on dark roasting, and Elm is part of the
generation that went the other way. The room is pale wood and concrete, quiet
for a downtown cafe, and the batch filter is kept fresh rather than stewed.

A reasonable place to work through a morning, and a short walk from the ferry
terminal.`,
    photos: [
      pooledPhoto("cold-drip-coffee-2", "Cold brew served over ice"),
      pooledPhoto(
        "2019-11-08-inside-cafe-main-church-street-cromer",
        "Cafe interior with light wood seating",
      ),
    ],
    sample: true,
  },
  {
    slug: "cafe-avellaneda",
    name: "Café Avellaneda",
    neighborhood: "Coyoacán",
    city: "Mexico City",
    region: "Ciudad de México",
    country: "Mexico",
    coords: [-99.1637, 19.3496],
    visits: ["2023-11-22"],
    rating: 4.5,
    priceBand: 1,
    tags: ["counter-only", "buzzy", "quiet"],
    brewMethods: ["espresso", "pour-over", "aeropress", "siphon"],
    recommended: true,
    orderThis: "A Mexican single origin as filter — Veracruz or Chiapas",
    summary:
      "A tiny Coyoacán bar making the case for Mexican coffee, brewed about six different ways in a room the size of a kitchen.",
    review: `Barely bigger than a corridor, with a bar, a few stools, and a surprising
number of brew methods behind it. The focus is Mexican producers, which is
still less common than it should be in Mexico City's specialty cafes.

The neighbourhood does a lot of the work here — Coyoacán's plazas are two
minutes away and the coffee travels well in a cup.

**Worth knowing:** cash is easier than card, and seating is a handful of
stools.`,
    photos: [
      pooledPhoto(
        "mi-tierra-restaurant-san-antonio-now-serving-number-65",
        "Colourful pastry and coffee counter",
      ),
      pooledPhoto("cold-drip-coffee-2", "Cold drip coffee"),
    ],
    sample: true,
  },
  {
    slug: "st-johns-coffee-covington",
    name: "St. John's Coffeehouse",
    neighborhood: "Downtown",
    city: "Covington",
    region: "Louisiana",
    country: "United States",
    coords: [-90.1009, 30.4755],
    visits: ["2024-03-02"],
    rating: 3.5,
    priceBand: 1,
    tags: ["laptop-friendly", "dog-friendly", "outdoor-seating", "late-hours"],
    brewMethods: ["espresso", "batch-filter", "cold-brew"],
    recommended: false,
    orderThis: "Cold brew, given the humidity",
    summary:
      "A porch-and-ceiling-fan neighbourhood coffeehouse north of Lake Pontchartrain. Unhurried by design.",
    review: `Not a destination roaster and not trying to be — a small-town coffeehouse with
ceiling fans, a porch, and regulars who stay for hours. The coffee is decent
and the cold brew is the right answer in Louisiana humidity.

Included here as a reminder that the atlas is not only about pale Nordic
filter. Sometimes the room matters more than the roast.`,
    photos: [
      pooledPhoto(
        "the-st-john-s-coffee-shop-in-downtown-covington-louisiana-in",
        "Neighbourhood coffeehouse interior",
      ),
      pooledPhoto(
        "dscf1086-a-quiet-covered-wooden-walkway-lined-with-cozy-seat",
        "Covered porch seating",
      ),
    ],
    sample: true,
  },

  // --- Rest of world
  {
    slug: "truth-coffee-roasting",
    name: "Truth Coffee Roasting",
    neighborhood: "East City",
    city: "Cape Town",
    region: "Western Cape",
    country: "South Africa",
    coords: [18.4241, -33.9285],
    visits: ["2023-01-14"],
    rating: 4,
    priceBand: 2,
    tags: ["roaster-on-site", "buzzy", "great-view", "late-hours"],
    brewMethods: ["espresso", "pour-over", "cold-brew"],
    recommended: true,
    orderThis: "Espresso, upstairs, where you can watch the roaster work",
    summary:
      "Steampunk industrial theatre around a vintage roaster — the most deliberately staged room in the atlas, and it works.",
    review: `Committed, top-to-bottom steampunk: brass, leather, exposed ducting, and a
1940s roaster as the centrepiece. It could easily be all set dressing, but the
roasting operation underneath is real and the espresso holds up.

Sit on the upper level where you can see the roaster running.

**Worth knowing:** it is a tourist destination as much as a cafe, and priced
accordingly for Cape Town.`,
    photos: [
      pooledPhoto("moulin-a-cafe-peugeot-face", "Vintage brass coffee mill"),
      pooledPhoto("coffee-roaster-1", "Vintage drum roaster"),
    ],
    sample: true,
  },
  {
    slug: "nylon-coffee-roasters",
    name: "Nylon Coffee Roasters",
    neighborhood: "Everton Park",
    city: "Singapore",
    region: "Central Region",
    country: "Singapore",
    coords: [103.8385, 1.2769],
    visits: ["2024-04-20"],
    rating: 4.5,
    priceBand: 2,
    tags: ["counter-only", "roaster-on-site", "quiet"],
    brewMethods: ["espresso", "pour-over"],
    recommended: true,
    orderThis: "Filter of whatever lot they are most excited about",
    summary:
      "A shophouse roastery under public housing blocks, with no seating to speak of and a very short, very good list.",
    review: `Tucked into the ground floor of an Everton Park housing block, Nylon is small,
spare, and almost entirely standing. The list is short because the sourcing is
narrow and deliberate.

There is a bench outside and a lot of people leaning against walls with cups,
which is a large part of the charm.`,
    photos: [
      pooledPhoto("75-degrees-green-coffee", "Green coffee from a single lot"),
      pooledPhoto(
        "figaro-coffee-shop-interior-in-salawag-dasmarin-as-cavite-19",
        "Small cafe interior",
      ),
    ],
    sample: true,
  },
  {
    slug: "fritz-coffee-company",
    name: "Fritz Coffee Company",
    neighborhood: "Mapo",
    city: "Seoul",
    region: "Seoul Capital Area",
    country: "South Korea",
    coords: [126.9556, 37.5453],
    visits: ["2024-04-24"],
    rating: 4.5,
    priceBand: 2,
    tags: ["great-pastries", "buzzy", "roaster-on-site", "outdoor-seating"],
    brewMethods: ["espresso", "pour-over", "batch-filter"],
    recommended: true,
    orderThis: "A seasonal blend filter and a pain au chocolat",
    summary:
      "A restored hanok-adjacent building, a seal mascot, and a bakery good enough to rival the coffee.",
    review: `Fritz occupies a restored old building with a courtyard, and has built a
following on the strength of both the roasting and an unusually serious bakery.
The seal logo is everywhere and entirely unexplained.

The pastry counter is the differentiator — most specialty roasters treat baking
as an afterthought, and this one clearly does not.

**Worth knowing:** queues at weekends stretch into the courtyard. Weekday
mornings are calm.`,
    photos: [
      pooledPhoto(
        "gustav-wentzel-ktakaffe-lkm-000334-lillehammer-kunstmuseum",
        "Warm interior of an old cafe",
      ),
      pooledPhoto(
        "mi-tierra-restaurant-san-antonio-now-serving-number-65",
        "Bakery counter stacked with pastries",
      ),
    ],
    sample: true,
  },
  {
    slug: "cafe-cultor-bogota",
    name: "Café Cultor",
    neighborhood: "Chapinero",
    city: "Bogotá",
    region: "Cundinamarca",
    country: "Colombia",
    coords: [-74.0638, 4.6483],
    visits: ["2023-11-28"],
    rating: 4,
    priceBand: 1,
    tags: ["laptop-friendly", "quiet", "tea-program"],
    brewMethods: ["espresso", "pour-over", "aeropress", "moka"],
    recommended: true,
    orderThis: "A Nariño or Huila filter, brewed as pour-over",
    summary:
      "A Bogotá bar built on paying Colombian growers properly and keeping the good lots in the country.",
    review: `Colombia exports most of its best coffee, and Café Cultor exists partly to
argue against that. The list is entirely domestic, traceable, and priced to
make the point about what growers are paid.

The Chapinero room is quiet, a little academic, and comfortable for a long
sit — closer to a reading room than a cafe.`,
    photos: [
      pooledPhoto("unroasted-coffee", "Green Colombian coffee beans"),
      pooledPhoto(
        "urban-bean-coffee-shop-uptown-minneapolis-17198299107",
        "Cafe interior with counter seating",
      ),
    ],
    sample: true,
  },
];

/**
 * Validated at module load so a malformed entry fails immediately and
 * obviously, rather than rendering as a blank tile or a marker at [0, 0].
 */
export const SHOPS: CoffeeShop[] = RAW_SHOPS.map((shop) => {
  const parsed = coffeeShopSchema.safeParse(shop);
  if (!parsed.success) {
    throw new Error(
      `Invalid coffee shop entry "${shop.slug}": ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
});

const BY_SLUG = new Map(SHOPS.map((shop) => [shop.slug, shop]));

export function shopBySlug(slug: string): CoffeeShop | undefined {
  return BY_SLUG.get(slug);
}
