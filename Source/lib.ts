import { Request, Response } from "express";
import { appDataType } from "./types";

const fs = require("fs");

const lib = {
    // Log.
    log: (msg: string) => {
        console.log(`[${new Date().toLocaleString()}] ${msg}`);
    },

    // Error.
    error: (err: string) => {
        console.error(`[${new Date().toLocaleString()}] ${err}`);
    },

    // Vezme historii map a vybere z nich 5 nejnovějších
    getRecentMaps: (complete: any) => {
        let recent = JSON.parse(JSON.stringify(complete));
        recent = recent.sort((a: any, b: any) => {
            return b.date - a.date;
        });

        if (recent.length <= 5) return recent;
        return recent.slice(0, 5);
    },

    // Přepočítá RGB na HEX
    rgbToHex: (r: number, g: number, b: number) => {
        return (
            "#" +
            ((1 << 24) + (r << 16) + (g << 8) + b)
                .toString(16)
                .slice(1)
                .toUpperCase()
        );
    },

    // Kontroluje špatný placepixel
    checkIncorrectPlace: (x: number, y: number, color: number) => {
        return (
            x === undefined ||
            y === undefined ||
            (color === undefined && x < 0) ||
            x > 1999 ||
            y < 0 ||
            y > 999 ||
            color < 0 ||
            color > 32
        );
    },

    // Ukládá appData do data.json
    saveAppdata: (appData: appDataType) => {
        try {
            fs.writeFileSync(`${__dirname}/data.json`, JSON.stringify(appData));
            module.exports.log(`AppData file was saved.`);
        } catch (e) {
            module.exports.error(`Saving AppData failed: ${e}`);
        }
    },

    // Handluje aktualizaci příkazů
    handleUpdateError: (req: Request, res: Response, err: string) => {
        res.send(err);
        fs.unlinkSync(req.file?.path);
        module.exports.error(`UpdateOrders failed: ${err}`);
    },

    // Kouká jestli je věc alfanumerická
    isAlphaNumeric(str: string) {
        let code, i, len;

        for (i = 0, len = str.length; i < len; i++) {
            code = str.charCodeAt(i);
            if (
                !(code > 47 && code < 58) && // numeric (0-9)
                !(code > 64 && code < 91) && // upper alpha (A-Z)
                !(code > 96 && code < 123)
            )
                return false; // lower alpha (a-z)
        }

        return true;
    },

    // Kontroluje jestli je v pořádku brand
    checkInvalidBrand(brand: string) {
        return (
            brand === undefined ||
            brand.length < 1 ||
            brand.length > 32 ||
            !module.exports.isAlphaNumeric(brand)
        );
    },

    parseWSMessage(message: string): any | Error { 
        let data;
        try {
            data = JSON.parse(message);
            return data;
        } catch (e) { 
            return new Error("Failed to parse message")
        }
    }
};

export default lib;