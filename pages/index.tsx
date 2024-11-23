'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, HistogramData } from 'lightweight-charts';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, X, Loader2, Moon, Sun, Info, Menu, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import nifty50Data from '../public/nifty50.json';
import niftyNext50Data from '../public/niftynext50.json';
import midcap150Data from '../public/midcap150.json';
import smallcap250Data from '../public/smallcap250.json';
import microCap250Data from '../public/microcap250.json';

interface StockData {
  Symbol: string;
  "Company Name": string;
}

interface Stock {
  symbol: string;
  name: string;
}

interface IndexData {
  label: string;
  data: StockData[];
}

interface CurrentStock extends Stock {
  price?: number;
  change?: number;
  todayChange?: number;
}

interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVALS = [
  { label: '1D', value: 'daily', interval: '1d', range: '2y' },
  { label: '1W', value: 'weekly', interval: '1wk', range: '5y' },
  { label: '1M', value: 'monthly', interval: '1mo', range: 'max' },
];

const getChartColors = (isDark: boolean) => ({
  upColor: isDark ? '#22c55e' : '#16a34a',
  downColor: isDark ? '#ef4444' : '#dc2626',
  backgroundColor: 'transparent',
  textColor: isDark ? '#e2e8f0' : '#1e293b',
  gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
});

