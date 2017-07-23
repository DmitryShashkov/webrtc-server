const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const _ = require('lodash');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

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

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    users.push(socket);

    emitUsersListChanged();

    socket.on('message', (messageType, payload) => {
        // todo: add call-ended
        switch (messageType) {
            case 'call-requested':
                let requestedCallee = _.find(users, (user) => user.id === payload.callee.id);

                if (requestedCallee) {
                    requestedCallee.emit('call-requested', payload);
                }
                break;
            case 'call-resolved':
                let resolvedCaller = _.find(users, (user) => user.id === payload.to.caller.id);
                let resolvedCallee = _.find(users, (user) => user.id === payload.to.callee.id);

                if (resolvedCaller && resolvedCallee) {
                    if (payload.agreed) {
                        resolvedCaller.callID = payload.to.callID;
                        resolvedCallee.callID = payload.to.callID;
                        emitUsersListChanged();
                    }

                    resolvedCaller.emit('call-resolved', payload);
                }
                break;
            case 'details-change-requested':
                socket.name = payload.name;
                emitUsersListChanged();
                break;
            case 'call-ended':
                let sender = _.find(users, (user) => user.id === payload.senderID);
                let recipient = _.find(users, (user) => user.id === payload.receiverID);

                if (sender) {
                    sender.callID = null;
                }
                if (recipient) {
                    recipient.callID = null;
                    recipient.emit('call-ended', payload);
                }
                emitUsersListChanged();
                break;
            default:
                let receiver = _.find(users, (user) => user.id === payload.receiverID);

                if (receiver) {
                    receiver.emit(messageType, payload);
                }
                break;
        }
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);

        users = _.without(users, socket);

        emitUsersListChanged();
    });
});

server.listen(7055, () => {
    console.log('wtf');
});