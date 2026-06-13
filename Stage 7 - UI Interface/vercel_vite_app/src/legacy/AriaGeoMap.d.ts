import type { CSSProperties, FC } from "react";

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type?: "Feature";
    id?: string | number;
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
    properties?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type MapRegionMetric = {
  regionId: string;
  regionName: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

export type ChatMapSelection = {
  location?: string;
  geographyLevel?: "country" | "region" | "city_district" | "custom";
  metric?: string;
  highlightedRegions?: string[];
  filters?: Record<string, unknown>;
  aggregation?: string;
};

export type AriaGeoMapProps = {
  geoJson: GeoJsonFeatureCollection;
  metrics?: MapRegionMetric[];
  chatbotSelection?: ChatMapSelection;
  regionIdProperty?: string;
  regionNameProperty?: string;
  title?: string;
  height?: number | string;
  showLegend?: boolean;
  showControls?: boolean;
  className?: string;
  style?: CSSProperties;
  onRegionHover?: (region: MapRegionMetric | null) => void;
  onRegionClick?: (region: MapRegionMetric | null) => void;
};

declare const AriaGeoMap: FC<AriaGeoMapProps>;

export default AriaGeoMap;
