import { Socket } from "dgram";
import Express, { static as expressStatic } from "express";
import fs from "fs";
import ws from "ws";

import lib from "./lib";
import { appDataType, socketDB } from "./types.js";
const { randomUUID } = require("crypto");

const app = Express();
const getPixels = require("get-pixels");

const multer = require("multer");
const upload = multer({ dest: `${__dirname}/../uploads/` });

const PORT = process.env.PORT || 3987;
const COLOR_MAPPINGS = {
    "#BE0039": 1,
    "#FF4500": 2,
    "#FFA800": 3,
    "#FFD635": 4,
    "#00A368": 6,
    "#00CC78": 7,
    "#7EED56": 8,
    "#00756F": 9,
    "#009EAA": 10,
    "#2450A4": 12,
    "#3690EA": 13,
    "#51E9F4": 14,
    "#493AC1": 15,
    "#6A5CFF": 16,
    "#811E9F": 18,
    "#B44AC0": 19,
    "#FF3881": 22,
    "#FF99AA": 23,
    "#6D482F": 24,
    "#9C6926": 25,
    "#000000": 27,
    "#898D90": 29,
    "#D4D7D9": 30,
    "#FFFFFF": 31,
};

function getAppData() { 
    if (fs.existsSync(`${__dirname}/data.json`))
        return require(`${__dirname}/data.json`);
    else return {
        currentMap: "blank.png",
        currentOrders: "blank.json",
        mapHistory: [
            {
                file: "blank.png",
                reason: "Init ^Noah",
                date: 1648890843309,
                orders: {},
                uploader: "Noah",
            },
        ],
        orderLength: 0,
    };
}

let appData: appDataType = getAppData();


const server = app.listen(PORT);
const wsServer = new ws.Server({ server: server, path: "/api/ws" });
lib.log(`Server starting at port ${PORT}`);

