const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const _ = require('lodash');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const config = require('./config');

let users = [];

function emitUsersListChanged () {
    let list = users
        .filter((user) => !user.callID)
        .map((user) => ({
            id: user.id,
            name: user.name
        }));

    io.emit('users-list-changed', list);
}

function findUserBy (targetID) {
    return _.find(users, (user) => user.id === targetID);
}

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    users.push(socket);

    emitUsersListChanged();

    socket.on('message', (messageType, payload) => {
        let sender;
        let recipient;

        switch (messageType) {
            case 'call-requested':
                recipient = findUserBy(payload.callee.id);
                break;

            case 'call-resolved':
                recipient = findUserBy(payload.to.caller.id);
                sender = findUserBy(payload.to.callee.id);
                if (recipient && sender && payload['agreed']) {
                    recipient.callID = payload.to.callID;
                    sender.callID = payload.to.callID;
                    emitUsersListChanged();
                }
                break;

            case 'details-change-requested':
                socket.name = payload.name;
                emitUsersListChanged();
                break;

            case 'call-ended':
                sender = findUserBy(payload['senderID']);
                recipient = findUserBy(payload['receiverID']);
                sender && (sender.callID = null);
                recipient && (recipient.callID = null);
                emitUsersListChanged();
                break;

            default:
                recipient = findUserBy(payload['receiverID']);
                break;
        }

        console.log(`Received message: ${messageType}`);
        recipient && recipient.emit(messageType, payload);
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
        users = _.without(users, socket);
        emitUsersListChanged();
    });
});

server.listen(config.port, () => {
    console.log(`Listening on ${config.port}`);
});