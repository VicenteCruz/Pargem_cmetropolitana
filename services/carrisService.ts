
import { Stop, RealtimeArrival, ProcessedArrival } from '../types';
import { getLineColor } from '../constants';

const BASE_URL = 'https://api.carrismetropolitana.pt';

export const fetchStopInfo = async (stopId: string): Promise<Stop> => {
  const response = await fetch(`${BASE_URL}/stops/${stopId}`);
  if (!response.ok) throw new Error('Failed to fetch stop info');
  return response.json();
};

export const fetchRealtimeData = async (stopId: string): Promise<ProcessedArrival[]> => {
  const response = await fetch(`${BASE_URL}/stops/${stopId}/realtime`);
  if (!response.ok) throw new Error('Failed to fetch realtime data');
  const data: RealtimeArrival[] = await response.json();

  const now = new Date();
  
  return data
    .map(arrival => {
      const timeString = arrival.estimated_arrival || arrival.scheduled_arrival;
      if (!timeString) return null;

      const [h, m, s] = timeString.split(':').map(Number);
      const arrivalDate = new Date();
      arrivalDate.setHours(h, m, s, 0);

      // Handle midnight rollover
      if (now.getHours() > 20 && h < 4) {
        arrivalDate.setDate(arrivalDate.getDate() + 1);
      }

      const diffMs = arrivalDate.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      return {
        lineId: arrival.line_id,
        destination: arrival.headsign,
        minutes: diffMins,
        isRealtime: !!arrival.estimated_arrival,
        color: getLineColor(arrival.line_id)
      };
    })
    .filter((a): a is ProcessedArrival => a !== null && a.minutes >= -1)
    .sort((a, b) => a.minutes - b.minutes);
};

export const searchStops = async (query: string): Promise<Stop[]> => {
    // Note: The full stops API is large. Usually we'd want a search endpoint, 
    // but here we might just fetch and filter if small, or just allow ID entry.
    // For this app, we'll implement a simple ID-based direct lookup.
    try {
        const stop = await fetchStopInfo(query);
        return [stop];
    } catch {
        return [];
    }
};
