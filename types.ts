
export interface Stop {
  id: string;
  name: string;
  locality: string;
  municipality_name: string;
  lat: number;
  lon: number;
}

export interface RealtimeArrival {
  line_id: string;
  headsign: string;
  scheduled_arrival: string;
  estimated_arrival: string | null;
  stop_id: string;
  trip_id: string;
}

export interface ProcessedArrival {
  lineId: string;
  destination: string;
  minutes: number;
  isRealtime: boolean;
  color: string;
}

// Added TransitInsight interface for AI-generated briefings
export interface TransitInsight {
  summary: string;
  recommendation: string;
}
