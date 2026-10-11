# 🏡 Shreya's Dream House

Two ways to visit the house:

- **💖 Dream Craft** (new): the house rebuilt as a multiplayer block world. Build together, drive off-road cars and play 10 mini-games with someone far away.
- **The 3D tour** (original): the three.js house with Shreya's guided tour, in `index.html` / `main.js`.

---

## 💖 Dream Craft

A block-game version of the dream house for two (up to 8). It is the original floor plan turned into blocks, one block for every 12 plan pixels: every room, the stairs up to the roof terrace, the pool, the gardens, the balcony and the Chocolate House.

### What you can do
- **Build together:** break and place 77 kinds of blocks. Changes show up live for everyone and are saved, so your builds are still there next time.
- **Drive off-road cars 🚙:** two jeeps in the parking, a monster truck that climbs 2-block walls, and a pink Love Buggy. Each one has a **driver and a passenger seat**, so you can ride together. Hit the ramps in the **Off-road Park** to get air.
- **Bump into each other:** players push apart, cars shove each other, and a moving car knocks people flying.
- **Be cute:** emotes (💖 hearts, 😘, 👋, 😂, 💃), chat, a teleport-to-partner button, day and night, and first- or third-person camera.
- **Play 10 mini-games:**

| Game | |
|---|---|
| 🏃 Pakdam Pakdai | Tag. Whoever spends the least time as "it" wins |
| 🙈 Hide & Seek | The seeker's screen goes black while everyone hides in the house |
| 🪙 Coin Rush | Coins and hearts are hidden all over the house. Collect the most |
| ❄️ Snowball Fight | First to 10 hits |
| 🧗 Sky Parkour | Race over floating blocks, with gold checkpoints |
| ⛏️ Spleef | Dig the snow out from under your partner |
| ⭕ Giant Tic-Tac-Toe | On a board in the garden. First to 3 rounds |
| 🃏 Memory Match | 16 giant cards to flip |
| 🎨 Draw & Guess | One draws, the other guesses |
| 💞 How Well Do You Know Me? | Answer about yourself, then guess your partner's answers |

### Controls
| | Desktop | Phone |
|---|---|---|
| Move / look | WASD + mouse (click to capture the mouse) | Left joystick, drag on the right |
| Jump · sprint · fly | Space · Shift · F (Space up, Shift down) | ⬆️ · push the stick all the way · Fly button |
| Break · place · copy block | Left · right · middle click | ⛏️ · 🧱 |
| Blocks · hotbar | E · 1-9 or mouse wheel | Blocks button |
| Get in or out of a car | E (when you're next to one) | Drive button |
| Drive | W/S, A/D, Shift for nitro, Space to brake, R to reset the car | Joystick |
| Games · chat · hearts · camera | G · T · H · V | Buttons at the top |

### Run it locally
You need Node 20 or newer.

```bash
npm run install:all
npm run dev
```

Open http://localhost:5173. Your partner can join from the same Wi-Fi at `http://<your-computer's-IP>:5173`.

### Play over the internet (long distance)
The backend also serves the built game, so one server is all you need:

```bash
npm run build
npm start
```

That serves everything on port 5050. To share it from your own computer, open a tunnel, for example:

```bash
npx cloudflared tunnel --url http://localhost:5050
```

To keep it running, deploy to any Node host (Render, Railway, Fly.io):
- Build command: `npm run install:all && npm run build`
- Start command: `npm start`
- Set `DATA_DIR` to a persistent disk if you want builds to survive redeploys (see `backend/.env.example`).

Then press **Invite** in the game and send your partner the link.

### How it is put together
The layout follows the infographic-ai project: an Express backend split into config, routes, controllers, services and middlewares, and a React app with `axios/`, `lib/`, `store/` (Redux Toolkit + redux-persist) and `components/`.

```
shared/              Used by both sides: block list, world generator, game catalogue
  blocks.js            all 80 blocks (ids are the save format; only add at the end)
  world.js             terrain, the house from the floor plan, arenas, car spawns
  games.js             the 10 games and the avatar options
backend/             Express 5 + socket.io
  index.js             HTTP, socket.io, and serving frontend/dist in production
  routes/ controllers/ REST: create a room, look one up, list games
  sockets/index.js     realtime: join, move, blocks, chat, emotes, cars, games
  services/            rooms, world edits (+ saving to disk), cars, the game runner
  games/               one file of rules per mini-game (the server is the referee)
  tests/smoke.test.js  two clients playing through rooms, blocks, games and cars
frontend/            Vite + React + Tailwind + three.js
  src/engine/          voxel mesher, textures painted in code, physics, avatars, cars
  src/games/           the in-world side of each game (coins, snowballs, cards…)
  src/components/      HUD, lobby, game panels
  src/pages/           Lobby and Play
```

Only block changes travel over the network. Both sides generate the same world from `shared/world.js`, so a room's save file is just the list of blocks you changed. Saves go in `backend/data/rooms/`.

```bash
npm test   # backend smoke test
```

---

## The original 3D tour

An interactive 3D dream house built with [three.js](https://threejs.org/), with a guided tour by **Shreya**.

- **🎮 Play as Shreya:** keyboard, on-screen joystick, click-to-walk, drag her anywhere, and a **Go to…** menu
- **🚙 Off-road jeep**, a big open world, the **🍫 Chocolate House**, and a guided tour with voice
- **Rooms:** 4 bedrooms, living hall, kitchen, gaming room, walk-in closet, 2 bathrooms, 2 toilets, a pool, gardens, parking, a balcony, a terrace garden and a roof terrace
- **2D plan:** the original colour floor plan is at [`plan.html`](plan.html)

Run it with `npx http-server -p 8080` and open http://localhost:8080.

Files: `index.html` (page and UI), `main.js` (the scene and tour), `plan.html` (the 2D plan).
