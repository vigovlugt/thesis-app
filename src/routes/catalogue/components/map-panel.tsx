import { GeoMap } from "@/components/geomap/geomap";
import { CswClient } from "@/lib/csw/api";
import { cn, coordsFrom3857, coordsTo3857 } from "@/lib/utils";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@radix-ui/react-tooltip";
import { Loader2Icon, AlertTriangle } from "lucide-react";
import { MapBrowserEvent, MapEvent } from "ol";
import { GeoJSON } from "ol/format";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
    useCatalogueRecords,
    useCatalogueRecordStatus,
    useCatalogueActions,
    useCatalogueHoveredRecords,
    useCatalogueSelectedRecordId,
} from "../store";
import { useCatalogueLayoutData } from "../layout";
import { Layer } from "@/components/geomap/layer";
import { MetadataRecord } from "@/lib/csw/parsing/md-metadata";
import { Circle as CircleStyle } from "ol/style";

const DEFAULT_STROKE = new Stroke({
    color: "#0f172a",
    width: 2,
});

const DEFAULT_FILL = new Fill({
    color: "rgba(255,255,255,0.2)",
});

const DEFAULT_STYLE = new Style({
    fill: DEFAULT_FILL,
    stroke: DEFAULT_STROKE,
    image: new CircleStyle({
        radius: 5,
        fill: DEFAULT_FILL,
        stroke: DEFAULT_STROKE,
    }),
});

const HOVERED_STROKE = new Stroke({
    color: "#0f172a",
    width: 4,
});

const HOVERED_FILL = new Fill({
    color: "rgba(0,0,0,0.05)",
});

const HOVERED_STYLE = new Style({
    fill: HOVERED_FILL,
    stroke: HOVERED_STROKE,
    image: new CircleStyle({
        radius: 5,
        fill: HOVERED_FILL,
        stroke: HOVERED_STROKE,
    }),
});

const SELECTED_STROKE = new Stroke({
    color: "#1d4ed8",
    width: 4,
});

const SELECTED_FILL = new Fill({
    color: "rgba(255,255,255,0.2)",
});

const SELECTED_STYLE = new Style({
    fill: SELECTED_FILL,
    stroke: SELECTED_STROKE,
    image: new CircleStyle({
        radius: 5,
        fill: SELECTED_FILL,
        stroke: SELECTED_STROKE,
    }),
});

function getGeoJsonFromRecords(records: MetadataRecord[]) {
    return {
        type: "FeatureCollection",
        crs: {
            type: "name",
            properties: {
                name: "EPSG:3857",
            },
        },
        features: records
            .map((r) => {
                const boundingBox = r.identificationInfo.extent;
                if (!boundingBox) return null;

                let geometry: any = {
                    type: "Polygon",
                    coordinates: [
                        (
                            [
                                [
                                    boundingBox.westBoundLongitude,
                                    boundingBox.southBoundLatitude,
                                ],
                                [
                                    boundingBox.eastBoundLongitude,
                                    boundingBox.southBoundLatitude,
                                ],
                                [
                                    boundingBox.eastBoundLongitude,
                                    boundingBox.northBoundLatitude,
                                ],
                                [
                                    boundingBox.westBoundLongitude,
                                    boundingBox.northBoundLatitude,
                                ],
                                [
                                    boundingBox.westBoundLongitude,
                                    boundingBox.southBoundLatitude,
                                ],
                            ] as const
                        ).map((coords) => coordsTo3857(coords)),
                    ],
                };

                if (
                    boundingBox.eastBoundLongitude ===
                        boundingBox.westBoundLongitude &&
                    boundingBox.northBoundLatitude ===
                        boundingBox.southBoundLatitude
                ) {
                    geometry = {
                        type: "Point",
                        coordinates: coordsTo3857([
                            boundingBox.westBoundLongitude,
                            boundingBox.southBoundLatitude,
                        ]),
                    };
                }

                return {
                    type: "Feature",
                    geometry,
                    properties: {
                        id: r.fileIdentifier,
                    },
                };
            })
            .filter((f) => f !== null),
    };
}

