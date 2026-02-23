import {css, html, LitElement, repeat} from "https://cdn.jsdelivr.net/gh/lit/dist@2/all/lit-all.min.js";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.9/+esm";

const sleepAttributes = [
    {"name": "average_breath", "label": "Average breath", "unit": "breaths/min"},
    {"name": "average_heart_rate", "label": "Average heart rate (sleep)", "unit": "bpm"},
    {"name": "hr_daily_average", "label": "Average heart rate (all-day)", "unit": "bpm"},
    {"name": "average_hrv", "label": "Average HRV", "unit": "ms"},
    {"name": "awake_time", "label": "Awake time", "unit": "s"},
    {"name": "bedtime_end_hour", "label": "Bedtime end", "unit": "h", shifted: true},
    {"name": "bedtime_start_hour", "label": "Bedtime start", "unit": "h", shifted: true},
    {"name": "deep_sleep_duration", "label": "Deep sleep", "unit": "s"},
    {"name": "efficiency", "label": "Efficiency", "unit": "%"},
    {"name": "latency", "label": "Latency", "unit": "s"},
    {"name": "light_sleep_duration", "label": "Light sleep", "unit": "s"},
    {"name": "lowest_heart_rate", "label": "Lowest heart rate", "unit": "bpm"},
    {"name": "readiness_score", "label": "Readiness score", "unit": "%"},
    {"name": "temperature_deviation", "label": "Temperature deviation", "unit": "°C"},
    {"name": "temperature_trend_deviation", "label": "Temperature trend deviation", "unit": "°C"},
    {"name": "rem_sleep_duration", "label": "REM sleep", "unit": "s"},
    {"name": "restless_periods", "label": "Restlessness periods", "unit": "periods"},
    {"name": "time_in_bed", "label": "Time in bed", "unit": "s"},
    {"name": "total_sleep_duration", "label": "Total sleep", "unit": "s"},
    {"type": "separator", "section": "Activity"},
    {"name": "steps", "label": "Steps", "unit": "steps"},
    {"name": "active_calories", "label": "Active calories", "unit": "kcal"},
    {"name": "total_calories", "label": "Total calories", "unit": "kcal"},
    {"name": "activity_score", "label": "Activity score", "unit": "%"},
    {"name": "equivalent_walking_distance", "label": "Walking distance", "unit": "m"},
    {"name": "high_activity_time", "label": "High activity", "unit": "s"},
    {"name": "medium_activity_time", "label": "Medium activity", "unit": "s"},
    {"name": "low_activity_time", "label": "Low activity", "unit": "s"},
    {"name": "sedentary_time", "label": "Sedentary time", "unit": "s"},
    {"name": "resting_time", "label": "Resting time", "unit": "s"},
    {"type": "separator", "section": "Health"},
    {"name": "spo2_average", "label": "SpO2 average", "unit": "%"},
    {"name": "breathing_disturbance_index", "label": "Breathing disturbance", "unit": ""},
    {"name": "stress_high", "label": "Stress (high)", "unit": "s"},
    {"name": "recovery_high", "label": "Recovery (high)", "unit": "s"},
    {"name": "vo2_max", "label": "VO2 Max", "unit": "mL/kg/min"},
    {"type": "separator", "section": "Workouts"},
    {"name": "workout_count", "label": "Workout count", "unit": ""},
    {"name": "workout_duration", "label": "Workout duration", "unit": "s"},
]

const aggregationTypes = [
    {"name": "mean", "label": "Mean/average"},
    {"name": "sum", "label": "Sum"},
    {"name": "median", "label": "Median"},
    {"name": "min", "label": "Minimum"},
    {"name": "max", "label": "Maximum"},
    {"name": "deviation", "label": "Deviation"},
    {"name": "variance", "label": "Variance"},
    {"type": "separator", "section": "Quantiles"},
    {"name": "p99", "label": "99th percentile"},
    {"name": "p95", "label": "95th percentile"},
    {"name": "p50", "label": "50th percentile"},
    {"name": "p10", "label": "10th percentile"},
    {"name": "p05", "label": "5th percentile"},
    {"name": "p01", "label": "1st percentile"},
    {"type": "separator", "section": "Smoothing"},
    {"name": "loess", "label": "LOESS"},
]

