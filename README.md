# Gamejay Bot

A combination Telegram Bot plus Server for Gamejay web-based games.

The games are designed for drop-in functionality and minimal friction to learn and play. Largely inspired by the games featured in GamePigeon, an iOS Messages games app.

# To Develop

## Structure and Flow
This repository holds the combined code for the Telegram bot and the server that hosts the bot's webhook and, more importantly, the API for processing games and running their backend logic.

### [@gamejaybot](https://t.me/gamejaybot) Telegram Bot

The code for the Telegram bot is in `src/bot.ts`. This is all dedicated to processing commands and responses sent to the bot. It defines the inline query logic for getting a list of all the registered games in any chat, without the need to add the bot to the chat.

If in development, it also starts the bot's polling for commands/responses, as opposed to using the [more efficient webhook system](https://grammy.dev/guide/deployment-types.html).

### gamejay Server

The code for the gamejay server is under `src/server`. This is where most of the work is done. `server.ts` starts the server, sets up all the API routing chunks for every game (imported from other files for organizational purposes), and does some other custodial stuff like setting up the API docs page. If in production, it also imports the Telegram bot and sets the webhook to point to the server so the bot can run in webhook mode.

`src/server/routes.ts` contains routes that are common to all games; things like turn-logic and scoring

For each supported game, there will be a folder under `src/server` that contains routes and logic specific to that game.

### The Actual Games

Each game is intended to be a completely separately hosted website. This backend server will handle sending the right URL for the requested game to the user, and will process the game logic for each session of each game. Every game's site should have a URL that points back to this server so that it knows where to send the updates for the game session.

## Environment
 - Should run on the latest LTS `node` version (if it doesn't, please update and make a PR!)
 - Copy the `.example-env` to `.env` in the root and remove comments/update env values to whatever fits your needs
 - Make sure the URLs that are meant to point to the web-games are valid (otherwise this Bot won't know what to send when users request a game)

## Dev-Ops
 - There is a `.prettierrc` file for code formatting, which I recommend using.
 - There is a `captain-definition` file for deploying to [Caprover](https://caprover.com/), which is what I use to manage my node apps on my server. It's awesome, and if you wanna spin up your own server, you shouldn't really have to change anything there. It reads the `Dockerfile` and uses it to totally set up the environment for the app to run in.
 - There is also an `ecosystem.config.js` for deploying using [pm2](https://pm2.keymetrics.io/), but I don't really use that now that I use Caprover.

## Start Development Server
 - Tell `nodemon` to spin up a local server in watch mode that can run the typescript source code directly
```sh
npm run dev
``` 
 - You can then take the URL that the server prints out after starting and set that as the backend URL (port included) on all the game sites that you host locally.

## Build & Deploy
 - Transpile and build the app to the `dist` directory
```sh
npm run build
```
 - Then run the built app
```sh
npm start
``` 
