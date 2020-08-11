'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk');

AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();


module.exports.handlers = (event, context, callback) => {
  if (!event.gameRequestType) {
    callback(null, {
      statusCode: 400,
      body: JSON.stringify({
        message: `Bad game request`
      })
    });
  }

  if (event.gameRequestType == 'getRunningGames') {
    getRunningGames().then(games => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: `Sucessfully fetched games`,
          games: games.Items
        })
      });
    });
  }
  const gameId = decodeURIComponent(event.gameId);

  if (event.gameRequestType == 'loadMyRunningGame') {
    Promise.all([loadMyRunningGame(gameId), getGameDetails(gameId)]).then(data => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: `Sucessfully fetched your game details`,
          gameDetails: data[1].Items,
          gameRecords: data[0].Items
        })
      });
    })
  }

  if (event.gameRequestType == 'handleTurn') {
    const cellId = decodeURIComponent(event.cellId);
    const turn = decodeURIComponent(event.turn);
    handleTurn(moveInfo(gameId, cellId, turn))
      .then(res => {
        callback(null, {
          statusCode: 200,
          body: JSON.stringify({
            message: `Sucessfully made move for ${gameId}`,
            gameId: res.id
          })
        });
      })
      .catch(err => {
        console.log(err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify({
            message: `Unable to make move ${gameId}`
          })
        });
      });
  }


  const player = decodeURIComponent(event.player);
  const email = decodeURIComponent(event.email);

  if (typeof player !== 'string' || typeof email !== 'string') {
    console.error('Validation Failed');
    callback(new Error('Couldn\'t create new game because of validation errors.'));
    return;
  }

  if (event.gameRequestType == 'createGame') {
    createGame(gameInfo(player, email), (data) => callback(null, data));
  }
  else if (event.gameRequestType == 'joinGame') {
    if (typeof gameId !== 'string') {
      console.error('Validation Failed');
      callback(new Error('Couldn\'t create new game because of validation errors.'));
      return;
    }
    joinGame(gameInfo(player, email, { id: gameId }))
      .then(res => {
        callback(null, {
          statusCode: 200,
          body: JSON.stringify({
            message: `Sucessfully joined game for ${gameId}`,
            gameId: res.id
          })
        });
      })
      .catch(err => {
        console.log(err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify({
            message: `Unable to join game ${gameId}`
          })
        });
      });
  }
  else if (event.gameRequestType == 'updateGameStatus') {
    const status = decodeURIComponent(event.status);
    updateGameStatus(gameId, status)
      .then(res => {
        callback(null, {
          statusCode: 200,
          body: JSON.stringify({
            message: `Sucessfully updated winner for game ${gameId}`,
          })
        });
      })
      .catch(err => {
        console.log(err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify({
            message: `Unable to update winner ${gameId}`
          })
        });
      });
  }
};

const createGame = (game, cbfn) => {
  console.log(`Creating game for ${game.playerX}`);
  const info = {
    TableName: 'tictactoe-game',
    Item: game,
  };

  dynamoDb.put(info).promise().
    then(res => {
      cbfn({
        statusCode: 200,
        body: JSON.stringify({
          message: `Sucessfully created game for ${game.playerX}`,
          game: info.Item,
        })
      });
    })
    .catch(err => {
      cbfn({
        statusCode: 500,
        body: JSON.stringify({
          message: `Unable to create game ${game.playerX}`
        })
      });
    });
};

const handleTurn = move => {
  console.log(`Creating game for ${move.game_id}`);
  const info = {
    TableName: 'tictactoe-running-game',
    Item: move,
  };
  return dynamoDb.put(info).promise();
};

const joinGame = game => {
  console.log(`Creating game for ${game.playerX}`);
  const gameInfo = {
    TableName: "tictactoe-game",
    Key: {
      "id": game.id
    },
    UpdateExpression: "set #playerO = :playerO, #emailO = :emailO, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#playerO": "playerO",
      "#emailO": "emailO",
      "#updatedAt": "updatedAt"
    },
    ExpressionAttributeValues: {
      ":playerO": game.playerO,
      ":emailO": game.emailO,
      ":updatedAt": game.updatedAt
    }
  };
  return dynamoDb.update(gameInfo).promise();
};

const updateGameStatus = (gameId, winner) => {
  const gameInfo = {
    TableName: "tictactoe-game",
    Key: {
      "id": gameId
    },
    UpdateExpression: "set #winner = :w, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#winner": "winner",
      "#updatedAt": "updatedAt"
    },
    ExpressionAttributeValues: {
      ":w": winner,
      ":updatedAt": new Date().getTime()
    }
  };
  return dynamoDb.update(gameInfo).promise();
};

const getRunningGames = () => {
  console.log(`Getting running games`);
  var scanningParams = { TableName: 'tictactoe-game' };
  return dynamoDb.scan(scanningParams).promise();
};

const loadMyRunningGame = (gameId) => {
  console.log(`Getting running games`);
  var params = {
    KeyConditionExpression: "#id = :id",
    ExpressionAttributeNames: {
      '#id': 'game_id'
    },
    ExpressionAttributeValues: {
      ':id': gameId
    },
    TableName: 'tictactoe-running-game'
  };
  return dynamoDb.query(params).promise();
};
const getGameDetails = (gameId) => {
  console.log(`Getting game details`);
  var params = {
    KeyConditionExpression: "#id = :id",
    ExpressionAttributeNames: {
      '#id': 'id'
    },
    ExpressionAttributeValues: {
      ':id': gameId
    },
    TableName: 'tictactoe-game'
  };

  return dynamoDb.query(params).promise();
};

const gameInfo = (player, email, options = {}) => {
  const timestamp = new Date().getTime();
  let info = {
    id: options.id || uuid.v1(),
    updatedAt: timestamp,
  };
  if (!options.id) {
    info.submittedAt = timestamp;
    info.playerX = player;
    info.emailX = email;
  } else {
    info.playerO = player;
    info.emailO = email;
  }
  return info;
};

const moveInfo = (gameId, cellId, turn, options = {}) => {
  const timestamp = new Date().getTime();
  let info = {
    game_id: gameId,
    cell_id: parseInt(cellId),
    turn: turn,
    submittedAt: timestamp
  };
  return info;
};