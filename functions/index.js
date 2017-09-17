'use strict';

console.log('Loading function...');
console.log('Loading dependencies...');
const axios = require('axios');
const _ = require('lodash');
const serviceAccount = require('./info.json');
const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: functions.config().mndp.database_url
});

exports.nowPlaying = functions.database.ref('shows/current/mondaynightdanceparty/nowplaying')
    .onWrite(event => {
        let nowPlayingSnapshot = event.data;
        let videoIdSnapshot = nowPlayingSnapshot.child('videoId');

        if(!videoIdSnapshot.changed()){
            console.log('Video has not changed, exiting...');
            return 0;
        }

        return broadcastNowPlaying(nowPlayingSnapshot.val(), '#MondayNightDanceParty').then(() => {
            console.log('Success! Exiting...');

            return 0;
        });
    });

function broadcastNowPlaying(nowPlaying, hashtag){
    let text = generateMessage(nowPlaying, hashtag);

    console.log('Broadcasting message...');
    axios.defaults.baseURL = 'https://api.pnut.io';

    let message = { text: text };
    let config = {
        params: {
            update_marker: 1
        },
        headers: {'Authorization': 'Bearer ' + functions.config().mndp_botcast.botcast_key }
    };

    return axios.post('/v0/posts', message, config).then(() =>
    {
        console.log('Posting message to channel...');
        message.text = _.replace(message.text, ' on ' + hashtag, '');

        //Post message to channel
        return axios.post('/v0/channels/600/messages', message, config)
    });
}

function generateMessage(nowPlaying, hashtag){
    console.log('Generating message...');
    hashtag = ' requested by @' + nowPlaying.user + ' on ' + hashtag;
    let message = '#NowPlaying ';
    let title = _.truncate(nowPlaying.title, {length: 253 - message.length - hashtag.length - 1});
    let realLength = message.length + title.length + 1;
    message += ' [' + title + '](' + nowPlaying.videoEmbedLink + ')';

    if(_.isString(nowPlaying.artist) && !_.isEmpty(_.trim(nowPlaying.artist))){
        let artist = _.truncate(' by ' + nowPlaying.artist, { length: 253 - realLength });
        realLength += artist.length;
        message += artist;
    }

    if(_.isArray(nowPlaying.tags)){
        _.forEach(nowPlaying.tags, x => {
            if(realLength >= 256 || realLength + x.length + 2 > 252)
                return false;

            realLength += (x.length + 2);
            message += ' #' + x;
        });
    }

    message += hashtag;

    return message;
}