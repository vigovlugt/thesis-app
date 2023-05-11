import { xml2js, ElementCompact } from "xml-js";
import { parseCswGetCapabilitiesResponse } from "./parser";

export class CswClient {
    static async getCapabilities(endpoint: string) {
        const url = new URL(endpoint);
        url.searchParams.set("request", "GetCapabilities");
        url.searchParams.set("service", "CSW");

        const res = await fetch(url);

        const text = await res.text();

        const compactObj = xml2js(text, {
            compact: true,
            trim: true,
        }) as ElementCompact;

        const obj = removeNamespaces(compactObj) as ElementCompact;

        return parseCswGetCapabilitiesResponse(obj);
    }

    static async getRecords(endpoint: string) {
        const url = new URL(endpoint);
        url.searchParams.set("request", "GetRecords");
        url.searchParams.set("service", "CSW");
        url.searchParams.set("version", "2.0.2");

        const res = await fetch(url);
        const text = await res.text();

        const compactObj = xml2js(text, {
            compact: true,
            trim: true,
        }) as ElementCompact;
        const obj = removeNamespaces(compactObj) as ElementCompact;

        return obj;
    }

    static async getRecordById(endpoint: string, id: string) {
        const url = new URL(endpoint);
        url.searchParams.set("request", "GetRecordById");
        url.searchParams.set("service", "CSW");
        url.searchParams.set("version", "2.0.2");
        url.searchParams.set("id", id);

        const res = await fetch(url);
        const text = await res.text();

        const compactObj = xml2js(text, {
            compact: true,
            trim: true,
        }) as ElementCompact;
        const obj = removeNamespaces(compactObj) as ElementCompact;

        return obj;
    }
}

function removeNamespaces(obj: Record<string, any>) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
        const newKey = stripPrefix(key);
        if (acc[newKey]) console.warn(`Duplicate key: ${newKey}`);

        if (Array.isArray(value)) {
            acc[newKey] = value.map((v) => removeNamespaces(v));
            return acc;
        } else if (typeof value === "object") {
            acc[newKey] = removeNamespaces(value);
        } else {
            acc[newKey] = value;
        }
        return acc;
    }, {} as Record<string, any>);
}

// matches all xml prefixes, except for `xmlns:`
const prefixMatch = new RegExp(/(?!xmlns)^.*:/);
function stripPrefix(name: string) {
    const stripped = name.replace(prefixMatch, "");

    return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}