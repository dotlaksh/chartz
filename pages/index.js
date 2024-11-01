'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

import nifty50Data from '/public/nifty50.json';
import niftyNext50Data from '/public/niftynext50.json';
import midcap150Data from '/public/midcap150.json';
import smallcap250Data from '/public/smallcap250.json';
import microCap250Data from '/public/microcap250.json';

const TIME_PERIODS = [
  { label: '1Y', range: '1y' ,autoInterval: 'daily'},
  { label: '5Y', range: '5y' ,autoInterval: 'weekly' },
  { label: 'Max', range: 'max' ,autoInterval: 'monthly' },
];

const INTERVALS = [
  { label: 'D', value: 'daily', interval: '1d', autoTimeframe: '1Y' },
  { label: 'W', value: 'weekly', interval: '1wk', autoTimeframe: '5Y' },
  { label: 'M', value: 'monthly', interval: '1mo', autoTimeframe: 'Max' },
];

const StockChart = () => {
  const [indexData] = useState([
    { label: 'Nifty 50', data: nifty50Data },
    { label: 'Nifty Next 50', data: niftyNext50Data },
    { label: 'Midcap 150', data: midcap150Data },
    { label: 'Smallcap 250', data: smallcap250Data },
    { label: 'MicroCap 250', data: microCap250Data },
  ]);
  const [selectedIndexId, setSelectedIndexId] = useState(0);
  const [currentStockIndex, setCurrentStockIndex] = useState(0);
  const [stocks, setStocks] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [currentStock, setCurrentStock] = useState(null);

  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearching(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (value.trim() === '') {
      setFilteredStocks([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const searchResults = stocks.filter(stock => 
      stock.symbol.toLowerCase().includes(value.toLowerCase()) ||
      stock.name.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 5);
    setFilteredStocks(searchResults);
  };

  const handleSelectStock = (stockIndex) => {
    setCurrentStockIndex(stockIndex);
    setSearchTerm('');
    setIsSearching(false);
    setFilteredStocks([]);
  };

  const getChartHeight = useCallback(() => {
    return window.innerWidth < 768 ? 580 : 700;
  }, []);

  useEffect(() => {
    const selectedIndex = indexData[selectedIndexId];
    const stocksList = selectedIndex.data.map(item => ({
      symbol: item.Symbol,
      name: item["Company Name"],
      industry: item.Industry
    }));
    setStocks(stocksList);
    setCurrentStockIndex(0);
  }, [selectedIndexId, indexData]);

  const fetchStockData = useCallback(async () => {
    if (!stocks.length) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const currentStock = stocks[currentStockIndex];
      const period = TIME_PERIODS.find(p => p.label === selectedPeriod);
      const interval = INTERVALS.find(i => i.value === selectedInterval);

      const response = await axios.get('/api/stockData', {
        params: {
          symbol: currentStock.symbol,
          range: period.range,
          interval: interval.interval
        }
      });

      if (response.data && Array.isArray(response.data)) {
        setChartData(response.data);
        setCurrentStock({
          name: currentStock.name,
          symbol: currentStock.symbol,
          industry: currentStock.industry,
          price: response.data[response.data.length - 1]?.close,
          change: ((response.data[response.data.length - 1]?.close - response.data[0]?.open) / response.data[0]?.open) * 100,
          todayChange: ((response.data[response.data.length - 1]?.close - response.data[response.data.length - 2]?.close) / response.data[response.data.length - 2]?.close) * 100
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  }, [stocks, currentStockIndex, selectedPeriod, selectedInterval]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData.length) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: getChartHeight(),
      layout: { background: { type: 'solid', color: '#1e293b' }, textColor: '#e2e8f0' },
      crosshair: { mode: CrosshairMode.Normal },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      timeScale: {
        timezone: 'Asia/Kolkata',  // Set to Indian timezone
        timeVisible: false,
        borderColor: '#cbd5e1',
        rightOffset: 5,
        minBarSpacing: 10,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      priceScale: {
        mode: 'logarithmic',
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00ff55',
      downColor: '#ed4807',
      borderUpColor: '#00ff55',
      borderDownColor: '#ed4807',
      wickUpColor: '#00ff55',
      wickDownColor: '#ed4807',
      priceScaleId: 'right',
    });

    candlestickSeries.setData(chartData);

    const volumeSeries = chart.addHistogramSeries({
      upColor: '#00ff55',
      downColor: '#ed4807',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    volumeSeries.setData(chartData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? '#00ff55' : '#ed4807',
    })));

    candlestickSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.2,
      }
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
    });

    chart.timeScale().fitContent();
    chartInstanceRef.current = chart;

    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: getChartHeight(),
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData, getChartHeight]);

  const handlePeriodChange = (newPeriod) => {
    setSelectedPeriod(newPeriod);
    const autoInterval = TIME_PERIODS.find((p) => p.label === newPeriod)?.autoInterval;
    if (autoInterval) {
      setSelectedInterval(autoInterval);
    }
  };
  const handleIntervalChange = (newInterval) => {
    const autoTimeframe = INTERVALS.find((i) => i.value === newInterval)?.autoTimeframe;
    setSelectedInterval(newInterval);
    if (autoTimeframe) {
      setSelectedPeriod(autoTimeframe);
    }
  };

  const handlePrevious = () => {
    if (currentStockIndex > 0) {
      setCurrentStockIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentStockIndex < stocks.length - 1) {
      setCurrentStockIndex(prev => prev + 1);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1e293b] overflow-x-hidden">
      <header className="bg-[#1e293b] border-b border-[#334155] px-4 sm:px-4 py-3">
        <div className="max-w-screen max-w-6xl mx-auto w-full flex justify-between items-center px-4">
          <select
            className="text-sm font-medium bg-[#1e293b] text-[#e2e8f0] focus:outline-none"
            value={selectedIndexId}
            onChange={(e) => setSelectedIndexId(parseInt(e.target.value))}
          >
            {indexData.map((item, index) => (
              <option key={index} value={index}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="relative" ref={searchRef}>
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-500">
              <Search className="h-4 w-4 text-slate-400 ml-2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search stocks..."
                className="w-40 sm:w-64 px-2 py-1.5 text-sm bg-transparent text-white placeholder-slate-400 focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilteredStocks([]);
                    setIsSearching(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {isSearching && filteredStocks.length > 0 && (
              <div className="absolute right-0 mt-2 w-full sm:w-96 bg-slate-800 rounded-lg shadow-lg border border-slate-700 z-50">
                <ul className="py-1">
                  {filteredStocks.map((stock) => {
                    const stockIndex = stocks.findIndex(s => s.symbol === stock.symbol);
                    return (
                      <li key={stock.symbol}>
                        <button
                          onClick={() => handleSelectStock(stockIndex)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-700 focus:outline-none"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-white font-medium">{stock.symbol}</p>
                              <p className="text-slate-400 text-sm truncate">{stock.name}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {isSearching && searchTerm && filteredStocks.length === 0 && (
              <div className="absolute right-0 mt-2 w-full sm:w-96 bg-slate-800 rounded-lg shadow-lg border border-slate-700 z-50">
                <div className="px-4 py-3 text-slate-400 text-sm">
                  No stocks found
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {currentStock && (
        <div className="bg-[#1e293b] text-[#e2e8f0]">
          <div className="max-w-6xl mx-auto px-2 sm:px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-base truncate">{currentStock.symbol}</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{currentStock.name}</p>
              </div>
              <div className="text-right ml-4">
                <p className="font-medium text-base">
                  ₹{currentStock.price?.toFixed(2)}
                </p>
                <p className={`text-sm ${currentStock.todayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {currentStock.todayChange >= 0 ? '+' : ''}{currentStock.todayChange?.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#1e293b] text-[#e2e8f0] overflow-x-auto">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2">
          <div className="flex justify-between items-center min-w-max">
            <div className="flex gap-1 sm:gap-2">
              {TIME_PERIODS.map((period) => (
                <button
                  key={period.label}
                  onClick={() => setSelectedPeriod(period.label)}
                  className={`px-2 sm:px-3 py-1 text-xs rounded-full ${
                    selectedPeriod === period.label
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 ml-2 sm:ml-4">
              {INTERVALS.map((interval) => (
                <button
                  key={interval.value}
                  onClick={() => handleIntervalChange(interval.value)}
                  className={`px-2 sm:px-3 py-1 text-xs rounded-full ${
                    selectedInterval === interval.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {interval.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <main className="flex-grow bg-[#1e293b]">
        <div className="max-w-6xl mx-auto px-2 sm:px-4">
          <div className="bg-[#1e293b] rounded-lg shadow-lg border border-[#334155] overflow-hidden">
            {loading ? (
              <div className="h-[505px] md:h-[700px] w-full flex items-center justify-center">
              </div>
            ) : error ? (
              <div className="h-[550px] md:h-[700px] w-full flex items-center justify-center text-red-500">
                {error}
              </div>
            ) : (
              <div ref={chartContainerRef} className="w-full h-[550px] md:h-[700px]" />
            )}
          </div>
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="bg-[#1e293b] fixed bottom-0 left-0 right-0 text-[#e2e8f0] w-full">
        <div className="max-w-6xl mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between px-4 sm:px-4 py-2 bg-slate-800 rounded-lg shadow-lg">
            <button
              onClick={handlePrevious}
              disabled={currentStockIndex === 0}
              className="flex items-center gap-1 px-2 py-2 text-sm font-medium text-white bg-slate-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              <span className="sr-only sm:not-sr-only sm:inline">Previous</span>
            </button>
            
            <div className="flex items-center px-2 py-2 bg-slate-700 rounded-md">
              <span className="text-sm font-medium text-slate-200">{currentStockIndex + 1}</span>
              <span className="mx-1 text-slate-400">/</span>
              <span className="text-sm font-medium text-slate-400">{stocks.length}</span>
            </div>
            
            <button
              onClick={handleNext}
              disabled={currentStockIndex === stocks.length - 1}
              className="flex items-center gap-1 px-2 py-2 text-sm font-medium text-white bg-slate-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only sm:not-sr-only sm:inline">Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StockChart;