/**
 * LOESS (Locally Estimated Scatterplot Smoothing).
 * Fits a local weighted linear regression at each data point using a tricube kernel.
 * @param {Array} data - Array of objects, sorted by xKey
 * @param {string} xKey - Key for x values (Date or numeric)
 * @param {string} yKey - Key for y values (numeric)
 * @param {number} span - Fraction of data to include in each local fit (0 to 1)
 * @returns {Array} New array with smoothed y values
 */
function loessSmooth(data, xKey, yKey, span) {
    const valid = data.filter(d => d[yKey] != null);
    if (valid.length < 3) return valid;

    const xs = valid.map(d => +d[xKey]);
    const ys = valid.map(d => +d[yKey]);
    const n = valid.length;
    const k = Math.max(Math.round(span * n), 3);

    const smoothed = [];
    for (let i = 0; i < n; i++) {
        const xi = xs[i];

        // Find k nearest neighbors by distance
        const neighbors = xs.map((x, j) => ({j, dist: Math.abs(x - xi)}));
        neighbors.sort((a, b) => a.dist - b.dist);
        neighbors.length = k;
        const maxDist = neighbors[k - 1].dist || 1;

        // Weighted linear regression with tricube kernel
        let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
        for (const {j, dist} of neighbors) {
            const u = dist / (maxDist * 1.0001);
            const w = (1 - u * u * u) ** 3;
            const dx = xs[j] - xi;
            sw += w;
            swx += w * dx;
            swy += w * ys[j];
            swxx += w * dx * dx;
            swxy += w * dx * ys[j];
        }

        const det = sw * swxx - swx * swx;
        const yHat = Math.abs(det) < 1e-10
            ? swy / sw
            : (swxx * swy - swx * swxy) / det;

        smoothed.push({...valid[i], [yKey]: yHat});
    }

    return smoothed;
}

/** Build an aggregated line mark, using LOESS or Plot.windowY depending on aggregation type. */
function aggLine(data, agg, k, xKey, yKey, lineOptions, {loessSpan = 30} = {}) {
    if (agg === "loess") {
        return Plot.line(loessSmooth(data, xKey, yKey, loessSpan / 100), {x: xKey, y: yKey, ...lineOptions, curve: "natural"});
    }
    return Plot.line(data, Plot.windowY({k, anchor: "end", reduce: agg}, {x: xKey, y: yKey, ...lineOptions}));
}

class DetailSelector extends LitElement {
    static properties = {
        focusType: {type: String},
        aggType: {type: String},
        kWindow: {type: Number},
        loessSpan: {type: Number},
        curve: {type: String},
        plotType: {type: String},
        interval: {type: String},
        yZero: {type: Boolean},
        hasHrData: {type: Boolean},
    }

    constructor() {
        super();
        this.focusType = 'average_hrv';
        this.aggType = 'mean';
        this.kWindow = 7;
        this.loessSpan = 30;
        this.curve = "step";
        this.plotType = "line";
        this.interval = "month";
        this.yZero = true;
        this.hasHrData = false;
    }

