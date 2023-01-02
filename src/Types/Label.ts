export interface Label {
    id: string
    name: string | null | undefined
    color: number | null | undefined
    deleted: boolean | null | undefined
}

export interface LabelAssociation {
    id: string
    chat: string
}