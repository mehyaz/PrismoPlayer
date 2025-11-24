require('ts-node').register({ transpileOnly: true });
const { startTorrent } = require('./electron/torrent-handler');

// Example small public magnet link (Ubuntu ISO) - replace with a known small torrent if needed
const magnet = 'magnet:?xt=urn:btih:2D3E6B5C7F8A9D0E1F2A3B4C5D6E7F8A9B0C1D2E&dn=ubuntu-20.04-desktop-amd64.iso&tr=udp://tracker.openbittorrent.com:80/announce';

startTorrent(magnet).then(url => {
    console.log('Streaming URL:', url);
}).catch(err => {
    console.error('Error starting torrent:', err);
});