    // Emit event when values change
    updated(changedProperties) {
        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                focus: this.focusType,
                agg: this.aggType,
                k: this.kWindow,
                loessSpan: this.loessSpan,
                curve: this.curve,
                plotType: this.plotType,
                interval: this.interval,
                yZero: this.yZero,
            }
        }));
    }

    static styles = css`
      :host {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0.5em;
        align-items: flex-end;
      }

      sl-range {
        width: 10em;
      }
    `;

    render() {
        return html`
            <sl-select size="small" label="Attribute" value=${this.focusType}
                       @sl-input=${e => this.focusType = e.target.value}>
                ${sleepAttributes
                        .filter(attr => attr.name !== 'hr_daily_average' || this.hasHrData)
                        .map(attr => attr.type === "separator" ?
                        html`
                            <sl-divider></sl-divider><small>${attr.section}</small>` :
                        html`
                            <sl-option value="${attr.name}">${attr.label}</sl-option>
                        `)}
            </sl-select>
            <sl-button-group label="Plot type">
                <sl-button size="small" .variant=${this.plotType === 'line' ? 'primary' : 'default'}
                           @click=${() => this.plotType = 'line'}>Line</sl-button>
                <sl-button size="small" .variant=${this.plotType === 'bar' ? 'primary' : 'default'}
                           @click=${() => this.plotType = 'bar'}>Bar</sl-button>
            </sl-button-group>
            <sl-select size="small" label="Aggregation" value=${this.aggType}
                       @sl-input=${(e) => {
                           this.aggType = e.target.value
                       }}>
                ${aggregationTypes.map(attr => attr.type === "separator" ?
                        html`
                            <sl-divider></sl-divider><small>${attr.section}</small>` :
                        html`
                            <sl-option value="${attr.name}">${attr.label}</sl-option>
                        `)}
            </sl-select>
            ${this.plotType === 'line' ? (this.aggType === 'loess' ? html`
                <sl-range label="Span (${this.loessSpan}%)" min="1" max="100"
                          value=${this.loessSpan} @sl-input=${e => this.loessSpan = e.target.value}>
                </sl-range>
            ` : html`
                <sl-range label="Window (${this.kWindow}d)" min="1" max="60"
                          value=${this.kWindow} @sl-input=${e => this.kWindow = e.target.value}>
                </sl-range>
                <sl-checkbox size="small"
                        @sl-change=${e => this.curve = e.target.checked ? "natural" : "step"}
                        .checked=${this.curve === "natural"}>
                    Smooth
                </sl-checkbox>
            `) : html`
                <sl-select size="small" label="Interval" value=${this.interval}
                           @sl-input=${e => this.interval = e.target.value}>
                    <sl-option value="day">Day</sl-option>
                    <sl-option value="week">Week</sl-option>
                    <sl-option value="month">Month</sl-option>
                    <sl-option value="year">Year</sl-option>
                </sl-select>
                <sl-checkbox size="small"
                        @sl-change=${e => this.yZero = e.target.checked}
                        .checked=${this.yZero}>
                    y = 0
                </sl-checkbox>
            `}
        `;

    }
}

class OuraSleepGraph extends LitElement {
    static properties = {
        sleepData: {},
        heartrateData: {},
        showPoints: {type: Boolean},
        selected: {},
        hasHrData: {type: Boolean},

        _mainAgg: {state: true},
        _mainK: {state: true},
        _mainLoessSpan: {state: true},
        _mainCurve: {state: true},
        _detailGraphs: {state: true},
    }

    constructor() {
        super();
        this._mainAgg = 'mean';
        this._mainK = 7;
        this._mainLoessSpan = 30;
        this._mainCurve = 'step';
        this._detailGraphs = [
            {id: 0, focus: 'average_hrv', agg: 'mean', k: 7, loessSpan: 30, curve: 'step', plotType: 'line', interval: 'month', yZero: true},
        ];
        this._nextId = 1;
        this.showPoints = true;
    }

    static styles = css`
      .main-controls {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.5em;
        margin-bottom: 0.5em;
      }

      .main-controls sl-range {
        width: 12em;
      }

      .detail-section {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 0.75em;
        margin-bottom: 0.75em;
      }

      .detail-header {
        display: flex;
        align-items: flex-end;
        gap: 0.5em;
      }

      .detail-header detail-selector {
        flex: 1;
        min-width: 0;
      }
    `;

    _addDetailGraph() {
        this._detailGraphs = [...this._detailGraphs, {
            id: this._nextId++,
            focus: 'average_hrv',
            agg: 'mean',
            k: 7,
            loessSpan: 30,
            curve: 'step',
            plotType: 'line',
            interval: 'month',
            yZero: true,
        }];
    }

    _removeDetailGraph(id) {
        this._detailGraphs = this._detailGraphs.filter(g => g.id !== id);
    }

    _updateDetailGraph(id, params) {
        this._detailGraphs = this._detailGraphs.map(g =>
            g.id === id ? {...g, focus: params.focus, agg: params.agg, k: params.k, loessSpan: params.loessSpan, curve: params.curve, plotType: params.plotType, interval: params.interval, yZero: params.yZero} : g
        );
    }

