
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Stop, ProcessedArrival, Vehicle } from './types';
import { fetchStopInfo, fetchRealtimeData, fetchVehicles } from './services/carrisService';
import { DEFAULT_STOP_ID, RATP_BLUE, RATP_YELLOW } from './constants';

const App: React.FC = () => {
  const [stopId, setStopId] = useState(DEFAULT_STOP_ID);
  const [stopInfo, setStopInfo] = useState<Stop | null>(null);
  const [arrivals, setArrivals] = useState<ProcessedArrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [searchInput, setSearchInput] = useState(DEFAULT_STOP_ID);
  const [visibleCount, setVisibleCount] = useState(10);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<any[]>([]);

  const loadData = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const info = await fetchStopInfo(id);
      setStopInfo(info);
      const realtime = await fetchRealtimeData(id);
      setArrivals(realtime);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(stopId);
    const interval = setInterval(() => loadData(stopId), 30000); // 30s refresh
    return () => clearInterval(interval);
  }, [stopId, loadData]);

  // Initialize map when selectedLine changes and container is available
  useEffect(() => {
    if (!selectedLine) return;

    const initMap = async () => {
      try {
        // Check if Leaflet is loaded
        let L = (window as any).L;
        if (!L) {
          // Wait for Leaflet to load with timeout
          let attempts = 0;
          while (!L && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            L = (window as any).L;
            attempts++;
          }
        }

        if (!L) {
          console.error('Leaflet not loaded');
          setMapLoading(false);
          return;
        }

        // Wait for container with timeout (max 2 seconds)
        let attempts = 0;
        while (!mapContainerRef.current && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!mapContainerRef.current) {
          console.error('Map container not found');
          setMapLoading(false);
          return;
        }

        // Find the color for the selected line
        const selectedBus = arrivals.find(a => a.lineId === selectedLine);
        const color = selectedBus?.color || '#004494';

        // Initialize map if not exists
        if (!mapRef.current) {
          // Ensure container has dimensions
          if (mapContainerRef.current) {
            mapContainerRef.current.style.height = '100%';
            mapContainerRef.current.style.width = '100%';
            mapContainerRef.current.style.position = 'absolute';
            mapContainerRef.current.style.top = '0';
            mapContainerRef.current.style.left = '0';
          }

          try {
            mapRef.current = L.map(mapContainerRef.current, {
              zoomControl: true,
              preferCanvas: false,
              worldCopyJump: false
            }).setView([38.736946, -9.142685], 13);
            
            const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '© OpenStreetMap contributors',
              crossOrigin: true,
              errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
            });
            
            tileLayer.addTo(mapRef.current);

            // Force map to render by invalidating size multiple times
            const invalidateSize = () => {
              if (mapRef.current) {
                mapRef.current.invalidateSize();
              }
            };

            // Invalidate immediately and then multiple times
            setTimeout(invalidateSize, 50);
            setTimeout(invalidateSize, 200);
            setTimeout(invalidateSize, 500);
            setTimeout(invalidateSize, 1000);
          } catch (mapError) {
            console.error('Error creating map:', mapError);
            setMapLoading(false);
            return;
          }
        } else {
          // If map exists, just invalidate size
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.invalidateSize();
            }
          }, 100);
        }

        // Load vehicles
        const lineVehicles = await fetchVehicles(selectedLine);
        setVehicles(lineVehicles);

        // Update markers
        if (mapRef.current) {
          // Clear existing markers
          markersRef.current.forEach(marker => marker.remove());
          markersRef.current = [];

          if (lineVehicles.length > 0) {
            // Add markers for each vehicle
            const bounds: any[] = [];
            lineVehicles.forEach(vehicle => {
              if (vehicle.lat && vehicle.lon) {
                const busMarker = L.divIcon({
                  className: 'bus-marker-custom',
                  html: `<div style="background-color: ${color}; color: white; border-radius: 8px; padding: 4px 8px; font-weight: bold; font-size: 12px; text-align: center; border: 2px solid rgba(0,0,0,0.3);">${vehicle.line_id}</div>`,
                  iconSize: [50, 25],
                  iconAnchor: [25, 12],
                });

                const marker = L.marker([vehicle.lat, vehicle.lon], { icon: busMarker })
                  .addTo(mapRef.current!);
                
                marker.bindPopup(`
                  <strong>Linha:</strong> ${vehicle.line_id || 'N/A'}<br>
                  <strong>Velocidade:</strong> ${vehicle.speed != null ? vehicle.speed : 'N/A'} km/h<br>
                  <strong>Direção:</strong> ${vehicle.heading != null ? vehicle.heading.toFixed(0) : 'N/A'}°
                `);

                markersRef.current.push(marker);
                bounds.push([vehicle.lat, vehicle.lon]);
              }
            });

            // Fit map to show all vehicles
            if (bounds.length > 0) {
              setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.fitBounds(bounds, { padding: [50, 50] });
                }
              }, 400);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing map:', err);
      } finally {
        // Always set loading to false
        setMapLoading(false);
      }
    };

    // Small delay to ensure DOM is ready
    const timeout = setTimeout(initMap, 100);
    
    return () => {
      clearTimeout(timeout);
    };
  }, [selectedLine, arrivals]);

  // Update vehicles periodically when line is selected
  useEffect(() => {
    if (!selectedLine || !mapRef.current) return;

    const updateVehicles = async () => {
      try {
        const lineVehicles = await fetchVehicles(selectedLine);
        setVehicles(lineVehicles);

        // Update map markers
        const L = (window as any).L;
        if (!L || !mapRef.current) return;

        // Find the color for the selected line
        const selectedBus = arrivals.find(a => a.lineId === selectedLine);
        const color = selectedBus?.color || '#004494';

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        if (lineVehicles.length > 0) {
          // Add markers for each vehicle
          const bounds: any[] = [];
          lineVehicles.forEach(vehicle => {
            if (vehicle.lat && vehicle.lon) {
              const busMarker = L.divIcon({
                className: 'bus-marker-custom',
                html: `<div style="background-color: ${color}; color: white; border-radius: 8px; padding: 4px 8px; font-weight: bold; font-size: 12px; text-align: center; border: 2px solid rgba(0,0,0,0.3);">${vehicle.line_id}</div>`,
                iconSize: [50, 25],
                iconAnchor: [25, 12],
              });

              const marker = L.marker([vehicle.lat, vehicle.lon], { icon: busMarker })
                .addTo(mapRef.current!);
              
                marker.bindPopup(`
                  <strong>Linha:</strong> ${vehicle.line_id || 'N/A'}<br>
                  <strong>Velocidade:</strong> ${vehicle.speed != null ? vehicle.speed : 'N/A'} km/h<br>
                  <strong>Direção:</strong> ${vehicle.heading != null ? vehicle.heading.toFixed(0) : 'N/A'}°
                `);

              markersRef.current.push(marker);
              bounds.push([vehicle.lat, vehicle.lon]);
            }
          });

          // Fit map to show all vehicles
          if (bounds.length > 0 && mapRef.current) {
            setTimeout(() => {
              if (mapRef.current) {
                mapRef.current.fitBounds(bounds, { padding: [50, 50] });
              }
            }, 100);
          }
        }

        // Invalidate size to ensure proper rendering
        if (mapRef.current) {
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.invalidateSize();
            }
          }, 100);
        }
      } catch (err) {
        console.error('Error updating vehicles:', err);
      }
    };

    // Start updating after a delay to ensure map is initialized
    const timeout = setTimeout(updateVehicles, 1000);
    const interval = setInterval(updateVehicles, 10000); // 10s refresh for vehicles
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [selectedLine, arrivals]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setStopId(searchInput.trim());
      setVisibleCount(10); // Reset count on search
    }
  };

  const showMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  const handleLineClick = async (lineId: string, color: string) => {
    if (selectedLine === lineId) {
      // If clicking the same line, close the map
      setSelectedLine(null);
      setVehicles([]);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      return;
    }

    setSelectedLine(lineId);
    setMapLoading(true);
  };

  const displayedArrivals = arrivals.slice(0, visibleCount);
  const hasMore = arrivals.length > visibleCount;

  return (
    <div className="flex flex-col h-screen w-full max-w-7xl mx-auto bg-white shadow-2xl overflow-hidden border-x border-gray-200 selection:bg-blue-100">
      {/* HEADER */}
      <header className="bg-white border-b-[6px] border-[#6f2282] p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="border-2 border-[#004494] px-1.5 sm:px-2 py-0.5 sm:py-1 font-black text-[9px] sm:text-[10px] flex flex-col items-center leading-none text-[#004494] tracking-tighter shrink-0">
            <span>BUS</span>
          </div>
          <div className="truncate min-w-0 flex-1">
            <h1 className="text-base sm:text-lg md:text-xl font-extrabold text-[#004494] uppercase tracking-tight leading-none truncate">
              {loading && !stopInfo ? 'A carregar...' : stopInfo?.name || `Stop ${stopId}`}
            </h1>
            <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold tracking-[0.15em] uppercase mt-0.5 sm:mt-1 truncate">
              {stopInfo?.locality || stopInfo?.municipality_name || 'Carris Metropolitana'}
            </p>
          </div>
        </div>
        <div className="bg-black text-[#ffcd00] px-2 sm:px-3 py-1 sm:py-1.5 digital-font text-lg sm:text-xl md:text-2xl font-bold rounded-sm shadow-inner ring-1 ring-gray-800 shrink-0">
          {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* SEARCH BAR */}
      <div className="bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 border-b flex items-center justify-between gap-2 sm:gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 w-full">
          <input 
            type="text" 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ID da Paragem (ex: 120385)"
            className="flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004494] bg-white transition-all font-medium min-w-0"
          />
          <button type="submit" className="bg-[#004494] text-white px-3 sm:px-5 py-2 text-[10px] sm:text-xs font-bold rounded-lg hover:bg-blue-800 transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0">
            PROCURAR
          </button>
        </form>
      </div>

      {/* ARRIVALS BOARD */}
      <main className="flex-1 overflow-y-auto bg-white">
        {loading && arrivals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#004494] space-y-3 sm:space-y-4 p-4">
             <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-[3px] border-gray-100 border-t-[#004494]"></div>
             <p className="font-bold text-xs sm:text-sm tracking-tight text-gray-400 uppercase">A obter horários...</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <ul className="divide-y divide-gray-100">
              {displayedArrivals.length > 0 ? (
                displayedArrivals.map((bus, idx) => (
                  <li 
                    key={`${bus.lineId}-${bus.minutes}-${idx}`} 
                    onClick={() => handleLineClick(bus.lineId, bus.color)}
                    className={`flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 h-auto min-h-[64px] sm:min-h-[72px] transition-all cursor-pointer hover:bg-blue-50 ${selectedLine === bus.lineId ? 'bg-blue-100 border-l-4 border-[#004494]' : idx % 2 === 1 ? 'bg-[#f8fbfe]' : 'bg-white'}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
                      <div 
                        className="min-w-[48px] sm:min-w-[56px] h-9 sm:h-10 flex items-center justify-center font-extrabold text-base sm:text-lg text-white rounded-md shadow-sm shrink-0"
                        style={{ backgroundColor: bus.color }}
                      >
                        {bus.lineId}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <div className="text-sm sm:text-[15px] font-bold text-[#004494] uppercase truncate tracking-tight">
                          {bus.destination}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className={`text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 rounded-sm tracking-widest ${bus.isRealtime ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                             {bus.isRealtime ? 'LIVE' : 'EST'}
                           </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-black flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg shadow-md border border-gray-800 ml-2 sm:ml-4 shrink-0 transition-transform hover:scale-105">
                      {bus.minutes <= 0 ? (
                        <span className="text-[#ffcd00] font-black text-[9px] sm:text-[10px] digital-font animate-pulse">AGORA</span>
                      ) : bus.minutes > 59 ? (
                        <span className="text-[#ffcd00] font-bold text-sm sm:text-base digital-font">+1h</span>
                      ) : (
                        <>
                          <span className="text-[#ffcd00] font-bold text-xl sm:text-2xl leading-none digital-font">{bus.minutes}</span>
                          <span className="text-[#ffcd00] text-[8px] sm:text-[9px] uppercase font-bold leading-none digital-font mt-0.5">min</span>
                        </>
                      )}
                    </div>
                  </li>
                ))
              ) : (
                <div className="p-8 sm:p-12 md:p-16 text-center text-gray-400 font-bold uppercase text-[10px] sm:text-xs tracking-widest">
                  Sem autocarros previstos brevemente.
                </div>
              )}
            </ul>
            
            {hasMore && (
              <div className="p-3 sm:p-4 flex justify-center border-t border-gray-50">
                <button 
                  onClick={showMore}
                  className="w-full py-2.5 sm:py-3 px-4 sm:px-6 bg-white border border-gray-200 text-[#004494] font-bold text-[10px] sm:text-xs rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 group active:scale-95"
                >
                  <span className="hidden sm:inline">VER MAIS AUTOCARROS</span>
                  <span className="sm:hidden">VER MAIS</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4 transform group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MAP SECTION */}
      {selectedLine && (
        <div className="border-t-4 border-[#004494] bg-white flex flex-col" style={{ height: '400px', maxHeight: '50vh' }}>
          <div className="bg-[#004494] text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Mapa - Linha {selectedLine}</span>
              {vehicles.length > 0 && (
                <span className="text-xs bg-white/20 px-2 py-1 rounded">
                  {vehicles.length} {vehicles.length === 1 ? 'autocarro' : 'autocarros'}
                </span>
              )}
            </div>
            <button
              onClick={() => handleLineClick(selectedLine, '')}
              className="text-white hover:bg-white/20 px-3 py-1 rounded transition-colors"
            >
              ✕ Fechar
            </button>
          </div>
          <div className="flex-1 relative" style={{ minHeight: '300px', height: '100%' }}>
            {/* Map container - always rendered but may be hidden */}
            <div 
              ref={mapContainerRef} 
              className="w-full h-full absolute inset-0" 
              style={{ 
                minHeight: '300px', 
                zIndex: mapLoading ? 0 : 1,
                visibility: mapLoading ? 'hidden' : 'visible'
              }} 
            />
            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-gray-200 border-t-[#004494]"></div>
                  <p className="text-xs text-gray-500 font-medium">A carregar mapa...</p>
                </div>
              </div>
            )}
            {!mapLoading && vehicles.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-20 pointer-events-none">
                <p className="text-sm text-gray-500 font-medium">Nenhum autocarro em serviço para esta linha</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 p-2 sm:p-3 md:p-4 flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="w-4 h-4 sm:w-5 sm:h-5 border-[1.5px] border-[#004494] text-[#004494] flex items-center justify-center text-[10px] sm:text-[11px] font-black rounded-full shrink-0">
          !
        </div>
        <div className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 uppercase tracking-widest flex-1 min-w-0 truncate">
          <span className="hidden sm:inline">Carris Metropolitana • Tempo Real SIEL</span>
          <span className="sm:hidden">Carris Metropolitana</span>
        </div>
        <div className="text-[8px] sm:text-[9px] text-gray-300 font-mono font-bold whitespace-nowrap shrink-0">
          <span className="hidden sm:inline">Refresh Automático: 30s</span>
          <span className="sm:hidden">30s</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