export default function ModernStockChart() {
  const [indexData] = useState<IndexData[]>([
    { label: 'Nifty 50', data: nifty50Data },
    { label: 'Nifty Next 50', data: niftyNext50Data },
    { label: 'Midcap 150', data: midcap150Data },
    { label: 'Smallcap 250', data: smallcap250Data },
    { label: 'MicroCap 250', data: microCap250Data },
  ]);

  const [selectedIndexId, setSelectedIndexId] = useState(0);
  const [currentStockIndex, setCurrentStockIndex] = useState(0);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [currentStock, setCurrentStock] = useState<CurrentStock | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('chart');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const selectedIndex = indexData[selectedIndexId];
    const stocksList = selectedIndex.data.map(item => ({
      symbol: item.Symbol,
      name: item["Company Name"]
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
      const interval = INTERVALS.find(i => i.value === selectedInterval);

      if (!interval) throw new Error('Invalid interval');

      const response = await axios.get<ChartDataPoint[]>('/api/stockData', {
        params: {
          symbol: currentStock.symbol,
          range: interval.range,
          interval: interval.interval
        }
      });

      if (response.data && Array.isArray(response.data)) {
        setChartData(response.data);
        setCurrentStock({
          ...currentStock,
          price: response.data[response.data.length - 1]?.close,
          change: ((response.data[response.data.length - 1]?.close - response.data[0]?.open) / response.data[0]?.open) * 100,
          todayChange: ((response.data[response.data.length - 1]?.close - response.data[response.data.length - 2]?.close) / response.data[response.data.length - 2]?.close) * 100
        });
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  }, [stocks, currentStockIndex, selectedInterval]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData, currentStockIndex]);

  const createOrUpdateChart = useCallback(() => {
    if (!chartContainerRef.current || !chartData.length) return;

    const isDark = theme === 'dark';
    const chartColors = getChartColors(isDark);

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: chartColors.backgroundColor },
        textColor: chartColors.textColor,
      },
      grid: {
        vertLines: { color: chartColors.gridColor },
        horzLines: { color: chartColors.gridColor },
      },
      rightPriceScale: {
        borderColor: chartColors.gridColor,
      },
      timeScale: {
        borderColor: chartColors.gridColor,
        timeVisible: false,
        rightOffset: 5,
        minBarSpacing: 2,
      },
    });

    chartInstanceRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: chartColors.upColor,
      downColor: chartColors.downColor,
      borderVisible: false,
      wickUpColor: chartColors.upColor,
      wickDownColor: chartColors.downColor,
    });

    candlestickSeriesRef.current = candlestickSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: chartColors.upColor,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeriesRef.current = volumeSeries;

    candlestickSeries.setData(chartData as CandlestickData[]);
    volumeSeries.setData(chartData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? chartColors.upColor : chartColors.downColor,
    } as HistogramData)));

    candlestickSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.2,
      },
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chart.timeScale().fitContent();

    setTimeout(() => {
      if (chartInstanceRef.current && chartContainerRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    }, 0);
  }, [chartData, theme]);

  useEffect(() => {
    if (activeTab === 'chart' && chartData.length > 0) {
      createOrUpdateChart();
    }
  }, [activeTab, createOrUpdateChart, chartData]);

  useEffect(() => {
    const handleResize = () => {
      if (chartInstanceRef.current && chartContainerRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleIntervalChange = (newInterval: string) => {
    setSelectedInterval(newInterval);
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

  const handleStockSelection = (stockIndex: number) => {
    setCurrentStockIndex(stockIndex);
    setSearchTerm('');
    setShowDropdown(false);
    setActiveTab('chart');
    fetchStockData();
  };

  const handleIndexChange = (value: string) => {
    const newIndex = parseInt(value);
    setSelectedIndexId(newIndex);
    setCurrentStockIndex(0);
    setSearchTerm('');
    fetchStockData();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStocks = stocks.filter(stock => 
    searchTerm === '' || 
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    if (value.length > 0) {
      const filtered = stocks.filter(stock => 
        stock.symbol.toLowerCase().includes(value.toLowerCase()) ||
        stock.name.toLowerCase().includes(value.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 10));
    } else {
      setSearchResults([]);
    }
  }, [stocks]);

  if (!mounted) return null

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">StockVue</h1>
        <div className="flex items-center space-x-4 flex-grow max-w-2xl mx-4">
          <Select
            value={selectedIndexId.toString()}
            onValueChange={handleIndexChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Index" />
            </SelectTrigger>
            <SelectContent>
              {indexData.map((item, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-grow">
            <Command className="rounded-lg border shadow-md">
              <CommandInput
                placeholder="Search stocks..."
                value={searchTerm}
                onValueChange={handleSearch}
              />
              {searchResults.length > 0 && (
                <CommandList>
                  {searchResults.map((stock) => (
                    <CommandItem
                      key={stock.symbol}
                      onSelect={() => handleStockSelection(stocks.findIndex((s) => s.symbol === stock.symbol))}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{stock.symbol}</span>
                        <span className="text-sm text-muted-foreground">{stock.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandList>
              )}
              {searchResults.length === 0 && searchTerm.length > 0 && <CommandEmpty>No results found.</CommandEmpty>}
            </Command>
          </div>
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="h-[1.2rem] w-[1.2rem]" /> : <Sun className="h-[1.2rem] w-[1.2rem]" />}
          </Button>
        </div>
      </header>

      <main className="flex-grow overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Chart and Info */}
          <div className="flex-grow p-4 overflow-y-auto">
            <AnimatePresence mode="wait">
              {currentStock && (
                <motion.div
                  key={currentStock.symbol}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="mb-2">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h2 className="text-xl font-bold">{currentStock.symbol}</h2>
                          <p className="text-sm text-muted-foreground">{currentStock.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">₹{currentStock.price?.toFixed(2)}</p>
                          <Badge 
                            variant={currentStock.todayChange && currentStock.todayChange >= 0 ? "default" : "destructive"} 
                            className="text-sm px-2 py-0.5"
                          >
                            {currentStock.todayChange && currentStock.todayChange >= 0 ? (
                              <ArrowUpRight className="inline mr-1 h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="inline mr-1 h-3 w-3" />
                            )}
                            {Math.abs(currentStock.todayChange || 0).toFixed(2)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Open</p>
                          <p className="font-medium">₹{chartData[chartData.length - 1]?.open.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Close</p>
                          <p className="font-medium">₹{chartData[chartData.length - 1]?.close.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">High</p>
                          <p className="font-medium">₹{chartData[chartData.length - 1]?.high.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Low</p>
                          <p className="font-medium">₹{chartData[chartData.length - 1]?.low.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card>
              <CardContent className="p-0">
                <Tabs defaultValue="chart" className="w-full" onValueChange={(value) => setActiveTab(value)}>
                  <TabsList className="w-full justify-start rounded-none border-b flex items-center">
                    <TabsTrigger value="chart">Chart</TabsTrigger>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="chart" className="p-4">
                    <div className="h-[400px]" ref={chartContainerRef}></div>
                    <div className="mt-4 flex justify-between items-center">
                      <div className="space-x-2">
                        {INTERVALS.map((interval) => (
                          <Button
                            key={interval.value}
                            variant={selectedInterval === interval.value ? "default" : "outline"}
                            onClick={() => setSelectedInterval(interval.value)}
                            size="sm"
                          >
                            {interval.label}
                          </Button>
                        ))}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrevious}
                          disabled={currentStockIndex === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNext}
                          disabled={currentStockIndex === stocks.length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="overview" className="p-6">
                    <p>Overview content here...</p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {loading && (
        <div className="absolute inset-0 flex justify-center items-center bg-background/50 backdrop-blur-sm">
          <Loader2 className="animate-spin h-8 w-8 text-primary"/>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex justify-center items-center bg-background/50 backdrop-blur-sm">
          <Card className="p-4 max-w-md">
            <CardContent>
              <h3 className="text-lg font-semibold text-destructive mb-2">Error</h3>
              <p>{error}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