export function MapPanel() {
    const data = useCatalogueLayoutData();

    const records = useCatalogueRecords();
    const recordStatus = useCatalogueRecordStatus();
    const hoveredRecords = useCatalogueHoveredRecords();
    const selectedRecordId = useCatalogueSelectedRecordId();
    const { setRecords, setRecordStatus, setHoveredRecords, selectRecord } =
        useCatalogueActions();

    const abortControllerRef = useRef<AbortController | null>(null);
    const onMapMoveEnd = useCallback(
        async (e: MapEvent) => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            const bbox = e.map.getView().calculateExtent();
            const minCoords = coordsFrom3857([bbox[0], bbox[1]]);
            const maxCoords = coordsFrom3857([bbox[2], bbox[3]]);

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            setRecordStatus({ type: "loading" });

            try {
                const newRecords = await CswClient.getRecords(
                    data.csw.endpoint,
                    {
                        signal: abortController.signal,
                        boundingBox: [minCoords, maxCoords],
                    }
                );
                abortControllerRef.current = null;
                setRecords(
                    new Map(
                        newRecords.searchResults.map(
                            (r) => [r.fileIdentifier, r] as const
                        )
                    )
                );
                setRecordStatus({ type: "idle" });
            } catch (error: any) {
                if (error.name === "AbortError") return;

                setRecordStatus({ type: "error", error });
                throw error;
            }
        },
        [data.csw.endpoint, setRecords, setRecordStatus]
    );

    const onMapPointerMove = useCallback(
        (e: MapBrowserEvent<any>) => {
            const features = e.map.getFeaturesAtPixel(e.pixel!);

            setHoveredRecords(
                features.map((f) => f.getProperties().id as string).slice(0, 1)
            );
        },
        [setHoveredRecords]
    );

    const boundaryBoxGeoJson = useMemo(
        () => getGeoJsonFromRecords([...records.values()]),
        [records]
    );

    const boundaryBoxLayer = useMemo(() => {
        return new VectorLayer({
            source: new VectorSource({
                features: new GeoJSON().readFeatures(boundaryBoxGeoJson),
            }),
            style: DEFAULT_STYLE,
        });
    }, [boundaryBoxGeoJson]);

    useEffect(() => {
        if (!selectedRecordId) return;

        const feature = boundaryBoxLayer
            .getSource()!
            .getFeatures()
            .find((f) => f.getProperties().id === selectedRecordId);
        if (!feature) return;

        feature.setStyle(SELECTED_STYLE);

        return () => {
            feature.setStyle(DEFAULT_STYLE);
        };
    }, [boundaryBoxLayer, selectedRecordId]);

    useEffect(() => {
        const featureById = new Map(
            boundaryBoxLayer
                .getSource()!
                .getFeatures()
                .map((f) => [f.getProperties().id, f] as const)
        );
        for (const record of hoveredRecords) {
            const feature = featureById.get(record);
            if (!feature) continue;

            if (feature.getStyle() === SELECTED_STYLE) continue;
            feature.setStyle(HOVERED_STYLE);
        }

        return () => {
            for (const record of hoveredRecords) {
                const feature = featureById.get(record);
                if (!feature) continue;

                if (feature.getStyle() === SELECTED_STYLE) continue;
                feature.setStyle(DEFAULT_STYLE);
            }
        };
    }, [boundaryBoxLayer, hoveredRecords]);

    return (
        <div
            className={cn(
                "h-full w-full relative overflow-hidden rounded-b-md",
                hoveredRecords.length > 0 && "cursor-pointer"
            )}
        >
            <GeoMap
                onMoveEnd={onMapMoveEnd}
                onPointerMove={onMapPointerMove}
                onClick={() => selectRecord(hoveredRecords.at(0))}
            >
                <Layer layer={boundaryBoxLayer} />
                <div className="absolute right-2 top-2 z-10">
                    {recordStatus.type === "loading" ? (
                        <Loader2Icon className="h-7 w-7 animate-spin text-primary" />
                    ) : recordStatus.type === "error" ? (
                        <Tooltip>
                            <TooltipTrigger>
                                <AlertTriangle className="h-7 w-7 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <span className="text-destructive">
                                    {recordStatus.error.message}
                                </span>
                            </TooltipContent>
                        </Tooltip>
                    ) : null}
                </div>
            </GeoMap>
        </div>
    );
}
