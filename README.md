# Gamejay Bot

A combination Telegram Bot plus Server for Gamejay web-based games.

The games are designed for drop-in functionality and minimal friction to learn and play. Largely inspired by the games featured in GamePigeon, an iOS Messages games app.

## Environment
 - Should run on the latest LTS `node` version (if it doesn't, please update and make a PR!)
 - Copy the `.example-env` to `.env` in the root and remove comments/update env values to whatever fits your needs
 - Make sure the URLs that are meant to point to the web-games are valid (otherwise this Bot won't know what to send when users request a game)

## How to Build & Deploy
 - `npm run build` to transpile and build the app to the `dist` directory
 - `npm start` to run the built app

## How to Develop
 - `npm run dev` to use nodemon to spin up a local server in watch mode that can run the typescript source code directly