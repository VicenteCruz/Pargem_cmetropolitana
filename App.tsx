
import React, { useState, useEffect, useCallback } from 'react';
import { Stop, ProcessedArrival, TransitInsight } from './types';
import { fetchStopInfo, fetchRealtimeData } from './services/carrisService';
import { getTransitBriefing } from './services/geminiService';
import { DEFAULT_STOP_ID, RATP_BLUE, RATP_YELLOW } from './constants';

const App: React.FC = () => {
  const [stopId, setStopId] = useState(DEFAULT_STOP_ID);
  const [stopInfo, setStopInfo] = useState<Stop | null>(null);
  const [arrivals, setArrivals] = useState<ProcessedArrival[]>([]);
  const [insight, setInsight] = useState<TransitInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [searchInput, setSearchInput] = useState(DEFAULT_STOP_ID);
  const [visibleCount, setVisibleCount] = useState(10);

  const loadData = useCallback(async (id: string) => {
    setLoading(true);
    // Reset insight on new load
    setInsight(null);
    try {
      const info = await fetchStopInfo(id);
      setStopInfo(info);
      const realtime = await fetchRealtimeData(id);
      setArrivals(realtime);
      setLastUpdated(new Date());

      // Fetch AI-powered briefing if there are arrivals
      if (realtime.length > 0) {
        const briefing = await getTransitBriefing(info.name, realtime);
        setInsight(briefing);
      }
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

  const displayedArrivals = arrivals.slice(0, visibleCount);
  const hasMore = arrivals.length > visibleCount;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white shadow-2xl overflow-hidden border-x border-gray-200 selection:bg-blue-100">
      {/* HEADER */}
      <header className="bg-white border-b-[6px] border-[#6f2282] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 w-3/4">
          <div className="border-2 border-[#004494] px-2 py-1 font-black text-[10px] flex flex-col items-center leading-none text-[#004494] tracking-tighter">
            <span>BUS</span>
          </div>
          <div className="truncate">
            <h1 className="text-xl font-extrabold text-[#004494] uppercase tracking-tight leading-none">
              {loading && !stopInfo ? 'A carregar...' : stopInfo?.name || `Stop ${stopId}`}
            </h1>
            <p className="text-[10px] text-gray-400 font-bold tracking-[0.15em] uppercase mt-1">
              {stopInfo?.locality || stopInfo?.municipality_name || 'Carris Metropolitana'}
            </p>
          </div>
        </div>
        <div className="bg-black text-[#ffcd00] px-3 py-1.5 digital-font text-2xl font-bold rounded-sm shadow-inner ring-1 ring-gray-800">
          {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* SEARCH BAR */}
      <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input 
            type="text" 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ID da Paragem (ex: 120385)"
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004494] bg-white transition-all font-medium"
          />
          <button type="submit" className="bg-[#004494] text-white px-5 py-2 text-xs font-bold rounded-lg hover:bg-blue-800 transition-all shadow-sm active:scale-95">
            PROCURAR
          </button>
        </form>
      </div>

      {/* AI INSIGHT SECTION */}
      {insight && (
        <div className="bg-indigo-50 border-b border-indigo-100 p-4 transition-all animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-600 text-white rounded-lg p-1.5 mt-0.5 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-indigo-900 font-extrabold leading-tight uppercase tracking-[0.1em] mb-1">
                Breve Resumo AI
              </p>
              <p className="text-sm text-indigo-800 leading-snug font-medium">
                {insight.summary}
              </p>
              <p className="text-xs text-indigo-600 mt-2 font-semibold flex items-center gap-1">
                <span className="text-base leading-none">✨</span> {insight.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ARRIVALS BOARD */}
      <main className="flex-1 overflow-y-auto bg-white">
        {loading && arrivals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#004494] space-y-4">
             <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-100 border-t-[#004494]"></div>
             <p className="font-bold text-sm tracking-tight text-gray-400 uppercase">A obter horários...</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <ul className="divide-y divide-gray-100">
              {displayedArrivals.length > 0 ? (
                displayedArrivals.map((bus, idx) => (
                  <li key={`${bus.lineId}-${bus.minutes}-${idx}`} className={`flex items-center justify-between px-4 py-3 h-[72px] transition-all ${idx % 2 === 1 ? 'bg-[#f8fbfe]' : 'bg-white'}`}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div 
                        className="min-w-[56px] h-10 flex items-center justify-center font-extrabold text-lg text-white rounded-md shadow-sm"
                        style={{ backgroundColor: bus.color }}
                      >
                        {bus.lineId}
                      </div>
                      <div className="truncate flex-1">
                        <div className="text-[15px] font-bold text-[#004494] uppercase truncate tracking-tight">
                          {bus.destination}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm tracking-widest ${bus.isRealtime ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                             {bus.isRealtime ? 'LIVE' : 'EST'}
                           </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-black flex flex-col items-center justify-center w-14 h-14 rounded-lg shadow-md border border-gray-800 ml-4 shrink-0 transition-transform hover:scale-105">
                      {bus.minutes <= 0 ? (
                        <span className="text-[#ffcd00] font-black text-[10px] digital-font animate-pulse">AGORA</span>
                      ) : bus.minutes > 59 ? (
                        <span className="text-[#ffcd00] font-bold text-base digital-font">+1h</span>
                      ) : (
                        <>
                          <span className="text-[#ffcd00] font-bold text-2xl leading-none digital-font">{bus.minutes}</span>
                          <span className="text-[#ffcd00] text-[9px] uppercase font-bold leading-none digital-font mt-0.5">min</span>
                        </>
                      )}
                    </div>
                  </li>
                ))
              ) : (
                <div className="p-16 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">
                  Sem autocarros previstos brevemente.
                </div>
              )}
            </ul>
            
            {hasMore && (
              <div className="p-4 flex justify-center border-t border-gray-50">
                <button 
                  onClick={showMore}
                  className="w-full py-3 px-6 bg-white border border-gray-200 text-[#004494] font-bold text-xs rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 group active:scale-95"
                >
                  VER MAIS AUTOCARROS
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 p-4 flex items-center gap-3">
        <div className="w-5 h-5 border-[1.5px] border-[#004494] text-[#004494] flex items-center justify-center text-[11px] font-black rounded-full">
          !
        </div>
        <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest flex-1">
          Carris Metropolitana • Tempo Real SIEL
        </div>
        <div className="text-[9px] text-gray-300 font-mono font-bold">
          Refresh Automático: 30s
        </div>
      </footer>
    </div>
  );
};

export default App;