    renderMainGraph() {
        const agg = this._mainAgg;
        const k = this._mainK;
        const cutoff = 16; // TODO: dedup
        const curve = this._mainCurve;
        const anchor = "end";

        // Color bars by first detail graph's focus attribute
        const focus = this._detailGraphs.length > 0 ? this._detailGraphs[0].focus : 'average_hrv';
        const focusAttr = sleepAttributes.find(attr => attr.name === focus);

        const stroke = Math.round(10 - this.sleepData.length / 30);

        // Detect sleep algorithm version transitions
        const algoChanges = [];
        for (let i = 1; i < this.sleepData.length; i++) {
            const prev = this.sleepData[i - 1].sleep_algorithm_version;
            const curr = this.sleepData[i].sleep_algorithm_version;
            if (prev && curr && prev !== curr) {
                algoChanges.push({date: this.sleepData[i].date, version: curr});
            }
        }

        return html`
            <div class="graph" @input=${e => console.log(this.selected = e.target.value?.date)}>
                ${Plot.plot({
                    style: {
                        background: "transparent",
                    },
                    width: 800,
                    x: {
                        label: "Date",
                        tickFormat: d => d.toLocaleDateString(),
                        grid: true,
                    },
                    color: {
                        scheme: "blues",
                    },
                    y: {
                        label: "Hour",
                        grid: true,
                        domain: [cutoff - 24, cutoff],
                        tickFormat: (h) => (h < 0 ? h + 24 : h)
                    },
                    marks: [
                        Plot.ruleX(this.sleepData, {
                            x: "date",
                            y1: "bedtime_start_hour",
                            y2: "bedtime_end_hour",
                            stroke: focus,
                            strokeWidth: stroke,
                            title: d => `${d.date.toLocaleDateString()}\n${d.bedtime_start_date.toLocaleTimeString()} - ${d.bedtime_end_date.toLocaleTimeString()}\n${focusAttr.label}: ${d[focus]} ${focusAttr.unit}`,
                            tip: true,
                        }),
                        Plot.crosshair(this.sleepData, {
                            x: "date",
                        }),
                        aggLine(this.sleepData, agg, k, "date", "bedtime_start_hour", {
                            stroke: "blue", strokeWidth: 1, curve,
                        }, {loessSpan: this._mainLoessSpan}),
                        aggLine(this.sleepData, agg, k, "date", "bedtime_end_hour", {
                            stroke: "red", strokeWidth: 1, curve,
                        }, {loessSpan: this._mainLoessSpan}),
                        ...algoChanges.map(c => Plot.ruleX([c.date], {
                            stroke: "orange",
                            strokeWidth: 2,
                            strokeDasharray: "4,4",
                        })),
                        ...algoChanges.map(c => Plot.text([c], {
                            x: "date",
                            y: cutoff - 1,
                            text: d => `algo ${d.version}`,
                            fill: "orange",
                            fontSize: 10,
                            dx: 4,
                            textAnchor: "start",
                        })),
                    ]
                })}
            </div>
        `;
    }

    renderDetailGraph(graph) {
        const focusAttr = sleepAttributes.find(attr => attr.name === graph.focus);

        if (graph.plotType === 'bar') {
            const values = this.sleepData.map(d => d[graph.focus]).filter(v => v != null);
            const yMin = Math.min(...values);
            const yMax = Math.max(...values);
            return html`
                <div class="graph">
                    ${Plot.plot({
                        style: {
                            background: "transparent",
                        },
                        width: 800,
                        x: {
                            label: "Date",
                            grid: true,
                            interval: graph.interval,
                        },
                        y: {
                            label: `${focusAttr.label} (${focusAttr.unit})`,
                            grid: true,
                            ...(graph.yZero ? {} : {domain: [yMin, yMax]}),
                        },
                        marks: [
                            graph.yZero
                                ? Plot.barY(this.sleepData, Plot.groupX(
                                    {y: graph.agg === "loess" ? "mean" : graph.agg},
                                    {x: "date", y: graph.focus, fill: "steelblue", tip: true}
                                ))
                                : Plot.barY(this.sleepData, Plot.groupX(
                                    {y2: graph.agg === "loess" ? "mean" : graph.agg, y1: () => yMin},
                                    {x: "date", y: graph.focus, fill: "steelblue", tip: true}
                                )),
                            graph.yZero ? Plot.ruleY([0]) : null,
                        ]
                    })}
                </div>
            `;
        }

        const anchor = "end";
        return html`
            <div class="graph">
                ${Plot.plot({
                    style: {
                        background: "transparent",
                    },
                    width: 800,
                    x: {
                        label: "Date",
                        grid: true,
                    },
                    color: {
                        scheme: "blues",
                    },
                    y: {
                        label: `${focusAttr.label} (${focusAttr.unit})`,
                        grid: true,
                    },
                    marks: [
                        this.showPoints ? Plot.dot(this.sleepData, {
                            x: "date",
                            y: graph.focus,
                            r: 1.5,
                            fill: "gray",
                            title: d => `${d.date.toLocaleDateString()}\n${focusAttr.label}: ${d[graph.focus]}`,
                            tip: true,
                        }) : null,
                        aggLine(this.sleepData, graph.agg, graph.k, "date", graph.focus, {
                            stroke: "red", strokeWidth: 1, curve: graph.curve,
                        }, {loessSpan: graph.loessSpan}),
                        Plot.linearRegressionY(this.sleepData, {
                            x: "date",
                            y: graph.focus,
                            opacity: 0.3,
                        }),
                    ]
                })}
            </div>
        `;
    }

