
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

export interface Vehicle {
  id: string;
  lat: number;
  lon: number;
  speed?: number;
  heading?: number;
  line_id: string;
  trip_id: string;
  pattern_id: string;
  timestamp: number;
}

