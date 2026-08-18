// Seeds an e2e test user, design, and forged session for browser testing.
// Prints JSON: { designId, cookieValue }
import pg from "pg";
import crypto from "crypto";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task456-user";
const EMAIL = "e2e-task456@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

// Two artboards side by side so we can test empty space between them.
const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40, align: "start", justify: "start" },
    displayName: "AstryxSection",
    custom: {},
    parent: null,
    hidden: false,
    nodes: ["artboard-1", "artboard-2"],
    linkedNodes: {},
  },
  "artboard-1": {
    type: { resolvedName: "AstryxArtboard" },
    isCanvas: true,
    props: { label: "Screen 1", width: 390, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["button-1"],
    linkedNodes: {},
  },
  "button-1": {
    type: { resolvedName: "AstryxButton" },
    isCanvas: false,
    props: { children: "Click me", variant: "primary" },
    displayName: "AstryxButton",
    custom: {},
    parent: "artboard-1",
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  "artboard-2": {
    type: { resolvedName: "AstryxArtboard" },
    isCanvas: true,
    props: { label: "Screen 2", width: 390, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 456', 'native') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)],
);
const designId = res.rows[0].id;

// Forge an express-session row + signed connect.sid cookie.
const sid = crypto.randomBytes(16).toString("hex");
const expire = new Date(Date.now() + 24 * 3600 * 1000);
const sess = {
  cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  passport: { user: { id: USER_ID, email: EMAIL } },
};
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify(sess), expire],
);

const secret = process.env.SESSION_SECRET;
const hmac = crypto.createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
const cookieValue = "s:" + sid + "." + hmac;

console.log(JSON.stringify({ designId, cookieValue }));
await client.end();