    async heartrateGraph() {
        const data = await this.heartrateData;

        return html`
            <div class="graph">
                ${Plot.plot({
                    style: {
                        background: "transparent",
                    },
                    width: 800,
                    x: {
                        label: "Date",
                        grid: true,
                    },
                    color: {
                        scheme: "blues",
                    },
                    y: {
                        grid: true,
                    },
                    marks: [
                        Plot.dot(data, {
                            x: "date",
                            y: "bpm",
                            title: "date",
                            r: 0.1,
                        }),
                        aggLine(data, this._mainAgg, 30, "date", "bpm", {
                            curve: "catmull-rom",
                        }, {loessSpan: this._mainLoessSpan}),
                    ]
                })}
            </div>
        `;
    }

    render() {
        return html`
            <div class="main-controls">
                <sl-select label="Aggregation" value=${this._mainAgg}
                           @sl-input=${e => this._mainAgg = e.target.value}>
                    ${aggregationTypes.map(attr => attr.type === "separator" ?
                            html`
                                <sl-divider></sl-divider><small>${attr.section}</small>` :
                            html`
                                <sl-option value="${attr.name}">${attr.label}</sl-option>
                            `)}
                </sl-select>
                ${this._mainAgg === 'loess' ? html`
                    <sl-range label="Span (${this._mainLoessSpan}%)" min="1" max="100"
                              value=${this._mainLoessSpan} @sl-input=${e => this._mainLoessSpan = e.target.value}>
                    </sl-range>
                ` : html`
                    <sl-range label="Rolling window (${this._mainK} days)" min="1" max="60"
                              value=${this._mainK} @sl-input=${e => this._mainK = e.target.value}>
                    </sl-range>
                    <sl-checkbox
                            @sl-change=${e => this._mainCurve = e.target.checked ? "natural" : "step"}
                            .checked=${this._mainCurve === "natural"}>
                        Smooth curves
                    </sl-checkbox>
                `}
            </div>
            ${this.sleepData ? this.renderMainGraph() : html`No data to render.`}
            <sl-divider></sl-divider>
            <sl-checkbox
                    @sl-change=${(e) => {
                        this.showPoints = e.target.checked
                    }}
                    .checked=${this.showPoints}
                    style="margin-bottom: 0.75em;">
                Show individual points
            </sl-checkbox>
            ${repeat(this._detailGraphs, g => g.id, graph => html`
                <div class="detail-section">
                    <div class="detail-header">
                        <detail-selector
                                .focusType=${graph.focus}
                                .aggType=${graph.agg}
                                .kWindow=${graph.k}
                                .loessSpan=${graph.loessSpan}
                                .curve=${graph.curve}
                                .plotType=${graph.plotType}
                                .interval=${graph.interval}
                                .yZero=${graph.yZero}
                                .hasHrData=${this.hasHrData}
                                @change=${e => this._updateDetailGraph(graph.id, e.detail)}
                        ></detail-selector>
                        <sl-button variant="text" size="small"
                                   @click=${() => this._removeDetailGraph(graph.id)}>
                            <sl-icon name="x-lg"></sl-icon>
                        </sl-button>
                    </div>
                    ${this.sleepData ? this.renderDetailGraph(graph) : ''}
                </div>
            `)}
            <sl-button size="small" @click=${() => this._addDetailGraph()}>
                <sl-icon slot="prefix" name="plus-lg"></sl-icon>
                Add graph
            </sl-button>
        `;
    }
}

customElements.define("oura-sleep-graph", OuraSleepGraph);
customElements.define("detail-selector", DetailSelector);
