# 🏡 Shreya's Dream House

An interactive 3D dream house built with [three.js](https://threejs.org/), with a guided tour by **Shreya**.

## Features
- **Guided tour:** Shreya walks through every room, climbs the stairs and talks about each space (speech uses your browser's voice).
- **Rooms:** 4 bedrooms, living hall, kitchen, gaming room, walk-in closet, 2 bathrooms, 2 toilets, a swimming pool, front and back gardens, parking, a balcony and a terrace garden.
- **Appliances and decor:** fridge, hob with chimney, microwave, dishwasher, water purifier, washing machine, ACs, TVs, a gaming PC, arcade machines, a pool table, a piano, a swing set, a car, solar panels and more.
- **Roof terrace:** a flat cement roof with parapet walls, a stair room, a water tank, solar panels and seating. Shreya ends the tour up there.
- **Views:** full house, first floor, ground floor, plus a day/night mode.
- **2D plan:** the original colour floor plan is at [`plan.html`](plan.html).

## Run locally
The page uses ES modules, so serve the folder rather than double-clicking the file:

```bash
npx http-server -p 8080
```

Then open http://localhost:8080.

## Files
- `index.html`: the page, UI and styles
- `main.js`: the whole 3D scene, Shreya and the tour script
- `plan.html`: the 2D floor plan
