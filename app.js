'use strict';

//Set up express
const express = require('express');
const { url, waitForDebugger } = require('inspector');
const { isMapIterator } = require('util/types');
const app = express();
const request = require('request');
const { emit } = require('process');
const { get } = require('request');
const { start } = require('repl');

//Setup socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server);

//Start server
if (module === require.main) {
  startServer();
}

module.exports = server;

function startServer() {
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

//Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

//Handle client interface on /
app.get('/', (req, res) => {
  res.render('index');
});

//Handle display interface on /display
app.get('/display', (req, res) => {
  res.render('displayInfo');
});

//=====================GLOBAL-VARIABLES-BEGIN======================//
let control;
let nextAccountNumber = 0;

let display = io;
let accounts = new Map();

let socketsToUsernames = new Map();
let usernamesToSockets = new Map();

let state = { state: 1 }

var newPrompts = new Map(); //The prompts found by the users, deleted if they're used
var toAddPrompts = new Map();
var randomPrompts = new Map();
var totalPromptsTemp = new Map();
var totalPrompts = new Map();
var answersReceived = new Map();
let promptID = 1;

let allChoices = new Map();
let votes = new Map();
let currentVote = 0;
let currentRound = 0;

let roundScores = new Map();
let totalScores = new Map();

//======================GLOBAL-VARIABLES-END=======================//

//===========================AZURE-BEGIN===========================//
//Player/Register (make it call and return the azure functions)
function handleRegister(username, password, socket) {

  var payload = '{"username" : "' + username + '", "password" : "' + password + '" }';

  const options = { url: "https://quiplash-idm1u19.azurewebsites.net/api/register_player?", method: "POST", headers: { "x-functions-key": "bMgJuSXL2ExoX5aA0AyidOJsQaxc6Loai6vsZvEjqOKuQfdewRCR1Q==" }, json: JSON.parse(payload) };

  request(options, function (err, res, body) {
    console.log(res.statusCode, body);

    if (body.result == true) {
      handleJoinGame(username, socket);
      updateAll();
    } else {
      error(socket, body.msg, false);
    }
  });
}

//Player/Login (make it call and return the azure functions)
function handleLogin(username, password, socket) {

  var payload = '{"username" : "' + username + '", "password" : "' + password + '" }';

  const options = { url: "https://quiplash-idm1u19.azurewebsites.net/api/login_player?", method: "GET", headers: { "x-functions-key": "bMgJuSXL2ExoX5aA0AyidOJsQaxc6Loai6vsZvEjqOKuQfdewRCR1Q==" }, json: JSON.parse(payload) };

  request(options, function (err, res, body) {
    console.log(res.statusCode, body);

    if (body.result == true) {
      handleJoinGame(username, socket);
      updateAll();
    } else {
      error(socket, body.msg, false);
    }
  });
}

//Player/Update (make it call and return the azure functions)
function handlePlayerUpdate(username, password, games_played, score) {
}

//Prompt/Create (make it call and return the azure functions)
function handlePromptCreate(username, password, text) {

  var payload = '{"username" : "' + username + '", "password" : "' + password + '", "text" : "' + text + '" }';

  const options = { url: "https://quiplash-idm1u19.azurewebsites.net/api/create_prompt?", method: "POST", headers: { "x-functions-key": "bMgJuSXL2ExoX5aA0AyidOJsQaxc6Loai6vsZvEjqOKuQfdewRCR1Q==" }, json: JSON.parse(payload) };

  request(options, function (err, res, body) {
    console.log(res.statusCode, body);

    if (body.result != true) {
      error(usernamesToSockets.get(username), body.msg, false);
    }
  });
}

//Prompt/Edit (make it call and return the azure functions)
function handlePromptEdit(username, password, id, text) {
}

//Prompt/Delete (make it call and return the azure functions)
function handlePromptDelete(username, password, id) {
}

//Prompt/Get (make it call and return the azure functions)
function handlePromptGet(accounts) {
}

//Prompt/GetRandom
function handlePromptGetRandom(n) {

  var payload = '{"n" : ' + n + '}';

  const options = { url: "https://quiplash-idm1u19.azurewebsites.net/api/get_random_prompt", method: "GET", headers: { "x-functions-key": "bMgJuSXL2ExoX5aA0AyidOJsQaxc6Loai6vsZvEjqOKuQfdewRCR1Q==" }, json: JSON.parse(payload) };

  randomPrompts = new Map();

  request(options, function (err, res, body) {
    if (!err) {

      for (var i = 0; i < body.length; i++) {
        randomPrompts.set(JSON.stringify({ username: body[i].username, id: promptID }), { prompt: body[i].text, id: promptID });
        promptID++;
      }

      control.emit('again', 'sendPrompts');
    }
  });
}
//============================AZURE-END============================//

//==========================HANDLES-BEGIN==========================//
//Add a player socket to the game
function handleJoinGame(username, socket) {

  if (usernamesToSockets.has(username)) {
    if (control == usernamesToSockets.get(username)) {
      control.emit('losecontrol');
      control = socket;
      socket.emit('control');
    }
    error(usernamesToSockets.get(username), "cannot be connected on 2 devices", true);
    usernamesToSockets.set(username, socket);
    socketsToUsernames.delete(socket);
    socketsToUsernames.set(socket, username);
    updateAll();

    return;
  } else {
    nextAccountNumber++;
  }

  //Will be entered as Spectator if the game is full
  if (nextAccountNumber > 9 || state.state > 1) {
    console.log('Welcome to the spectators ' + username);
    accounts.set(username, { role: 'spectator', username: username, state: 1, score: 0 });
  } else {
    //Gets added as a player otherwise
    console.log('Welcome to quiplash ' + username);
    accounts.set(username, { role: 'player', username: username, state: 1, score: 0 });
    if (nextAccountNumber == 1) {
      console.log(username + " is in control of the game");
      control = socket;
      control.emit('control');
    }
  }
  usernamesToSockets.set(username, socket);
  socketsToUsernames.set(socket, username);
}

//Removes a player socket from the game
function handleQuit(socket) {
}

//Handles answers
function handleAnswer(username, prompt, answer) {

  console.log("user " + username + " sends answer " + answer + " for prompt " + prompt.prompt);

  if (answersReceived.get(JSON.stringify({ prompt: prompt, n: 0 })) == undefined) {
    answersReceived.set(JSON.stringify({ prompt: prompt, n: 0 }), { username: username, answer: answer });
  } else {
    answersReceived.set(JSON.stringify({ prompt: prompt, n: 1 }), { username: username, answer: answer });
  }
}

//Makes a list of all the possible choices being presented
function makeVotingMap() {

  let count = 0;

  for (const [user, prompt] of totalPrompts) {

    var choice = { prompt: prompt, first: { answer: '', username: '' }, second: { answer: '', username: '' } };

    choice.prompt = prompt;
    choice.first = answersReceived.get(JSON.stringify({ prompt: prompt, n: 0 }));
    choice.second = answersReceived.get(JSON.stringify({ prompt: prompt, n: 1 }));

    if (choice.first == undefined) { //If no answer was submitted, we input a placeholder one
      choice.first = { answer: 'bears, but worst', username: 'quiplash' }
    }
    if (choice.second == undefined) { //If no answer was submitted, we input a placeholder one
      choice.second = { answer: 'bears, but worst', username: 'quiplash' }
    }

    allChoices.set(count, choice);

    count++;
  }

  console.log(allChoices.get(currentVote));
}

//Handles receiving a vote from a user
function handleVoting(username, n) {

  console.log(username + " voted for " + n)
  votes.set(username, n);
  ready(username);

  if (votes.size >= accounts.size) {
    advanceGameState();
  }

  sendChoice(currentVote);
}

//Send choices
function sendChoice(n) {

  io.emit('choice', JSON.parse(JSON.stringify(allChoices.get(n))));
}

function handleNewPrompts(username, password, prompt, socket) {
  if (prompt.length < 10) {
    error(socket, 'prompt is less than 10 characters', false);
    console.log('prompt rejected (too small)');
  } else if (prompt.lenght > 100) {
    error(socket, 'prompt is more than 100 characters', false);
    console.log('prompt rejected (too big)');
  } else {

    newPrompts.set(JSON.stringify({ username: username, id: promptID }), { prompt: prompt, id: promptID });
    toAddPrompts.set(JSON.stringify({ username: username, password: password, id: promptID }), prompt);
    promptID++; //Only relevant if 2 prompts are the same
    ready(socketsToUsernames.get(socket));

    console.log('prompt "' + prompt + '" from ' + username + ' accepted');
  }
}

//==========================HANDLES-END============================//
//Takes a random element away from activePrompts and returns in
function takeFromTotalPromptsTemp() {

  let key = getRandomKey(totalPromptsTemp);

  let el = totalPromptsTemp.get(key);

  totalPromptsTemp.delete(key);

  return el;
}

function sendPrompts() {

  totalPromptsTemp = new Map(randomPrompts);

  console.log(totalPromptsTemp);

  var total = getPlayers().size;
  var even = false;

  if (total % 2 == 0) {
    total /= 2;
    even = true;
  }

  //Fills in the remaining need prompts with our new prompts
  for (let [key, val] of getNFromMap(total - totalPromptsTemp.size, newPrompts)) {
    totalPromptsTemp.set(key, val);
  }

  totalPrompts = new Map(totalPromptsTemp);
  console.log(totalPrompts);

  //Makes sure there are no holes, so that we can distributed prompts easier
  var playerSockets = new Map();

  var counter = 0;

  for (let [key, socket] of getPlayerSockets()) {
    counter++;
    playerSockets.set(counter, socket);
  }

  //Gives the prompts away
  if (!even) {//For uneven player groups
    for (let i = 1; i <= total; i++) {

      var prompt = takeFromTotalPromptsTemp();

      if (i == total) {
        playerSockets.get(i).emit('prompt', prompt);
        console.log('prompt ' + prompt.prompt + ' sent to ' + socketsToUsernames.get(playerSockets.get(i)));
        playerSockets.get(1).emit('prompt', prompt);
        console.log('prompt ' + prompt.prompt + ' sent to ' + socketsToUsernames.get(playerSockets.get(1)));
      } else {
        playerSockets.get(i).emit('prompt', prompt);
        console.log('prompt ' + prompt.prompt + ' sent to ' + socketsToUsernames.get(playerSockets.get(i)));
        playerSockets.get(i + 1).emit('prompt', prompt);
        console.log('prompt ' + prompt.prompt + ' sent to ' + socketsToUsernames.get(playerSockets.get(i + 1)));
      }
    }
  } else { //For even player groups
    for (let i = 0; i <= total; i += 2) {

      var prompt = takeFromTotalPromptsTemp();

      playerSockets.get(i + 1).emit('prompt', prompt);
      console.log('prompt ' + prompt.prompt + ' sent to ' + socketsToUsernames.get(playerSockets.get(i + 1)));
      playerSockets.get(i + 2).emit('prompt', prompt);
      console.log('prompt ' + prompt.prompt + ' sent to ' + socketsToUsernames.get(playerSockets.get(i + 2)));
    }
  }

  resetAll();
}

// --> Maybe all of these should reset the player states to 0 everytime <---
//==========================STATES-BEGIN===========================//
//Start round
function startRound() {
  votes = new Map();
  allChoices = new Map();
  answersReceived = new Map();
  roundScores = new Map();
  newPrompts = new Map();
  randomPrompts = new Map();
  promptID = 1;
  currentVote = 0;
  currentRound++;
}

//Starts the prompts section
function startPrompts() {
  console.log('Starting Prompt section');
  startRound();
  resetAll();
}

//End the prompts section
function endPrompts() {
  console.log('Ending Prompt section');
}

//Starts the answers section
function startAnswers() {

  console.log('Starting Answer section');

  var total = getPlayers().size;
  var even = false;

  if (total % 2 == 0) {
    total /= 2;
    even = true;
  }

  var half = Math.ceil(total / 2);

  handlePromptGetRandom(half);
}

//Ends the answers section
function endAnswers() {
  console.log('Ending Answer section');
  currentVote = 0;
}

//Starts the voting section
function startVoting() {
  console.log('Starting Voting section');

  makeVotingMap();
  sendChoice(currentVote);

  resetAll();
  updateAll();
}

//Ends the voting section
function endVoting() {
  console.log('Ending Voting section');
}

//Starts the results section
function startResults() {
  console.log('Starting Results section');
  readyAll();

  var firstAnswer = [];
  var secondAnswer = [];

  let user1 = allChoices.get(currentVote).first.username;
  let user2 = allChoices.get(currentVote).second.username;

  var score1 = 0;
  var score2 = 0;

  for (let [username, n] of votes) {

    if (n == 0) {
      firstAnswer.push(username);
      score1 += 100 * currentRound;
    } else {
      secondAnswer.push(username);
      score2 += 100 * currentRound;
    }

    roundScores.set(user1, score1);
    roundScores.set(user2, score2);
  }

  if (totalScores.get(user1) == undefined) {
    totalScores.set(user1, roundScores.get(user1));
  } else {
    totalScores.set(user1, totalScores.get(user1) + score1);
  }
  if (totalScores.get(user2) == undefined) {
    totalScores.set(user2, roundScores.get(user2));
  } else {
    totalScores.set(user2, totalScores.get(user2) + score2);
  }

  console.log("total score of " + user2 + " now " + totalScores.get(user2));
  console.log("total score of " + user1 + " now " + totalScores.get(user1));

  display.emit('results', 5);
  display.emit('results', { firstChoice: { candidate: user1, score: score1, voters: firstAnswer }, secondChoice: { candidate: user2, score: score2, voters: secondAnswer } });
}

//Ends the results section
function endResults() {
  console.log('Ending Results Section');
}

//Starts the scores section
function startScores() {
  console.log('Starting Scores section');

  var highScore = 0;
  var json = []

  for (let [username, score] of totalScores) {
    if (score >= highScore) {
      highScore = score;
    }
  }
  for (let [username, score] of totalScores) {
    if (score == highScore) {
      var result = { username: username, score: score, first: 1 };
      json.push(result);
    } else {
      var result = { username: username, score: score, first: 0 };
      json.push(result);
    }
  }
  display.emit('scores', json);
  readyAll();
  updateAll();
}

//Ends the scores section
function endScores() {
  console.log('Ending Scores section');

}

//Starts the gameover section
function startGameOver() {
  console.log('Starting Gameover section');
  resetAll();

  let accounts = new Map();

  let socketsToUsernames = new Map();
  let usernamesToSockets = new Map();

  let state = { state: 1 }

  var newPrompts = new Map(); //The prompts found by the users, deleted if they're used
  var toAddPrompts = new Map();
  var randomPrompts = new Map();
  var totalPromptsTemp = new Map();
  var totalPrompts = new Map();
  var answersReceived = new Map();
  let promptID = 1;

  let allChoices = new Map();
  let votes = new Map();
  let currentVote = 0;
  let currentRound = 0;

  let roundScores = new Map();
  let totalScores = new Map();

  for (let [key, prompt] of toAddPrompts) {
    var info = JSON.parse(key);
    console.log('adding "' + prompt + '" from ' + info.username + ' : ' + info.password);
    handlePromptCreate(info.username, info.password, prompt);
  }
  state.state = 0;
  updateAll();
  control.emit('loseControl');
  control = null;
}

function advanceGameState() {

  state.state++;

  switch (state.state) {
    case 2:
      startPrompts();
      break;
    case 7:
    case 12:
      endScores();
      startPrompts();
      break;
    case 3:
    case 8:
    case 13:
      endPrompts();
      startAnswers();
      break;
    case 4:
    case 9:
    case 14:
      endAnswers();
      startVoting();
      break;
    case 5:
    case 10:
    case 15:
      endVoting();
      startResults();
      break;
    case 6:
    case 11:
    case 16:
      endResults();

      currentVote++;
      votes = new Map();

      if (currentVote < allChoices.size) {
        state.state -= 3;
        resetAll();
        startVoting();
        break;
      }

      startScores();
      break;
    case 17:
      endScores();
      startGameOver();
      break;
  }
}

//===========================STATES-END============================//

//========================CONNECTIONS-BEGIN========================//
//Handle new connection
io.on('connection', socket => {

  console.log('New connection');

  //Handles registering
  socket.on('register', payload => {
    console.log('attempted register from ' + payload.username);
    handleRegister(payload.username, payload.password, socket);
  });

  //Handles logins
  socket.on('login', payload => {
    console.log('attempted login from ' + payload.username);
    handleLogin(payload.username, payload.password, socket);
  });

  //Handles player updates
  socket.on('playerUpdate', payload => {
    handlePlayerUpdate(payload.username, payload.password, payload.games_played, payload.score);
  })

  //Handles the leaderboard
  socket.on('leaderboard', top => {
    handleLeaderboard(top);
  });

  //Handles creation of prompts
  socket.on('prompt', payload => {
    console.log('received prompt from ' + payload.username);
    handleNewPrompts(payload.username, payload.password, payload.text, socket);
  });

  //Handles answers
  socket.on('answer', payload => {
    console.log('received answer "' + payload.answer + '" from ' + payload.username);
    handleAnswer(payload.username, payload.prompt, payload.answer);
  });

  //Handles votes
  socket.on('vote', payload => {
    handleVoting(payload.username, payload.n);
  });

  //Handles next
  socket.on('next', () => {
    if (socket == control) {
      advanceGameState();
    }
  });

  //Handles ready
  socket.on('ready', () => {
    ready(socketsToUsernames.get(socket));
  });

  //Handle disconnection
  socket.on('disconnect', () => {
    console.log('Dropped connection');
    handleQuit(socket);
  });

  //Sends the prompts (for real this time)
  socket.on('sendPrompts', () => {
    sendPrompts();
  });

  //Receives the display
  socket.on('display', () => {
    console.log('switched to new display');
    display = socket;
    updateAll();
  });
});
//=========================CONNECTIONS-END=========================//

//Updates all connected sockets
function updateAll() {
  for (let [socket, username] of socketsToUsernames) {
    const accountData = accounts.get(username);
    const data = { state: state.state, me: accountData, players: Object.fromEntries(getPlayers()) };
    socket.emit('state', data);
  }
  const data = { state: state.state, players: Object.fromEntries(getPlayers()), spectators: Object.fromEntries(getSpectators()) }
  display.emit('state', data);
}

//Returns the players currently in the game
function getPlayers() {

  var players = new Map();
  for (let [key, account] of accounts) {
    if (account.role == 'player') {
      players.set(key, account);
    }
  }

  return players;
}

//Returns the spectators watching the game
function getSpectators() {

  var spectators = new Map();
  for (let [key, account] of accounts) {
    if (account.role == 'spectator') {
      spectators.set(key, account);
    }
  }

  return spectators;
}

function getPlayerSockets() {

  var sockets = new Map();

  for (let [key, account] of accounts) {
    if (account.role == 'player') {
      sockets.set(key, usernamesToSockets.get(key));
    }
  }

  return sockets;
}

//Resets all account states to 0 (yet to complete task)
function resetAll() {
  for (let [socket, username] of socketsToUsernames) {
    accounts.get(username).state = 0;
    socket.emit('reset');
  }
  updateAll();
}

//Sets all account states to 1 (task completed)
function readyAll() {
  for (let [socket, username] of socketsToUsernames) {
    accounts.get(username).state = 1;
    socket.emit('ready');
  }
  updateAll();
}

//Sets account state to 1 (completed task)
function ready(username) {
  accounts.get(username).state = 1;
  usernamesToSockets.get(username).emit('ready');
  updateAll();
}

//Handles errors
function error(socket, message, halt) {
  console.log('Error: ' + message);
  socket.emit('fail', message);
  if (halt) {
    socket.disconnect();
  }
}

//Returns random key from Set or Map
function getRandomKey(collection) {
  let keys = Array.from(collection.keys());
  return keys[Math.floor(Math.random() * keys.length)];
}

//Returns n random elements from a given map
function getNFromMap(n, oldMap) {

  let map = new Map();

  for (var i = 0; i < n; i++) {

    let key = getRandomKey(oldMap);

    map.set(key, oldMap.get(key));

    oldMap.delete(key);
  }

  return map;
}