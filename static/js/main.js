/*----- app's state (variables) -----*/
let board;
let mySymbol;
let updateBoardTimer;
let lastTurn;
let isMyTurn;
let winner;

/*----- functions -----*/
function createGame() {
    player = $('#player').val() || UTILS.getCookie('player')
    email = $('#email').val() || UTILS.getCookie('email')

    UTILS.setCookie('player', player, 30);
    UTILS.setCookie('email', email, 30);

    if (!player || !email) {
        $('.player-details').show();
        $('.join-games').hide();
        $('#join_games').empty();
        $('#creategame-button').show();
        $('#joingame-button2').hide();
    } else {
        //call lamda create game
        UTILS.doAjax('https://l4cilgbv54.execute-api.ap-south-1.amazonaws.com/dev/tictactoe', 'POST', {
            player: player,
            email: email,
            gameRequestType: 'createGame'
        }, function (response) {
            if(response.statusCode == 200) {
                UTILS.setCookie('game_id', JSON.parse(response.body).game.id);
                $('.player-details').hide();
                $('#message').text('Waiting for player to join...')
            }
        })
    }
}

function joinGame(gameId) {
    console.log('joining game')
    $('#creategame-button').hide();
    $('#joingame-button2').show();
    player = $('#player').val() || UTILS.getCookie('player')
    email = $('#email').val() || UTILS.getCookie('email')
    UTILS.setCookie('player', player, 30);
    UTILS.setCookie('email', email, 30);

    if (!gameId && $('.selected').attr('data-id')) {
        gameId = $('.selected').attr('data-id')
    }
    if (gameId) {
        $(`[data-id]`).removeClass('selected');
        $(`[data-id=${gameId}]`).addClass('selected');
    }
    if (!player || !email || !gameId) {
        !gameId && getRunningGames(function () {
            $('.player-details').show();
            $('.join-games').show();
        })
    } else {
        UTILS.doAjax('https://l4cilgbv54.execute-api.ap-south-1.amazonaws.com/dev/tictactoe', 'POST', {
            player: player,
            email: email,
            gameId: gameId,
            gameRequestType: 'joinGame'
        }, function (response) {
            UTILS.setCookie('game_id', gameId, 1);
            $('.player-details').hide();
            $('.running-game').show();
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        })
    }
}

function getRunningGames(callback) {
    UTILS.doAjax('https://l4cilgbv54.execute-api.ap-south-1.amazonaws.com/dev/tictactoe', 'POST', {
        gameRequestType: 'getRunningGames',
    }, function (response) {
        let games = JSON.parse(response.body).games;
        $('#join_games').empty();
        $.each(games, (index, game) => {
            if (!game.playerO) {
                var ele = `<tr class="game-record"><td data-id="${game.id}" onclick="joinGame('${game.id}')">${game.playerX}</td></tr>`;
                $('#join_games').append(ele);
            }
        })
        callback && callback();
    })
}

UTILS = {
    setCookie: function (cname, cvalue, exDays) {
        var d = new Date();
        d.setTime(d.getTime() + (exDays * 24 * 3600 * 1000));
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + "; " + expires + ";path=/;SameSite=Lax";
    },
    getCookie: function (cname) {
        var name = cname + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i].trim();
            if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
        }
        return "";
    },
    doAjax: function (url, method, data, callback) {
        var settings = {
            "url": url,
            "method": method,
            "timeout": 0,
            "headers": {
                "Content-Type": "text/plain"
            }
        };

        if (method.toLowerCase() == 'post') {
            settings.data = JSON.stringify(data)
        }

        $.ajax(settings).done(function (response) {
            callback && callback(response);
        });
    }
}

function handleTurn() {
    let gameId = UTILS.getCookie('game_id');
    if (gameId) {
        let cellId = squares.findIndex(function (square) {
            return square === event.target;
        });
        if (board[cellId] || cellId < 0) return;
        board[cellId] = mySymbol;
        lastTurn = mySymbol;
        winner = getWinner();
        render();

        UTILS.doAjax('https://l4cilgbv54.execute-api.ap-south-1.amazonaws.com/dev/tictactoe', 'POST', {
            gameRequestType: 'handleTurn',
            gameId: gameId,
            cellId: cellId,
            turn: mySymbol
        }, function (response) {
            board[cellId] = mySymbol;
            init();
            if (!winner) {
                setTimeout(() => {
                    loadMyRunningGame();
                }, 2000);
            }
        });

        if (winner) {
            UTILS.doAjax('https://l4cilgbv54.execute-api.ap-south-1.amazonaws.com/dev/tictactoe', 'POST', {
                gameRequestType: 'updateGameStatus',
                status: winner,
                gameId: gameId,
            }, function (response) {
                init();
            });
        } else {

        }
    }
}

function render() {
    board.forEach(function (val, idx) {
        squares[idx].textContent = val;
    });

    if (!winner) {
        isMyTurn = lastTurn?lastTurn != mySymbol: 'X' == mySymbol;
        messages.textContent = isMyTurn ? `It's your turn!` : `Wait for your turn`;
    } else {
        if (winner == mySymbol) {
            messages.textContent = "Congrats!! you have won";
        } else if (winner == 'T') {
            messages.textContent = "OoOohh!! its a tie";
        } else {
            messages.textContent = "Better luck next time";
        }
    }

};

function init(gameRecords = []) {
    board = board || [
        '', '', '',
        '', '', '',
        '', '', ''
    ];
    if (gameRecords && gameRecords.length) {
        let maxTime = 0;
        $.each(gameRecords, (index, record) => {
            board[record.cell_id] = record.turn;
            if (record.submittedAt > maxTime) {
                maxTime = record.submittedAt;
                lastTurn = record.turn;
            }
        });
    }
    $('.running-game').show();
    $('.main-buttons').hide();
    winner = getWinner();
    render();
};

function toggleGameSections() {

}


function loadMyRunningGame() {
    let gameId = UTILS.getCookie('game_id');
    if (gameId) {
        UTILS.doAjax('https://l4cilgbv54.execute-api.ap-south-1.amazonaws.com/dev/tictactoe', 'POST', {
            gameRequestType: 'loadMyRunningGame',
            gameId: gameId
        }, function (response) {
            let body = JSON.parse(response.body);
            let gameRecords = body.gameRecords;
            let gameDetails = body.gameDetails[0];
            let player = UTILS.getCookie('player');
            if (player == gameDetails.playerX) {
                mySymbol = 'X';
            } else if (player == gameDetails.playerO) {
                mySymbol = 'O'
            } else {
                throw new Error('player missmatch')
            }
            init(gameRecords);
            if(!gameDetails.winner) {
                if (!isMyTurn && !winner) {
                    setTimeout(() => {
                        loadMyRunningGame();
                    }, 2000);
                } else {
                    document.getElementById('board').addEventListener('click', handleTurn);
                }
            } else {
                UTILS.setCookie('game_id', '', 1);
            }
        });
    }

}

function getWinner() {
    let wnr = null;
    winningCombos.forEach((combo, index) => {
        if (board[combo[0]] && board[combo[0]] === board[combo[1]] && board[combo[0]] === board[combo[2]]) {
            wnr = board[combo[0]];
        }
    });
    return wnr ? wnr : board.includes('') ? null : 'T';
};
/*----- cached element references -----*/
const squares = Array.from(document.querySelectorAll('#board div'));
const messages = document.querySelector('h2');
const winningCombos = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];


loadMyRunningGame();