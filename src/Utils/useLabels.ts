import { ChatModification } from '../Types'
import { Label } from '../Types/Label'

interface IStore {
	labels: {
		[_: string]: Label
	}
	labelsAssociation: {[_: string]: string[]}
}

interface ISock {
	chatModify: (mod: ChatModification, jid: string) => Promise<void>
}

type IModificator = 'addLabel' | 'removeLabel'

export const useLabels = (store: IStore, sock: ISock) => {
	const updateLabels = async(labels: string[], remoteJids: string[], modificator: IModificator) => {
		for(const remoteJid of remoteJids) {
			for(const label of labels) {
				const labelId = Object.entries(store.labels).find(([, storeLabel]) => (storeLabel as Label).name === label)?.[0]
				const isAssociationLabel = labelId && store.labelsAssociation[remoteJid]?.includes(labelId)

				if(isAssociationLabel && modificator === 'addLabel') {
					continue
				} else if(!isAssociationLabel && modificator === 'removeLabel') {
					continue
				}

				if(labelId) {
					await sock.chatModify({ [modificator]: labelId } as ChatModification, remoteJid)
				}
			}
		}
	}

	return {
		getLabels: () => Object.values(store.labels).map(label => (label as Label).name),
		getLabelsAssociation: (chat: string) => store.labelsAssociation[chat].map(id => store.labels[id].name),
		setLabels: async(labels: string[], remoteJids: string[]) => {
			await updateLabels(labels, remoteJids, 'addLabel')
		},
		unsetLabels: async(labels: string[], remoteJids: string[]) => {
			await updateLabels(labels, remoteJids, 'removeLabel')
		}
	}
}