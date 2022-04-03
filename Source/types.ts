import { WebSocket } from 'ws'

type appDataType = {
    currentMap: string,
    currentOrders: string,
    mapHistory: MapEntry[],
    orderLength: number,
}

type MapEntry = {
    file: string,
    reason: string,
    date: number,
    orders: {},
    uploader: string,
}

type socketDB = {
    socket: WebSocket,
    _id: number,
    brand: string,
    client_ip: string| undefined,
    client_ua: string,
}

export { appDataType, socketDB}