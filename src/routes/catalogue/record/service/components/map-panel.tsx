import { DEFAULT_STYLE, HOVERED_STYLE, SELECTED_STYLE } from "@/lib/constants";
import {
    useCatalogueZoom,
    useCatalogueCenter,
    useCatalogueActions,
} from "@/routes/catalogue/store";
import { GeoJSON } from "ol/format";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import TileWMS from "ol/source/TileWMS";
import VectorSource from "ol/source/Vector";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServicePageData } from "../loader";
import { useServiceQuery } from "../query";
import {
    useServiceActions,
    useServiceHoveredFeatures,
    useServiceSelectedFeatureType,
    useServiceSelectedFeatures,
} from "../store";
import { GeoMap } from "@/components/geomap/geomap";
import { Layer } from "@/components/geomap/layer";
import { Feature, MapBrowserEvent } from "ol";
import { Geometry } from "ol/geom";
import { getArea } from "ol/sphere";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2Icon } from "lucide-react";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import { Interaction } from "@/components/geomap/interaction";
import { DragBox } from "ol/interaction";
import { DragBoxEvent } from "ol/interaction/DragBox";
import { ListenerFunction } from "ol/events";

export function MapPanel() {
    const pageData = useServicePageData()!;

    const zoom = useCatalogueZoom();
    const center = useCatalogueCenter();
    const { setZoom, setCenter } = useCatalogueActions();

    const selectedFeatureType = useServiceSelectedFeatureType();
    const selectedFeatures = useServiceSelectedFeatures();
    const hoveredFeatures = useServiceHoveredFeatures();
    const { setSelectedFeatures, setHoveredFeatures } = useServiceActions();

    const query = useServiceQuery();

    const layer = useMemo(() => {
        if (pageData.type === "wfs") {
            if (!query.data) return undefined;
            const features = new GeoJSON().readFeatures(query.data);

            return new VectorLayer({
                source: new VectorSource({
                    features,
                }),
                zIndex: 100,
                style: DEFAULT_STYLE,
            });
        } else if (pageData.type === "wms") {
            const url = new URL(pageData.service.linkage);
            url.search = "";
            return new TileLayer({
                source: new TileWMS({
                    url: url.toString(),
                    params: {
                        LAYERS: selectedFeatureType,
                        TILED: true,
                    },
                }),
            });
        }
    }, [
        pageData.service.linkage,
        pageData.type,
        query.data,
        selectedFeatureType,
    ]);

    const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            setPressedKeys((current) => new Set([...current, e.key]));
        };
        const onKeyUp = (e: KeyboardEvent) => {
            setPressedKeys((current) => {
                const newKeys = new Set(current);
                newKeys.delete(e.key);
                return newKeys;
            });
        };

        const onBlur = () => {
            setPressedKeys(new Set());
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onBlur);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onBlur);
        };
    }, []);

    const onMapClick = useCallback(() => {
        const includeCurrent =
            pressedKeys.has("Shift") ||
            pressedKeys.has("Meta") ||
            pressedKeys.has("Control");

        setSelectedFeatures((current) => {
            const newSet: Set<Feature> = includeCurrent
                ? new Set(current)
                : new Set();

            for (const f of hoveredFeatures) {
                if (newSet.has(f)) {
                    newSet.delete(f);
                } else {
                    newSet.add(f);
                }
            }
            return newSet;
        });
    }, [hoveredFeatures, pressedKeys, setSelectedFeatures]);

    const onMapPointerMove = useCallback(
        (e: MapBrowserEvent<any>) => {
            const features = e.map.getFeaturesAtPixel(e.pixel);
            features.sort((a, b) => {
                const aArea = getArea(a.getGeometry() as Geometry);
                const bArea = getArea(b.getGeometry() as Geometry);

                return bArea - aArea;
            });
            features.reverse();

            setHoveredFeatures((current) =>
                current.length === 0 && features.length === 0
                    ? current
                    : features.length
                    ? [features.at(0) as Feature]
                    : []
            );
        },
        [setHoveredFeatures]
    );

    useEffect(() => {
        for (const feature of hoveredFeatures) {
            if (feature.getStyle() === SELECTED_STYLE) continue;
            feature.setStyle(HOVERED_STYLE);
        }

        return () => {
            for (const feature of hoveredFeatures) {
                if (feature.getStyle() === SELECTED_STYLE) continue;
                feature.setStyle(DEFAULT_STYLE);
            }
        };
    }, [hoveredFeatures]);

    useEffect(() => {
        if (!layer || pageData.type === "wms") return;

        for (const feature of selectedFeatures) {
            feature.setStyle(SELECTED_STYLE);
        }

        return () => {
            for (const feature of selectedFeatures) {
                feature.setStyle(DEFAULT_STYLE);
            }
        };
    }, [layer, pageData.type, selectedFeatures]);

    const interaction = useMemo(() => {
        const pressedKeys = new Set<string>();
        window.addEventListener("keydown", (e) => {
            pressedKeys.add(e.key);
        });
        window.addEventListener("keyup", (e) => {
            pressedKeys.delete(e.key);
        });

        return new DragBox({
            condition: () =>
                pressedKeys.has("Shift") ||
                pressedKeys.has("Meta") ||
                pressedKeys.has("Control"),
        });
    }, []);

    useEffect(() => {
        const onBoxEnd = (_: DragBoxEvent) => {
            if (!layer) return;

            const extent = interaction.getGeometry().getExtent();
            const selectedFeatures = (layer.getSource() as VectorSource)
                .getFeaturesInExtent(extent)
                .filter((feature) =>
                    feature.getGeometry()!.intersectsExtent(extent)
                );

            setSelectedFeatures(
                (current) => new Set([...current, ...selectedFeatures])
            );
        };
        interaction.addEventListener("boxend", onBoxEnd as ListenerFunction);

        return () => {
            interaction.removeEventListener(
                "boxend",
                onBoxEnd as ListenerFunction
            );
        };
    }, [interaction, layer, setSelectedFeatures]);

    return (
        <div
            className={cn("h-full w-full relative", {
                "cursor-pointer": hoveredFeatures.length !== 0,
            })}
        >
            <GeoMap
                zoom={zoom}
                setZoom={setZoom}
                center={center}
                setCenter={setCenter}
                onPointerMove={onMapPointerMove}
                onClick={onMapClick}
            >
                <Layer layer={layer} />
                <Interaction interaction={interaction} />
            </GeoMap>
            <div className="absolute right-2 top-2 z-10">
                {query.status === "loading" || query.isPreviousData ? (
                    <Loader2Icon className="h-7 w-7 animate-spin text-primary" />
                ) : query.status === "error" ? (
                    <Tooltip>
                        <TooltipTrigger>
                            <AlertTriangle className="h-7 w-7 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <span className="text-destructive">
                                {(query.error as Error).message}
                            </span>
                        </TooltipContent>
                    </Tooltip>
                ) : null}
            </div>
        </div>
    );
}
