import { CswFilter, serializeFilter } from "./filters";
import { CswParser } from "./parsing/parser";

export class CswClient {
    static async getCapabilities(
        endpoint: string,
        options: {
            signal?: AbortSignal;
        } = {}
    ) {
        const url = new URL(endpoint);
        url.searchParams.set("service", "CSW");
        url.searchParams.set("request", "GetCapabilities");

        const res = await fetch(url, {
            signal: options.signal,
        });

        const text = await res.text();

        return CswParser.parseGetCapabilities(text);
    }

    static async getRecords(
        endpoint: string,
        options: {
            signal?: AbortSignal;
            filter?: CswFilter;
            startPosition?: number;
            maxRecords?: number;
        } = {}
    ) {
        const url = new URL(endpoint);
        url.searchParams.set("service", "CSW");
        url.searchParams.set("request", "GetRecords");
        url.searchParams.set("version", "2.0.2");
        url.searchParams.set("typeNames", "csw:Record");
        url.searchParams.set("resultType", "results");

        if (options.maxRecords !== undefined) {
            url.searchParams.set("maxRecords", options.maxRecords.toString());
        }
        if (options.startPosition !== undefined) {
            url.searchParams.set(
                "startPosition",
                options.startPosition.toString()
            );
        }

        url.searchParams.set("elementSetName", "full");
        url.searchParams.set(
            "outputSchema",
            "http://www.isotc211.org/2005/gmd"
        );
        if (options.filter) {
            url.searchParams.set("constraintLanguage", "FILTER");
            url.searchParams.set("constraint_language_version", "1.1.0");
            url.searchParams.set(
                "constraint",
                `<Filter xmlns="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml">${serializeFilter(
                    options.filter
                )}</Filter>`
            );
        }

        const res = await fetch(url, {
            signal: options.signal,
        });
        const text = await res.text();

        return CswParser.parseGetRecords(text);
    }

    static async getRecordById(endpoint: string, id: string) {
        const url = new URL(endpoint);
        url.searchParams.set("service", "CSW");
        url.searchParams.set("request", "GetRecordById");
        url.searchParams.set("version", "2.0.2");
        url.searchParams.set("elementSetName", "full");
        url.searchParams.set(
            "outputSchema",
            "http://www.isotc211.org/2005/gmd"
        );
        url.searchParams.set("id", id);

        const res = await fetch(url);
        const text = await res.text();

        return CswParser.parseGetRecordById(text);
    }
}
