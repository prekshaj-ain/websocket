const http = require("http");
const express = require("express");
const { client } = require("websocket");
const app = express();

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/View/index.html");
});

app.listen(3000, () => {
  console.log("listening on 3000");
});

const webSocket = require("websocket").server;

const server = http.createServer((req, res) => {
  console.log("request recieved on", req.url);
});

const webSocketServer = new webSocket({
  httpServer: server,
});

const clients = {};
const games = {};
// When a client sends a WebSocket request to the server, this event will be triggered.
webSocketServer.on("request", (request) => {
  const connection = request.accept(null, request.origin);
  connection.on("close", () => {
    console.log("CLOSED!!");
  });
  connection.on("message", (message) => {
    // message recieved from client
    const result = JSON.parse(message.utf8Data);
    if (result.method == "create") {
      const clientId = result.clientId;
      const gameId = Date.now();
      games[gameId] = {
        id: gameId,
        balls: 20,
      };
      const payload = {
        method: "create",
        game: games[gameId],
      };

      clients[clientId].connection.send(JSON.stringify(payload));
    } else if (result.method == "join") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];
      if (game?.clients?.length >= 3) {
        return;
      }
      const color =
        game?.clients && game.clients.length > 0
          ? { 0: "red", 1: "blue", 2: "green" }[game.clients.length]
          : "red";
      if (game.clients) {
        game.clients.push({ clientId, color });
      } else {
        game.clients = [{ clientId, color }];
      }
      if (game.clients.length === 3) {
        updateGameState();
      }
      const payload = {
        method: "join",
        game,
      };
      // loop through all the clients in the game and tell them someone has joined
      game.clients.forEach((client) => {
        clients[client.clientId].connection.send(JSON.stringify(payload));
      });
    } else if (result.method == "play") {
      const gameId = result.gameId;
      const clientId = result.clientId;
      const ballId = result.ballId;
      const color = result.color;
      const game = games[gameId];
      let state = game?.state ?? {};

      state[ballId] = color;
      game.state = state;
    }
  });

  //   generate a new id from every client
  const clientId = Date.now();
  clients[clientId] = {
    connection,
  };

  const payload = {
    method: "connect",
    clientId: clientId,
  };
  connection.send(JSON.stringify(payload));
});

server.listen(8080, () => {
  console.log("server is listening on port 8080");
});

function updateGameState() {
  for (let g of Object.keys(games)) {
    games[g]?.clients?.forEach((c) => {
      const payload = {
        method: "update",
        game: games[g],
      };
      clients[c.clientId].connection.send(JSON.stringify(payload));
    });
  }
  setTimeout(updateGameState, 500);
}
