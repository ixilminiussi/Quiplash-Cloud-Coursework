var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        error: null,
        token: 0,
        me: { role: '', username: '', password: '', state: 0, score: 0 }, // roles can be 0 - host, 1 - player, 2 - audience.
        state: { state: false },
        players: {}, // WITHOUT passwords
        promptOut: '',
        promptIn: { first: { prompt: '', id: 0 }, second: { prompt: '', id: 0 } },
        answerOut: '',
        choices: { first: { answer: '', username: '' }, second: { answer: '', username: '' } }
    },
    mounted: function () {
        connect();
    },
    methods: {
        init() { //Resets the values and sets connected state
            this.token = 0;
            this.me = { role: '', username: '', password: '', state: 0, score: 0 }; // roles can be 0 - host, 1 - player, 2 - audience.
            this.state = { state: 0 };
            this.players = {}; // WITHOUT passwords
            this.promptOut = '';
            this.promptIn = { first: { prompt: '', id: 0 }, second: { prompt: '', id: 0 } };
            this.answerOut = '';
            this.choices = { first: { answer: '', username: '' }, second: { answer: '', username: '' } };
        },
        update(data) {
            this.me.role = data.me.role;
            this.me.score = data.me.score;
            this.state.state = data.state;
            this.players = data.players;
        },
        register(username, password) {
            this.me.username = username; // ensures both the username and password are kept locally
            this.me.password = password;
            socket.emit('register', { username, password });
        },
        login(username, password) {
            this.me.username = username.trim();
            this.me.password = password;
            socket.emit('login', { username, password });
        },
        prompt(text) {
            var username = this.me.username;
            var password = this.me.password
            socket.emit('prompt', { username, password, text });
            // once logged in, use the stored username and password for all future API calls
        },
        answer(answer) {
            var prompt = this.promptIn.first;

            //switches to the next prompt
            if (this.promptIn.second.id == 0) {

                this.promptIn.first = { prompt: '', id: 0 };
                this.answerOut = '';
                socket.emit('ready');
            } else {
                this.promptIn.first = this.promptIn.second;
                this.promptIn.second = { prompt: '', id: 0 };
                this.answerOut = '';
            }

            socket.emit('answer', { username: this.me.username, prompt: prompt, answer: answer }); //Tells the server when it's done answering
        },
        vote(vote) {
            if (vote == 0) {
                socket.emit('vote', { username: this.me.username, n: 0 });
            } else {
                socket.emit('vote', { username: this.me.username, n: 1 });
            }
        },
        next() {
            socket.emit('next');
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

    //Handle take control
    socket.on('control', function () {
        app.token = 1;
    });

    //Handle losing control
    socket.on('losecontrol', function () {
        app.token = 0;
    });

    //Handle getting reset
    socket.on('reset', function () {
        app.me.state = 0;
    });

    //Handle receiving a choice
    socket.on('choice', function (data) {
        app.choices.first = data.first;
        app.choices.second = data.second;
    });

    //Handle getting readied
    socket.on('ready', function () {
        app.promptOut = ''; //so that the user doesn't see his old prompt on the following rounds
        app.me.state = 1;
    });

    //Handle getting a prompt
    socket.on('prompt', function (newPrompt) {
        if (app.promptIn.first.id == 0) {
            app.promptIn.first = newPrompt;
        } else {
            app.promptIn.second = newPrompt;
        }
    });

    //Handle getting score
    socket.on('score', function(score) {
        this.me.score = score;
    });
}