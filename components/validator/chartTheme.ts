// Shared Google Charts options aligned to the Stakewiz redesign tokens.
// Use via: <Chart options={{ ...getChartOptions(...) }} />

export const SW_CHART_COLORS = {
    accent: '#4bd6ff',
    accentSoft: '#7c5cff',
    warn: '#ffb547',
    danger: '#ff6b7a',
    text: '#e6ecff',
    textMute: '#8a97c3',
    gridline: 'rgba(148, 163, 216, 0.14)'
};

export interface ChartThemeOptions {
    /** Series line colors (defaults to cyan). */
    colors?: string[];
    /** Line thickness. */
    lineWidth?: number;
    /** Show gridlines on vertical axis. */
    gridlines?: boolean;
    /** vAxis format override (e.g. 'percent', 'short'). */
    vAxisFormat?: string;
    /** vAxis baseline value. */
    vAxisBaseline?: number | 'auto';
    /** Force a Y-axis min value (useful for stable range on flat data). */
    vAxisMin?: number;
    /** Force a Y-axis max value. */
    vAxisMax?: number;
    /** hAxis format override. */
    hAxisFormat?: string;
    /** Extra chart-area padding tweaks. */
    chartArea?: { top?: number; left?: number; right?: number; bottom?: number; width?: string; height?: string };
    /** Enable data points as filled markers. */
    pointsVisible?: boolean;
    /** Interpolate NaN values. */
    interpolateNulls?: boolean;
    /** Curve type. */
    curveType?: 'function' | 'none';
    /** Enable area shading below the line. */
    area?: boolean;
}

export const getChartOptions = (opts: ChartThemeOptions = {}) => {
    const {
        colors = [SW_CHART_COLORS.accent],
        lineWidth = 2,
        gridlines = true,
        vAxisFormat,
        vAxisBaseline,
        hAxisFormat,
        chartArea,
        pointsVisible = false,
        interpolateNulls = true,
        curveType = 'function',
        area = false
    } = opts;

    const options: any = {
        backgroundColor: 'transparent',
        colors,
        lineWidth,
        curveType,
        legend: { position: 'none' },
        pointSize: pointsVisible ? 3 : 0,
        interpolateNulls,
        vAxis: {
            gridlines: {
                color: gridlines ? SW_CHART_COLORS.gridline : 'transparent',
                count: 5
            },
            minorGridlines: { color: 'transparent' },
            textStyle: {
                color: SW_CHART_COLORS.textMute,
                fontSize: 11,
                fontName: 'system-ui, -apple-system, "Segoe UI", sans-serif'
            },
            baselineColor: SW_CHART_COLORS.gridline
        },
        hAxis: {
            gridlines: { color: 'transparent' },
            minorGridlines: { color: 'transparent' },
            textStyle: {
                color: SW_CHART_COLORS.textMute,
                fontSize: 11,
                fontName: 'system-ui, -apple-system, "Segoe UI", sans-serif'
            },
            baselineColor: SW_CHART_COLORS.gridline
        },
        chartArea: {
            top: chartArea?.top ?? 16,
            left: chartArea?.left ?? 52,
            right: chartArea?.right ?? 16,
            bottom: chartArea?.bottom ?? 32,
            width: chartArea?.width,
            height: chartArea?.height
        },
        tooltip: { textStyle: { fontName: 'system-ui, sans-serif', fontSize: 12 } },
        allowAsync: true
    };

    if (vAxisFormat) options.vAxis.format = vAxisFormat;
    if (vAxisBaseline !== undefined) options.vAxis.baseline = vAxisBaseline;
    if (opts.vAxisMin !== undefined) {
        options.vAxis.minValue = opts.vAxisMin;
        options.vAxis.viewWindow = { ...options.vAxis.viewWindow, min: opts.vAxisMin };
    }
    if (opts.vAxisMax !== undefined) {
        options.vAxis.maxValue = opts.vAxisMax;
        options.vAxis.viewWindow = { ...options.vAxis.viewWindow, max: opts.vAxisMax };
    }
    if (hAxisFormat) options.hAxis.format = hAxisFormat;
    if (area) {
        options.areaOpacity = 0.15;
    }

    return options;
};

/** Standard chart container height as CSS value. */
export const CHART_HEIGHT = '260px';
