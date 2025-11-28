<script lang="ts">
    import { onMount } from 'svelte';
    import { db } from '$lib/db';
    import { apiKey, customerSegments, realTimeInsights, insightsLoading, lastInsightsUpdate, weatherApiKey, storeLocation, currentWeather, isWeatherConfigured } from '$lib/stores';
    import { 
        batchExtractFeatures, 
        runAllClustering, 
        enhanceSegmentsWithAI,
        generateRealTimeInsights,
        getRecentSales,
        getTodaySales,
        getDailySummary,
        predictWeeklyPattern,
        predictHourlyPattern,
        detectSeasonalPatterns,
        formatCurrency,
        getDayName,
        getShortDayName,
        formatHour,
        getCategoryDisplayName,
        getSegmentTypeDisplayName,
        getConfidenceLabel,
        getConfidenceColor,
        sortSegmentsByRelevance,
        filterActiveInsights,
        generateSegmentSummary,
        isPayrollDay
    } from '$lib/customer-insights';
    import type { CustomerSegment, RealTimeInsight, TransactionFeatures } from '$lib/customer-insights/types';
    import type { Sale } from '$lib/types';
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import * as Tabs from '$lib/components/ui/tabs';
    import { 
        Brain, RefreshCw, Sparkles, DollarSign, Users, Zap, Clock, 
        TrendingUp, TrendingDown, Package, Calendar, BarChart3, 
        Activity, Target, Wallet, CheckCircle, ArrowRight, CloudRain, Cloud, Sun, CloudDrizzle, Droplets
    } from 'lucide-svelte';
    import { 
        fetchWeatherByCity, 
        analyzeWeatherImpact, 
        getWeatherConditionInfo,
        getPrecipitationInfo,
        createWeatherRecord,
        type CurrentWeather,
        type WeatherImpact,
        type WeatherRecord
    } from '$lib/weather';
    
    // Icon mapping for insight types
    function getInsightIcon(type: RealTimeInsight['insightType']) {
        switch (type) {
            case 'traffic': return Users;
            case 'revenue': return DollarSign;
            case 'product_demand': return Package;
            case 'operational': return Activity;
            default: return Zap;
        }
    }
    
    // State
    let allSales: Sale[] = [];
    let allFeatures: TransactionFeatures[] = [];
    let segments: CustomerSegment[] = [];
    let insights: RealTimeInsight[] = [];
    let dailySummary = { totalSales: 0, totalRevenue: 0, avgBasketSize: 0, peakHour: 0, topCategories: [] as string[] };
    let weeklyPattern: Awaited<ReturnType<typeof predictWeeklyPattern>> | null = null;
    let hourlyPattern: Array<{ hour: number; expectedRevenue: number; expectedTransactions: number }> = [];
    let seasonalPatterns: Awaited<ReturnType<typeof detectSeasonalPatterns>> | null = null;
    
    // Weather state
    let weather: CurrentWeather | null = null;
    let weatherImpact: WeatherImpact | null = null;
    let weatherLoading = false;
    let precipitationAnalysis: { rainyDays: number; clearDays: number; rainyDayAvgSales: number; clearDayAvgSales: number; trafficDifference: number } | null = null;
    
    let loading = true;
    let analyzing = false;
    let error = '';
    let selectedTab = 'overview';
    let selectedSegment: CustomerSegment | null = null;
    
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    
    onMount(async () => {
        await loadData();
    });
    
    async function loadData() {
        loading = true;
        error = '';
        
        try {
            // Load all sales
            allSales = await db.sales.toArray();
            
            // Extract features from last 30 days
            allFeatures = batchExtractFeatures(allSales, 30);
            
            // Run clustering
            const clusteringResult = runAllClustering(allFeatures);
            segments = [
                ...clusteringResult.temporalSegments,
                ...clusteringResult.valueSegments,
                ...clusteringResult.preferenceSegments
            ];
            
            // Sort by relevance
            segments = sortSegmentsByRelevance(segments, currentHour, currentDay);
            customerSegments.set(segments);
            
            // Generate real-time insights
            const recentSales = await getRecentSales(60);
            insights = await generateRealTimeInsights(recentSales, segments, currentHour, currentDay);
            realTimeInsights.set(insights);
            
            // Get daily summary
            dailySummary = await getDailySummary();
            
            // Get weekly pattern
            weeklyPattern = await predictWeeklyPattern(4);
            
            // Get hourly pattern for today
            hourlyPattern = await predictHourlyPattern(currentDay, 4);
            
            // Get seasonal patterns
            seasonalPatterns = await detectSeasonalPatterns(90);
            
            // Load weather data if configured
            await loadWeatherData();
            
            // Calculate precipitation impact analysis
            await calculatePrecipitationAnalysis();
            
            lastInsightsUpdate.set(new Date());
            
        } catch (err) {
            console.error('Error loading insights:', err);
            error = 'Error loading insights data';
        } finally {
            loading = false;
        }
    }
    
    async function loadWeatherData() {
        if (!$isWeatherConfigured) return;
        
        weatherLoading = true;
        try {
            const weatherData = await fetchWeatherByCity($storeLocation);
            if (weatherData) {
                weather = weatherData;
                currentWeather.set(weatherData);
                weatherImpact = analyzeWeatherImpact(weatherData);
                
                // Save weather record for historical analysis
                const record = createWeatherRecord(weatherData);
                const existingRecord = await db.weatherRecords.where('date').equals(record.date).first();
                if (!existingRecord) {
                    await db.weatherRecords.add(record);
                }
                
                // Add weather-based insight if it's raining
                if (weatherImpact.isRainyDay && weatherImpact.expectedTrafficChange < 0) {
                    const weatherInsight: RealTimeInsight = {
                        insightType: 'traffic',
                        message: `🌧️ Rainy weather detected! Expect ${Math.abs(weatherImpact.expectedTrafficChange)}% lower foot traffic`,
                        confidence: 0.85,
                        actionItems: weatherImpact.recommendations,
                        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
                        createdAt: new Date()
                    };
                    insights = [weatherInsight, ...insights];
                    realTimeInsights.set(insights);
                }
            }
        } catch (err) {
            console.error('Error loading weather:', err);
        } finally {
            weatherLoading = false;
        }
    }
    
    async function calculatePrecipitationAnalysis() {
        try {
            // Get weather records for analysis
            const weatherRecords = await db.weatherRecords.toArray();
            if (weatherRecords.length < 2) {
                precipitationAnalysis = null;
                return;
            }
            
            // Group sales by date
            const salesByDate: Record<string, Sale[]> = {};
            allSales.forEach(sale => {
                const dateKey = sale.date.split('T')[0];
                if (!salesByDate[dateKey]) salesByDate[dateKey] = [];
                salesByDate[dateKey].push(sale);
            });
            
            // Calculate metrics for rainy vs clear days
            let rainyDaySales: number[] = [];
            let clearDaySales: number[] = [];
            
            weatherRecords.forEach(record => {
                const sales = salesByDate[record.date];
                if (!sales || sales.length === 0) return;
                
                const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
                
                if (record.precipitationLevel !== 'none') {
                    rainyDaySales.push(totalSales);
                } else {
                    clearDaySales.push(totalSales);
                }
            });
            
            if (rainyDaySales.length > 0 && clearDaySales.length > 0) {
                const rainyAvg = rainyDaySales.reduce((a, b) => a + b, 0) / rainyDaySales.length;
                const clearAvg = clearDaySales.reduce((a, b) => a + b, 0) / clearDaySales.length;
                const difference = clearAvg > 0 ? ((rainyAvg - clearAvg) / clearAvg) * 100 : 0;
                
                precipitationAnalysis = {
                    rainyDays: rainyDaySales.length,
                    clearDays: clearDaySales.length,
                    rainyDayAvgSales: rainyAvg,
                    clearDayAvgSales: clearAvg,
                    trafficDifference: difference
                };
            }
        } catch (err) {
            console.error('Error calculating precipitation analysis:', err);
        }
    }
    
    async function runAIAnalysis() {
        if (!$apiKey) {
            error = 'Please configure your API key in Settings first';
            return;
        }
        
        analyzing = true;
        insightsLoading.set(true);
        
        try {
            // Enhance segments with AI
            segments = await enhanceSegmentsWithAI(segments, allFeatures);
            customerSegments.set(segments);
            
            // Save to database
            await db.customerSegments.clear();
            for (const segment of segments) {
                await db.customerSegments.add(segment);
            }
            
        } catch (err) {
            console.error('AI analysis error:', err);
            error = 'Error running AI analysis';
        } finally {
            analyzing = false;
            insightsLoading.set(false);
        }
    }
    
    function selectSegment(segment: CustomerSegment) {
        selectedSegment = selectedSegment?.segmentId === segment.segmentId ? null : segment;
    }
    
    // Reactive formatting
    $: activeInsightsList = filterActiveInsights(insights);
    $: temporalSegments = segments.filter(s => s.segmentType === 'temporal');
    $: valueSegments = segments.filter(s => s.segmentType === 'basket_value');
    $: preferenceSegments = segments.filter(s => s.segmentType === 'product_preference');
