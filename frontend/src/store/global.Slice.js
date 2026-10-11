import { createSlice } from '@reduxjs/toolkit';
import { CreateRoom } from './global.Action';

const initialState = {
    /* Who you are and how you look. Persisted, so the lobby remembers you. */
    profile: {
        name: '',
        skin: '#f8d5b8',
        hair: '#4a2c1a',
        hairStyle: 'long',
        shirt: '#ff4d8d',
        pants: '#3d8be0',
        hat: 'bow',
    },
    lastRoom: '',
    /* The world you are in right now. */
    roomCode: '',
    me: '',
    connected: false,
    players: {},
    chat: [],
    game: null,
    creating: false,
};

export const globalSlice = createSlice({
    name: 'globalState',
    initialState,
    reducers: {
        setProfile: (state, action) => {
            state.profile = { ...state.profile, ...action.payload };
        },
        enterRoom: (state, action) => {
            state.roomCode = action.payload;
            state.lastRoom = action.payload;
        },
        leaveRoom: (state) => {
            state.roomCode = '';
            state.me = '';
            state.players = {};
            state.chat = [];
            state.game = null;
            state.connected = false;
        },
        joined: (state, action) => {
            const { you, players, chat, game } = action.payload;
            state.me = you;
            state.connected = true;
            state.players = Object.fromEntries(players.map((p) => [p.id, p]));
            state.chat = chat;
            state.game = game;
        },
        setConnected: (state, action) => {
            state.connected = action.payload;
        },
        playerJoined: (state, action) => {
            state.players[action.payload.id] = action.payload;
        },
        playerLeft: (state, action) => {
            delete state.players[action.payload];
        },
        chatMessage: (state, action) => {
            state.chat.push(action.payload);
            if (state.chat.length > 60) state.chat.shift();
        },
        setGame: (state, action) => {
            state.game = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(CreateRoom.pending, (state) => {
                state.creating = true;
            })
            .addCase(CreateRoom.fulfilled, (state, action) => {
                state.creating = false;
                state.roomCode = action.payload.code;
                state.lastRoom = action.payload.code;
            })
            .addCase(CreateRoom.rejected, (state) => {
                state.creating = false;
            });
    },
});

export const { setProfile, enterRoom, leaveRoom, joined, setConnected, playerJoined, playerLeft, chatMessage, setGame } =
    globalSlice.actions;
export default globalSlice.reducer;
