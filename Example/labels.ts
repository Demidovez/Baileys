import { Boom } from '@hapi/boom'
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, makeInMemoryStore, useLabels, useMultiFileAuthState } from '../src'
import MAIN_LOGGER from '../src/Utils/logger'

const logger = MAIN_LOGGER.child({ })
logger.level = 'trace'

const store = makeInMemoryStore({ })
store?.readFromFile('./baileys_store_multi.json')
// save every 10s
setInterval(() => {
	store?.writeToFile('./baileys_store_multi.json')
}, 10_000)

// start a connection
const startSock = async() => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
	// fetch latest version of WA Web
	const { version } = await fetchLatestBaileysVersion()

	const sock = makeWASocket({
		version,
		printQRInTerminal: true,
		auth: {
			creds: state.creds,
			/** caching makes the store faster to send/recv messages */
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		generateHighQualityLinkPreview: true,
	})

	const { getLabels, setLabels, unsetLabels, getLabelsAssociation } = useLabels(store, sock)

	store?.bind(sock.ev)

	// the process function lets you process all events that just occurred
	// efficiently in a batch
	sock.ev.process(
		async(events) => {
			if(events['connection.update']) {
				const update = events['connection.update']
				const { connection, lastDisconnect } = update
				if(connection === 'close') {
					// reconnect if not logged out
					if((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
						startSock()
					} else {
						console.log('Connection closed. You are logged out.')
					}
				}

				console.log('connection update', update)
			}

			// credentials updated -- save them
			if(events['creds.update']) {
				await saveCreds()
			}

			// received a new message
			if(events['messages.upsert']) {
				const upsert = events['messages.upsert']

				if(upsert.type === 'notify') {
					for(const msg of upsert.messages) {
						const message = msg.message?.conversation || ''
						const command = message[0]
						const label = message.slice(1)

						if(command === '+') {
							await setLabels([label], [msg.key.remoteJid!])
						} else if(command === '-') {
							await unsetLabels([label], [msg.key.remoteJid!])
						}

						if(['+', '-'].includes(command)) {
							await sock.sendMessage(msg.key.remoteJid!, { text: 'Всего ярлыков: ' + getLabels().join(', ') })

							await sock.sendMessage(msg.key.remoteJid!, { text: 'Привязано ярлыков: ' + getLabelsAssociation(msg.key.remoteJid!).join(', ') })
						}
					}
				}
			}
		}
	)
}

startSock()