</script>

<svelte:head>
    <title>Customer Insights | Mini Market</title>
</svelte:head>

<div class="container mx-auto p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Brain size={36} class="text-primary" />
                Customer Insights
            </h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">
                AI-powered analytics for anonymous customer behavior
            </p>
        </div>
        <div class="flex items-center gap-3">
            {#if $lastInsightsUpdate}
                <span class="text-sm text-gray-500">
                    Updated: {$lastInsightsUpdate.toLocaleTimeString()}
                </span>
            {/if}
            <Button variant="outline" on:click={loadData} disabled={loading}>
                <RefreshCw size={16} class={loading ? 'animate-spin mr-2' : 'mr-2'} />
                Refresh
            </Button>
            <Button on:click={runAIAnalysis} disabled={analyzing || !$apiKey}>
                {#if analyzing}
                    <RefreshCw size={16} class="animate-spin mr-2" />
                    Analyzing...
                {:else}
                    <Sparkles size={16} class="mr-2" />
                    Run AI Analysis
                {/if}
            </Button>
        </div>
    </div>
    
    {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
        </div>
    {/if}
    
    {#if loading}
        <div class="flex items-center justify-center py-20">
            <div class="text-center">
                <RefreshCw size={48} class="animate-spin mx-auto mb-4 text-gray-400" />
                <p class="text-gray-500">Loading insights...</p>
            </div>
        </div>
    {:else}
        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card.Root class="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <Card.Content class="pt-6">
                    <div class="text-sm opacity-80">Today's Sales</div>
                    <div class="text-3xl font-bold">{dailySummary.totalSales}</div>
                    <div class="text-sm opacity-80 mt-1">transactions</div>
                </Card.Content>
            </Card.Root>
            
            <Card.Root class="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <Card.Content class="pt-6">
                    <div class="text-sm opacity-80">Today's Revenue</div>
                    <div class="text-3xl font-bold">{formatCurrency(dailySummary.totalRevenue)}</div>
                    <div class="text-sm opacity-80 mt-1">
                        Avg: {formatCurrency(dailySummary.avgBasketSize)}
                    </div>
                </Card.Content>
            </Card.Root>
            
            <Card.Root class="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <Card.Content class="pt-6">
                    <div class="text-sm opacity-80">Customer Segments</div>
                    <div class="text-3xl font-bold">{segments.length}</div>
                    <div class="text-sm opacity-80 mt-1">identified patterns</div>
                </Card.Content>
            </Card.Root>
            
            <Card.Root class="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                <Card.Content class="pt-6">
                    <div class="text-sm opacity-80">Active Insights</div>
                    <div class="text-3xl font-bold">{activeInsightsList.length}</div>
                    <div class="text-sm opacity-80 mt-1">actionable alerts</div>
                </Card.Content>
            </Card.Root>
        </div>
        
        <!-- Weather Card -->
        {#if weather}
            {@const conditionInfo = getWeatherConditionInfo(weather.condition)}
            {@const precipInfo = getPrecipitationInfo(weather.precipitation)}
            <Card.Root class="bg-gradient-to-br from-sky-500 to-blue-600 text-white overflow-hidden relative">
                <div class="absolute top-0 right-0 opacity-10">
                    <CloudRain size={120} class="transform translate-x-6 -translate-y-2" />
                </div>
                <Card.Content class="pt-6 relative">
                    <div class="flex items-start justify-between">
                        <div>
                            <div class="text-sm opacity-80 flex items-center gap-2">
                                <CloudRain size={14} />
                                Current Weather
                            </div>
                            <div class="flex items-center gap-3 mt-2">
                                <img 
                                    src="https://openweathermap.org/img/wn/{weather.icon}@2x.png" 
                                    alt={weather.description}
                                    class="w-16 h-16 -ml-2"
                                />
                                <div>
                                    <div class="text-4xl font-bold">{weather.temperature}°C</div>
                                    <div class="text-sm opacity-80 capitalize">{weather.description}</div>
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm opacity-80">{weather.location.city}</div>
                            <div class="mt-2">
                                <Badge variant="secondary" class="bg-white/20 text-white border-0">
                                    {conditionInfo.emoji} {conditionInfo.label}
                                </Badge>
                            </div>
                            {#if weather.precipitation !== 'none'}
                                <div class="mt-1">
                                    <Badge variant="secondary" class="bg-white/30 text-white border-0">
                                        <Droplets size={12} class="mr-1" />
                                        {precipInfo.label} Rain
                                    </Badge>
                                </div>
                            {/if}
                        </div>
                    </div>
                    {#if weatherImpact && weatherImpact.expectedTrafficChange !== 0}
                        <div class="mt-4 pt-3 border-t border-white/20 flex items-center gap-2 text-sm">
                            {#if weatherImpact.expectedTrafficChange < 0}
                                <TrendingDown size={16} />
                                <span>Expected {Math.abs(weatherImpact.expectedTrafficChange)}% lower traffic due to weather</span>
                            {:else}
                                <TrendingUp size={16} />
                                <span>Good weather conditions for foot traffic</span>
                            {/if}
                        </div>
                    {/if}
                </Card.Content>
            </Card.Root>
        {:else if $isWeatherConfigured && weatherLoading}
            <Card.Root class="bg-gradient-to-br from-sky-500 to-blue-600 text-white">
                <Card.Content class="pt-6 flex items-center gap-3">
                    <RefreshCw size={20} class="animate-spin" />
                    <span>Loading weather data...</span>
                </Card.Content>
            </Card.Root>
        {:else if !$isWeatherConfigured}
            <Card.Root class="bg-muted/50 border-dashed">
                <Card.Content class="pt-6 flex items-center gap-3 text-muted-foreground">
                    <CloudRain size={24} />
                    <div>
                        <div class="font-medium">Weather Integration Available</div>
                        <div class="text-sm">Configure in Settings to see weather impact on sales</div>
                    </div>
                </Card.Content>
            </Card.Root>
        {/if}
        
        <!-- Payroll Day Alert -->
        {#if isPayrollDay()}
            <div class="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-3">
                <Wallet size={24} class="text-amber-600" />
                <div>
                    <strong>Payroll Day!</strong> Expect increased traffic and larger purchases today (15th/30th).
                </div>
            </div>
        {/if}
        
        <!-- Real-Time Insights Feed -->
        {#if activeInsightsList.length > 0}
            <Card.Root>
                <Card.Header>
                    <Card.Title class="flex items-center gap-2">
                        <Zap size={18} class="text-yellow-500" /> Real-Time Insights
                    </Card.Title>
                    <Card.Description>
                        Live alerts and recommendations based on current activity
                    </Card.Description>
                </Card.Header>
                <Card.Content>
                    <div class="space-y-3">
                        {#each activeInsightsList as insight}
                            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <svelte:component this={getInsightIcon(insight.insightType)} size={24} class="text-primary mt-0.5" />
                                <div class="flex-1">
                                    <p class="font-medium">{insight.message}</p>
                                    {#if insight.actionItems && insight.actionItems.length > 0}
                                        <ul class="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                            {#each insight.actionItems as action}
                                                <li class="flex items-center gap-2">
                                                    <CheckCircle size={14} class="text-green-500" />
                                                    {action}
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                </div>
                                <Badge variant="outline" class={getConfidenceColor(insight.confidence)}>
                                    {getConfidenceLabel(insight.confidence)}
                                </Badge>
                            </div>
                        {/each}
                    </div>
                </Card.Content>
            </Card.Root>
        {/if}
        
        <!-- Main Tabs -->
        <Tabs.Root bind:value={selectedTab}>
            <Tabs.List class="grid w-full grid-cols-4">
                <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
                <Tabs.Trigger value="segments">Segments</Tabs.Trigger>
                <Tabs.Trigger value="patterns">Patterns</Tabs.Trigger>
                <Tabs.Trigger value="predictions">Predictions</Tabs.Trigger>
            </Tabs.List>
            
            <!-- Overview Tab -->
            <Tabs.Content value="overview" class="space-y-6 mt-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Top Segments -->
                    <Card.Root>
                        <Card.Header>
                            <Card.Title>Top Customer Segments</Card.Title>
                            <Card.Description>Most active segments right now</Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <div class="space-y-4">
                                {#each segments.slice(0, 5) as segment}
                                    <button
                                        class="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        on:click={() => selectSegment(segment)}
                                    >
                                        <div class="flex items-center justify-between">
                                            <div>
                                                <div class="font-medium">{segment.segmentName}</div>
                                                <div class="text-sm text-gray-500">
                                                    {getSegmentTypeDisplayName(segment.segmentType)} • {segment.transactionCount} transactions
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <div class="font-bold text-green-600">
                                                    {formatCurrency(segment.avgBasketValue)}
                                                </div>
                                                <div class="text-xs text-gray-500">avg basket</div>
                                            </div>
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </Card.Content>
                    </Card.Root>
                    
                    <!-- Today's Peak Hours -->
                    <Card.Root>
                        <Card.Header>
                            <Card.Title>Today's Traffic Pattern</Card.Title>
                            <Card.Description>Expected transactions by hour</Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <div class="space-y-2">
                                {#each hourlyPattern.filter(h => h.expectedTransactions > 0).sort((a, b) => b.expectedTransactions - a.expectedTransactions).slice(0, 8) as hour}
                                    <div class="flex items-center gap-3">
                                        <div class="w-16 text-sm font-medium">
                                            {formatHour(hour.hour)}
                                        </div>
                                        <div class="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div 
                                                class="h-full bg-blue-500 rounded-full transition-all"
                                                class:bg-green-500={hour.hour === currentHour}
                                                style="width: {Math.min(100, (hour.expectedTransactions / Math.max(...hourlyPattern.map(h => h.expectedTransactions))) * 100)}%"
                                            ></div>
                                        </div>
                                        <div class="w-20 text-sm text-right">
                                            {hour.expectedTransactions.toFixed(1)} txn
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </Card.Content>
                    </Card.Root>
                </div>
                
                <!-- Weekly Overview -->
                {#if weeklyPattern}
                    <Card.Root>
                        <Card.Header>
                            <Card.Title>Weekly Revenue Pattern</Card.Title>
                            <Card.Description>Average revenue by day of week</Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <div class="grid grid-cols-7 gap-2">
                                {#each weeklyPattern.dayPatterns as day}
                                    <div 
                                        class="text-center p-3 rounded-lg"
                                        class:bg-green-100={day.day === weeklyPattern.bestDay}
                                        class:bg-red-50={day.day === weeklyPattern.worstDay}
                                        class:bg-blue-100={day.day === currentDay && day.day !== weeklyPattern.bestDay}
                                        class:bg-gray-50={day.day !== weeklyPattern.bestDay && day.day !== weeklyPattern.worstDay && day.day !== currentDay}
                                    >
                                        <div class="text-xs font-medium text-gray-500">
                                            {getShortDayName(day.day)}
                                        </div>
                                        <div class="text-lg font-bold mt-1">
                                            {formatCurrency(day.expectedRevenue)}
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            {day.expectedTransactions.toFixed(0)} txn
                                        </div>
                                        {#if day.day === weeklyPattern.bestDay}
                                            <Badge variant="default" class="mt-1 text-xs">Best</Badge>
                                        {/if}
                                        {#if day.day === currentDay}
                                            <Badge variant="outline" class="mt-1 text-xs">Today</Badge>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </Card.Content>
                    </Card.Root>
                {/if}
            </Tabs.Content>
            
            <!-- Segments Tab -->
            <Tabs.Content value="segments" class="space-y-6 mt-6">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Temporal Segments -->
                    <Card.Root>
                        <Card.Header>
                            <Card.Title class="flex items-center gap-2">
                                <Clock size={18} class="text-blue-500" /> By Time of Day
                            </Card.Title>
                        </Card.Header>
                        <Card.Content>
                            <div class="space-y-3">
                                {#each temporalSegments as segment}
                                    <button
                                        class="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        class:ring-2={selectedSegment?.segmentId === segment.segmentId}
                                        class:ring-blue-500={selectedSegment?.segmentId === segment.segmentId}
                                        on:click={() => selectSegment(segment)}
                                    >
                                        <div class="font-medium">{segment.segmentName}</div>
                                        <div class="text-sm text-gray-500">
                                            {segment.transactionCount} transactions
                                        </div>
                                        <div class="text-sm font-medium text-green-600 mt-1">
                                            {formatCurrency(segment.avgBasketValue)} avg
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </Card.Content>
                    </Card.Root>
                    
                    <!-- Value Segments -->
                    <Card.Root>
                        <Card.Header>
                            <Card.Title class="flex items-center gap-2">
                                <DollarSign size={18} class="text-green-500" /> By Basket Value
                            </Card.Title>
                        </Card.Header>
                        <Card.Content>
                            <div class="space-y-3">
                                {#each valueSegments as segment}
                                    <button
                                        class="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        class:ring-2={selectedSegment?.segmentId === segment.segmentId}
                                        class:ring-blue-500={selectedSegment?.segmentId === segment.segmentId}
                                        on:click={() => selectSegment(segment)}
                                    >
                                        <div class="font-medium">{segment.segmentName}</div>
                                        <div class="text-sm text-gray-500">
                                            {segment.transactionCount} transactions
                                        </div>
                                        <div class="text-sm font-medium text-green-600 mt-1">
                                            {formatCurrency(segment.avgBasketValue)} avg
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </Card.Content>
                    </Card.Root>
                    
                    <!-- Preference Segments -->
                    <Card.Root>
                        <Card.Header>
                            <Card.Title class="flex items-center gap-2">
                                <Package size={18} class="text-purple-500" /> By Product Preference
                            </Card.Title>
                        </Card.Header>
                        <Card.Content>
                            <div class="space-y-3">
                                {#each preferenceSegments as segment}
                                    <button
                                        class="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        class:ring-2={selectedSegment?.segmentId === segment.segmentId}
                                        class:ring-blue-500={selectedSegment?.segmentId === segment.segmentId}
                                        on:click={() => selectSegment(segment)}
                                    >
                                        <div class="font-medium">{segment.segmentName}</div>
                                        <div class="text-sm text-gray-500">
                                            {segment.transactionCount} transactions
                                        </div>
                                        <div class="text-sm font-medium text-green-600 mt-1">
                                            {formatCurrency(segment.avgBasketValue)} avg
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </Card.Content>
                    </Card.Root>
                </div>
                
                <!-- Selected Segment Detail -->
                {#if selectedSegment}
                    <Card.Root class="border-2 border-blue-500">
                        <Card.Header>
                            <Card.Title class="flex items-center justify-between">
                                <span>{selectedSegment.segmentName}</span>
                                <Badge>{getSegmentTypeDisplayName(selectedSegment.segmentType)}</Badge>
                            </Card.Title>
                            <Card.Description>
                                {generateSegmentSummary(selectedSegment)}
                            </Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div class="text-2xl font-bold text-blue-600">
                                        {selectedSegment.transactionCount}
                                    </div>
                                    <div class="text-sm text-gray-500">Transactions</div>
                                </div>
                                <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div class="text-2xl font-bold text-green-600">
                                        {formatCurrency(selectedSegment.avgBasketValue)}
                                    </div>
                                    <div class="text-sm text-gray-500">Avg Basket</div>
                                </div>
                                <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div class="text-2xl font-bold text-purple-600">
                                        {selectedSegment.avgItemsPerBasket.toFixed(1)}
                                    </div>
                                    <div class="text-sm text-gray-500">Avg Items</div>
                                </div>
                                <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div class="text-2xl font-bold {getConfidenceColor(selectedSegment.confidenceScore)}">
                                        {(selectedSegment.confidenceScore * 100).toFixed(0)}%
                                    </div>
                                    <div class="text-sm text-gray-500">Confidence</div>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <!-- Peak Times -->
                                <div>
                                    <h4 class="font-medium mb-2">Peak Hours</h4>
                                    <div class="flex flex-wrap gap-2">
                                        {#each selectedSegment.peakHours as hour}
                                            <Badge variant="outline">{formatHour(hour)}</Badge>
                                        {/each}
                                    </div>
                                    
                                    <h4 class="font-medium mb-2 mt-4">Peak Days</h4>
                                    <div class="flex flex-wrap gap-2">
                                        {#each selectedSegment.peakDays as day}
                                            <Badge variant="outline">{getDayName(day)}</Badge>
                                        {/each}
                                    </div>
                                </div>
                                
                                <!-- Top Categories -->
                                <div>
                                    <h4 class="font-medium mb-2">Top Categories</h4>
                                    <div class="space-y-2">
                                        {#each selectedSegment.topCategories as category}
                                            <div class="flex items-center gap-2">
                                                <Package size={16} class="text-gray-500" />
                                                <span>{getCategoryDisplayName(category)}</span>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                            
                            <!-- AI-Generated Content -->
                            {#if selectedSegment.personaDescription}
                                <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <h4 class="font-medium mb-2 flex items-center gap-2">
                                        <Brain size={16} class="text-blue-600" /> AI Persona Analysis
                                    </h4>
                                    <p class="text-gray-700 dark:text-gray-300">
                                        {selectedSegment.personaDescription}
                                    </p>
                                </div>
                            {/if}
                            
                            {#if selectedSegment.marketingRecommendations && selectedSegment.marketingRecommendations.length > 0}
                                <div class="mt-4">
                                    <h4 class="font-medium mb-2 flex items-center gap-2">
                                        <Target size={16} class="text-purple-500" /> Marketing Recommendations
                                    </h4>
                                    <ul class="space-y-2">
                                        {#each selectedSegment.marketingRecommendations as rec}
                                            <li class="flex items-start gap-2">
                                                <CheckCircle size={14} class="text-green-500 mt-0.5" />
                                                <span>{rec}</span>
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}
                            
                            {#if selectedSegment.operationalInsights && selectedSegment.operationalInsights.length > 0}
                                <div class="mt-4">
                                    <h4 class="font-medium mb-2 flex items-center gap-2">
                                        <Activity size={16} class="text-blue-500" /> Operational Insights
                                    </h4>
                                    <ul class="space-y-2">
                                        {#each selectedSegment.operationalInsights as insight}
                                            <li class="flex items-start gap-2">
                                                <ArrowRight size={14} class="text-blue-500 mt-0.5" />
                                                <span>{insight}</span>
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}
                        </Card.Content>
                    </Card.Root>
                {/if}
            </Tabs.Content>
            
            <!-- Patterns Tab -->
            <Tabs.Content value="patterns" class="space-y-6 mt-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Seasonal Patterns -->
                    {#if seasonalPatterns}
                        <Card.Root>
                            <Card.Header>
                                <Card.Title class="flex items-center gap-2">
                                    <Calendar size={18} class="text-blue-500" /> Seasonal Multipliers
                                </Card.Title>
                                <Card.Description>
                                    How special days affect sales (1.0 = normal)
                                </Card.Description>
                            </Card.Header>
                            <Card.Content>
                                <div class="space-y-4">
                                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div class="flex items-center gap-2">
                                            <Wallet size={18} class="text-green-500" />
                                            <span>Payroll Days (15th, 30th)</span>
                                        </div>
                                        <Badge 
                                            variant={seasonalPatterns.payrollDayMultiplier > 1.1 ? 'default' : 'outline'}
                                            class={seasonalPatterns.payrollDayMultiplier > 1.1 ? 'bg-green-500' : ''}
                                        >
                                            {seasonalPatterns.payrollDayMultiplier.toFixed(2)}x
                                        </Badge>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div class="flex items-center gap-2">
                                            <Calendar size={18} class="text-purple-500" />
                                            <span>Weekends</span>
                                        </div>
                                        <Badge 
                                            variant={seasonalPatterns.weekendMultiplier > 1.1 ? 'default' : 'outline'}
                                            class={seasonalPatterns.weekendMultiplier > 1.1 ? 'bg-green-500' : ''}
                                        >
                                            {seasonalPatterns.weekendMultiplier.toFixed(2)}x
                                        </Badge>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div class="flex items-center gap-2">
                                            <Calendar size={18} class="text-blue-500" />
                                            <span>Month Start (1-5)</span>
                                        </div>
                                        <Badge 
                                            variant={seasonalPatterns.monthStartMultiplier > 1.1 ? 'default' : 'outline'}
                                            class={seasonalPatterns.monthStartMultiplier > 1.1 ? 'bg-green-500' : ''}
                                        >
                                            {seasonalPatterns.monthStartMultiplier.toFixed(2)}x
                                        </Badge>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div class="flex items-center gap-2">
                                            <Calendar size={18} class="text-orange-500" />
                                            <span>Month End (25-31)</span>
                                        </div>
                                        <Badge 
                                            variant={seasonalPatterns.monthEndMultiplier > 1.1 ? 'default' : 'outline'}
                                            class={seasonalPatterns.monthEndMultiplier > 1.1 ? 'bg-green-500' : ''}
                                        >
                                            {seasonalPatterns.monthEndMultiplier.toFixed(2)}x
                                        </Badge>
                                    </div>
                                </div>
                            </Card.Content>
                        </Card.Root>
                    {/if}
                    
                    <!-- Category Distribution -->
                    <Card.Root>
                        <Card.Header>
                            <Card.Title class="flex items-center gap-2">
                                <Package size={18} class="text-purple-500" /> Category Distribution
                            </Card.Title>
                            <Card.Description>
                                Most popular product categories (last 30 days)
                            </Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <div class="space-y-3">
                                {#each Array.from(new Set(allFeatures.flatMap(f => f.categories))).slice(0, 10) as category}
                                    {@const count = allFeatures.filter(f => f.categories.includes(category)).length}
                                    {@const percentage = (count / allFeatures.length) * 100}
                                    <div class="space-y-1">
                                        <div class="flex justify-between text-sm">
                                            <span>{getCategoryDisplayName(category)}</span>
                                            <span class="text-gray-500">{percentage.toFixed(1)}%</span>
                                        </div>
                                        <div class="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div 
                                                class="h-full bg-blue-500 rounded-full"
                                                style="width: {percentage}%"
                                            ></div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </Card.Content>
                    </Card.Root>
                </div>
                
                <!-- Precipitation Impact Analysis -->
                {#if precipitationAnalysis}
                    <Card.Root>
                        <Card.Header>
                            <Card.Title class="flex items-center gap-2">
                                <CloudRain size={18} class="text-blue-500" /> Precipitation Impact
                            </Card.Title>
                            <Card.Description>
                                How rain affects your sales based on historical data
                            </Card.Description>
                        </Card.Header>
                        <Card.Content>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <!-- Rainy vs Clear comparison -->
                                <div class="space-y-4">
                                    <div class="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <CloudRain size={32} class="mx-auto mb-2 text-blue-500" />
                                        <div class="text-sm text-gray-500 dark:text-gray-400">Rainy Days</div>
                                        <div class="text-2xl font-bold text-blue-600">{formatCurrency(precipitationAnalysis.rainyDayAvgSales)}</div>
                                        <div class="text-xs text-gray-500">avg daily sales ({precipitationAnalysis.rainyDays} days)</div>
                                    </div>
                                </div>
                                
                                <div class="space-y-4">
                                    <div class="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                        <Sun size={32} class="mx-auto mb-2 text-yellow-500" />
                                        <div class="text-sm text-gray-500 dark:text-gray-400">Clear Days</div>
                                        <div class="text-2xl font-bold text-yellow-600">{formatCurrency(precipitationAnalysis.clearDayAvgSales)}</div>
                                        <div class="text-xs text-gray-500">avg daily sales ({precipitationAnalysis.clearDays} days)</div>
                                    </div>
                                </div>
                                
                                <div class="space-y-4">
                                    <div class="text-center p-4 rounded-lg {precipitationAnalysis.trafficDifference < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}">
                                        {#if precipitationAnalysis.trafficDifference < 0}
                                            <TrendingDown size={32} class="mx-auto mb-2 text-red-500" />
                                        {:else}
                                            <TrendingUp size={32} class="mx-auto mb-2 text-green-500" />
                                        {/if}
                                        <div class="text-sm text-gray-500 dark:text-gray-400">Rain Impact</div>
                                        <div class="text-2xl font-bold {precipitationAnalysis.trafficDifference < 0 ? 'text-red-600' : 'text-green-600'}">
                                            {precipitationAnalysis.trafficDifference > 0 ? '+' : ''}{precipitationAnalysis.trafficDifference.toFixed(1)}%
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            {precipitationAnalysis.trafficDifference < 0 ? 'lower sales on rainy days' : 'on rainy days'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {#if precipitationAnalysis.trafficDifference < -10}
                                <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-3">
                                    <Droplets size={20} class="text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div class="text-sm">
                                        <strong>Recommendation:</strong> Consider stocking comfort foods and reducing staffing on rainy days.
                                        Rain reduces your average sales by {Math.abs(precipitationAnalysis.trafficDifference).toFixed(0)}%.
                                    </div>
                                </div>
                            {/if}
                        </Card.Content>
                    </Card.Root>
                {:else if $isWeatherConfigured}
                    <Card.Root class="border-dashed">
                        <Card.Content class="pt-6 text-center text-muted-foreground">
                            <CloudRain size={32} class="mx-auto mb-2 opacity-50" />
                            <div>Collecting weather data for precipitation analysis...</div>
                            <div class="text-sm mt-1">Check back after a few days with varied weather conditions.</div>
                        </Card.Content>
                    </Card.Root>
                {/if}
                
                <!-- Hourly Heatmap -->
                <Card.Root>
                    <Card.Header>
                        <Card.Title class="flex items-center gap-2">
                            <Activity size={18} class="text-orange-500" /> Traffic Heatmap
                        </Card.Title>
                        <Card.Description>
                            Transaction volume by hour (darker = more traffic)
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <div class="grid grid-cols-12 gap-1">
                            {#each Array.from({length: 24}, (_, i) => i) as hour}
                                {@const hourData = hourlyPattern.find(h => h.hour === hour)}
                                {@const intensity = hourData ? hourData.expectedTransactions / Math.max(...hourlyPattern.map(h => h.expectedTransactions)) : 0}
                                <div 
                                    class="aspect-square rounded flex items-center justify-center text-xs font-medium transition-colors"
                                    class:bg-blue-100={intensity > 0 && intensity <= 0.25}
                                    class:bg-blue-300={intensity > 0.25 && intensity <= 0.5}
                                    class:bg-blue-500={intensity > 0.5 && intensity <= 0.75}
                                    class:text-white={intensity > 0.5}
                                    class:bg-blue-700={intensity > 0.75}
                                    class:bg-gray-100={intensity === 0}
                                    title="{formatHour(hour)}: {hourData?.expectedTransactions.toFixed(1) || 0} transactions"
                                >
                                    {hour}
                                </div>
                            {/each}
                        </div>
                        <div class="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
                            <div class="flex items-center gap-1">
                                <div class="w-4 h-4 bg-gray-100 rounded"></div>
                                <span>Low</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <div class="w-4 h-4 bg-blue-300 rounded"></div>
                                <span>Medium</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <div class="w-4 h-4 bg-blue-700 rounded"></div>
                                <span>High</span>
                            </div>
                        </div>
                    </Card.Content>
                </Card.Root>
            </Tabs.Content>
            
            <!-- Predictions Tab -->
            <Tabs.Content value="predictions" class="space-y-6 mt-6">
                {#if weeklyPattern}
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Best/Worst Days -->
                        <Card.Root>
                            <Card.Header>
                                <Card.Title class="flex items-center gap-2">
                                    <BarChart3 size={18} class="text-blue-500" /> Day Performance
                                </Card.Title>
                            </Card.Header>
                            <Card.Content>
                                <div class="space-y-4">
                                    <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <div class="flex items-center gap-2 text-green-700 dark:text-green-400">
                                            <TrendingUp size={18} />
                                            <span class="font-medium">Best Day</span>
                                        </div>
                                        <div class="mt-2">
                                            <div class="text-2xl font-bold">
                                                {getDayName(weeklyPattern.bestDay)}
                                            </div>
                                            <div class="text-sm text-gray-600 dark:text-gray-400">
                                                {formatCurrency(weeklyPattern.dayPatterns.find(d => d.day === weeklyPattern.bestDay)?.expectedRevenue || 0)} expected
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
                                            <TrendingDown size={18} />
                                            <span class="font-medium">Slowest Day</span>
                                        </div>
                                        <div class="mt-2">
                                            <div class="text-2xl font-bold">
                                                {getDayName(weeklyPattern.worstDay)}
                                            </div>
                                            <div class="text-sm text-gray-600 dark:text-gray-400">
                                                {formatCurrency(weeklyPattern.dayPatterns.find(d => d.day === weeklyPattern.worstDay)?.expectedRevenue || 0)} expected
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card.Content>
                        </Card.Root>
                        
                        <!-- Today's Predictions -->
                        <Card.Root>
                            <Card.Header>
                                <Card.Title class="flex items-center gap-2">
                                    <Target size={18} class="text-purple-500" /> Today's Forecast
                                </Card.Title>
                                <Card.Description>
                                    {getDayName(currentDay)} predictions
                                </Card.Description>
                            </Card.Header>
                            <Card.Content>
                                {@const todayPattern = weeklyPattern.dayPatterns.find(d => d.day === currentDay)}
                                {#if todayPattern}
                                    <div class="space-y-4">
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                <div class="text-2xl font-bold text-green-600">
                                                    {formatCurrency(todayPattern.expectedRevenue)}
                                                </div>
                                                <div class="text-sm text-gray-500">Expected Revenue</div>
                                            </div>
                                            <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                <div class="text-2xl font-bold text-blue-600">
                                                    {todayPattern.expectedTransactions.toFixed(0)}
                                                </div>
                                                <div class="text-sm text-gray-500">Expected Transactions</div>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <h4 class="font-medium mb-2">Peak Hours Today</h4>
                                            <div class="flex flex-wrap gap-2">
                                                {#each todayPattern.peakHours as hour}
                                                    <Badge 
                                                        variant={hour === currentHour ? 'default' : 'outline'}
                                                        class={hour === currentHour ? 'bg-green-500' : ''}
                                                    >
                                                        {formatHour(hour)}
                                                        {#if hour === currentHour}
                                                            (Now)
                                                        {/if}
                                                    </Badge>
                                                {/each}
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                            </Card.Content>
                        </Card.Root>
                    </div>
                    
                    <!-- Weekly Forecast Table -->
                    <Card.Root>
                        <Card.Header>
                            <Card.Title class="flex items-center gap-2">
                                <TrendingUp size={18} class="text-green-500" /> Weekly Forecast
                            </Card.Title>
                        </Card.Header>
                        <Card.Content>
                            <div class="overflow-x-auto">
                                <table class="w-full">
                                    <thead>
                                        <tr class="border-b">
                                            <th class="text-left p-3">Day</th>
                                            <th class="text-right p-3">Expected Revenue</th>
                                            <th class="text-right p-3">Expected Transactions</th>
                                            <th class="text-center p-3">Peak Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each weeklyPattern.dayPatterns as day}
                                            <tr 
                                                class="border-b hover:bg-gray-50 dark:hover:bg-gray-800 {day.day === currentDay ? 'bg-blue-50 dark:bg-blue-900/20' : ''}"
                                            >
                                                <td class="p-3 font-medium">
                                                    {getDayName(day.day)}
                                                    {#if day.day === currentDay}
                                                        <Badge variant="outline" class="ml-2">Today</Badge>
                                                    {/if}
                                                </td>
                                                <td class="p-3 text-right font-bold text-green-600">
                                                    {formatCurrency(day.expectedRevenue)}
                                                </td>
                                                <td class="p-3 text-right">
                                                    {day.expectedTransactions.toFixed(0)}
                                                </td>
                                                <td class="p-3 text-center">
                                                    {day.peakHours.map(formatHour).join(', ')}
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        </Card.Content>
                    </Card.Root>
                {/if}
            </Tabs.Content>
        </Tabs.Root>
        
        <!-- Data Summary -->
        <Card.Root class="bg-gray-50 dark:bg-gray-800/50">
            <Card.Content class="pt-6">
                <div class="flex items-center justify-between text-sm text-gray-500">
                    <div>
                        Analysis based on <strong>{allFeatures.length}</strong> transactions from the last 30 days
                    </div>
                    <div>
                        {segments.length} customer segments identified
                    </div>
                </div>
            </Card.Content>
        </Card.Root>
    {/if}
</div>

<style>
    /* Custom animations */
    @keyframes pulse-slow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }
    
    .animate-pulse-slow {
        animation: pulse-slow 2s ease-in-out infinite;
    }
</style>