app.use("/maps", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.use("/orders", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

console.log(`${__dirname}/../orders`);


app.use("/maps", expressStatic(`${__dirname}/../maps`));
app.use("/orders", expressStatic(`${__dirname}/../orders`));

app.use(expressStatic(`${__dirname}/../static`));

app.get("/currentmap", (req, res) =>
    res.redirect(`/maps/${appData.currentMap}`)
);
app.get("/currentorders", (req, res) =>
    res.redirect(`/orders/${appData.currentOrders}`)
);

let recentHistory = lib.getRecentMaps(appData.mapHistory);
let pixelsPlaced = 0;
let brandUsage = {};

app.get("/api/stats", (req, res) => {
    res.json({
        connectionCount: wsServer.clients.size,
        pixelsPlaced: pixelsPlaced,
        brandUsage: brandUsage,
        date: Date.now(),
    });
});

app.get("/api/map", (req, res) => {
    res.json({
        currentMap: appData.currentMap,
        orders: appData.currentOrders,
        orderLength: appData.orderLength,
        mapHistory: recentHistory,
        date: Date.now(),
    });
});

app.post("/updateorders", upload.single("image"), async (req, res) => {
    if (
        !req.body ||
        !req.body?.password ||
        req.body?.password !== process.env.PASSWORD
    )
        return lib.handleUpdateError(req, res, "Incorrect password");

    if (!req?.file || req.file?.mimetype !== "image/png")
        return lib.handleUpdateError(req, res, "The file must be PNG!");

    getPixels(req.file.path, "image/png", function (err: string, pixels: any) {
        if (err) {
            console.error(err);
            return lib.handleUpdateError(req, res, "An error occured.");
        }

        if (pixels.data.length !== 8000000)
            return lib.handleUpdateError(
                req,
                res,
                "The file must be 2000x1000 pixels!"
            );

        let orders = [];
        for (var i = 0; i < 2000000; i++) {
            const a = pixels.data[i * 4 + 3];
            if (a !== 255) continue;

            const x = i % 1000,
                y = Math.floor(i / 2000),
                r = pixels.data[i * 4],
                g = pixels.data[i * 4 + 1],
                b = pixels.data[i * 4 + 2];

            const hex: string = lib.rgbToHex(r, g, b);
            const color = Object.keys(COLOR_MAPPINGS).indexOf(hex);

            if (!color)
                return lib.handleUpdateError(
                    req,
                    res,
                    `A pixel on ${x}, ${y} has a wrong color.<br>R: ${r}, G: ${g}, B: ${b}, A: ${a}`
                );

            orders.push([x, y, color]);
        }

        const pngFile = `${Date.now()}.png`;
        const jsonFile = `${Date.now()}.json`;

        fs.copyFileSync(req.file!.path, `${__dirname}/maps/${pngFile}`);
        fs.unlinkSync(req.file!.path);

        fs.writeFileSync(
            `${__dirname}/orders/${jsonFile}`,
            JSON.stringify(orders)
        );

        let reason = req.body?.reason || "Důvod neuveden";
        let uploader = req.body?.uploader;

        appData.currentOrders = jsonFile;
        appData.orderLength = orders.length;

        appData.currentMap = pngFile;
        appData.mapHistory.push({
            date: Date.now(),
            file: pngFile,
            orders: jsonFile,
            reason,
            uploader,
        });

        recentHistory = lib.getRecentMaps(appData.mapHistory);

        wsServer.clients.forEach((client) => {
            client.send(
                JSON.stringify({
                    type: "map",
                    data: appData.currentMap,
                    reason,
                })
            );
            client.send(
                JSON.stringify({
                    type: "orders",
                    data: appData.currentOrders,
                    reason,
                })
            );
        });

        lib.saveAppdata(appData);
        res.redirect("/");
    });
});
let pixelsLastPlaced: any = {};
const sockets: socketDB[] = []


wsServer.on("connection", (socket, req) => {
    const socketData: socketDB = {
        _id: randomUUID().slice(0, 8),
        brand: "unknown",
        client_ip:
            req.headers["CF-Connecting-IP"]?.toString() ||
            req.headers["X-Forwarded-For"]?.toString() ||
            req.headers["X-Real-IP"]?.toString() ||
            req.socket.remoteAddress,
        client_ua: req.headers["user-agent"] || "missing user-agent",
        socket,
    };

    sockets.push(socketData);

    lib.log(
        `[+] Client ${socketData._id} connected from '${socketData.client_ip}' - '${socketData.client_ua}'`
    );

    socket.on("close", () => {
        lib.log(`[-] Client ${socketData._id} disconnected`);
        sockets.splice(sockets.indexOf(socketData), 1);
    });

    socket.on("message", (message) => {
        
        const data: any = lib.parseWSMessage(message.toString());

        if (!data.type)
            return socket.send(
                JSON.stringify({
                    type: "error",
                    data: "Data missing type!",
                })
            );

        switch (data.type.toLowerCase()) {
            case "brand":
                const { brand } = data;
                if (lib.checkInvalidBrand(brand)) return;
                socketData.brand = data.brand;
                break;
            case "getmap":
                socket.send(
                    JSON.stringify({
                        type: "map",
                        data: appData.currentMap,
                        reason: null,
                    })
                );
                break;
            case "getorders":
                socket.send(
                    JSON.stringify({
                        type: "orders",
                        data: appData.currentOrders,
                        reason: null,
                    })
                );
                break;
            case "placepixel":
                const lastPlaced =
                    pixelsLastPlaced[socketData._id] != null
                        ? pixelsLastPlaced[socketData._id]
                        : 0;
                if (Date.now() - lastPlaced <= 5000) break;

                const { x, y, color } = data;
                if (lib.checkIncorrectPlace(x, y, color)) return;
                lib.log(`Pixel placed by ${socketData._id}: ${x}, ${y}: ${color}`);

                pixelsLastPlaced[socketData._id] = Date.now();
                pixelsPlaced++;
                break;
            case "ping":
                socket.send(JSON.stringify({ type: "pong" }));
                break;
            default:
                socket.send(
                    JSON.stringify({
                        type: "error",
                        data: "Unknown command!",
                    })
                );
                break;
        }
    });
});

setInterval(() => {
    
    brandUsage = Array.from(sockets)
        .map((c) => c.brand)
        .reduce(function (acc: any, curr: any) {
            return acc[curr] ? ++acc[curr] : (acc[curr] = 1), acc;
        }, {});
}, 2 * 1000);

setInterval(() => {
    lib.saveAppdata(appData);
}, 15 * 60 * 1000);
