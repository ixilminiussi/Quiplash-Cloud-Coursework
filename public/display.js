var socket = null

//Prepare game
var app = new Vue({
    el: '#display',
    data: {
        error: null,
        state: { state: false },
        players: {}, // WITHOUT passwords
        spectators: {},
        prompt: { prompt: '', username: '' },
        choices: { first: { answer: '', username: '' }, second: { answer: '', username: '' } },
        votes: { first: { voters: [], score: 0 }, second: { voters: [], score: 0 }},
        scores: []
    },
    mounted: function () {
        connect();
    },
    methods: {
        takeDisplay() {
            socket.emit('display');
        },
        init() { //Resets the values and sets connected state
            this.takeDisplay();
            this.state = { state: 0 };
            this.players = {}; // WITHOUT passwords
            this.spectators = {};
            this.prompt = { prompt: '', username: '' };
            this.choices = { first: { answer: '', username: '' }, second: { answer: '', username: '' } };
            this.votes = { first: { voters: [], score: 0 }, second: { voters: [], score: 0 }}

        },
        update(data) {
            this.state.state = data.state;
            this.players = data.players;
            this.spectators = data.spectators;
        }
    }
});

function connect() {
    //Prepare web socket
    socket = io();

    //Connect
    socket.on('connect', function () {
        //Set connected state to true
        app.init();
    });

    //Handle connection error
    socket.on('connect_error', function (message) {
        alert('Unable to connect: ' + message);
    });

    //Handle disconnection
    socket.on('disconnect', function () {
        alert('Disconnected');
        app.state.state = -1;
    });

    //Handle fail
    socket.on('fail', function (message) {
        alert(message);
    });

    //Handle callbacks
    socket.on('again', function (call) {
        socket.emit(call);
    })

    //Handle server update
    socket.on('state', function (data) {
        app.update(data);
    });

    //Handle receiving a choice
    socket.on('choice', function (data) {
        app.prompt = data.prompt;
        app.choices.first = data.first;
        app.choices.second = data.second;
    });

    //Handles getting the results
    socket.on('results', function (data) {
        app.votes.first.voters = data.firstChoice.voters;
        app.votes.second.voters = data.secondChoice.voters;
        app.votes.first.score = data.firstChoice.score;
        app.votes.second.score = data.secondChoice.score;
    });

    //Handles getting the scores
    socket.on('scores', function(scores) {
        app.scores = scores;
    });
}