import {css, html, LitElement} from "https://cdn.jsdelivr.net/gh/lit/dist@2/all/lit-all.min.js";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";

const sleepAttributes = [
    {"name": "average_breath", "label": "Average breath", "unit": "breaths/min"},
    {"name": "average_heart_rate", "label": "Average heart rate", "unit": "bpm"},
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
]

const aggregationTypes = [
    {"name": "mean", "label": "Mean/average"},
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
]

class DetailSelector extends LitElement {
    static properties = {
        focusType: {type: String},
        aggType: {type: String},
        kWindow: {type: Number}
    }

    constructor() {
        super();
        this.focusType = 'average_hrv';
        this.aggType = 'median';
        this.kWindow = 7;
    }

    // Emit event when values change
    updated(changedProperties) {
        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                focus: this.focusType,
                agg: this.aggType,
                k: this.kWindow,
            }
        }));
    }

    static styles = css`
      :host {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
      }

      :host > * {
        margin-right: 0.5em;
        margin-bottom: 0.5em;
      }
    `;

    render() {
        return html`
            <sl-select label="Select attribute to focus" value=${this.focusType}
                       @sl-input=${e => this.focusType = e.target.value}>
                ${sleepAttributes.map(attr => html`
                    <sl-option value="${attr.name}">${attr.label}</sl-option>
                `)}
            </sl-select>
            <sl-select label="Select aggregation type" value=${this.aggType}
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
            <sl-range label="Rolling window (${this.kWindow} days)" min="1" max="30"
                      value=${this.kWindow} @sl-input=${(e) => {
                this.kWindow = e.target.value
            }}>
                >
            </sl-range>
        `;

    }
}

class OuraSleepGraph extends LitElement {
    static properties = {
        sleepData: {},
        graphParams: {},
    }

    constructor() {
        super();
        this.graphParams = {
            focus: 'average_hrv',
            agg: 'median',
            k: 7,
        };
    }

    renderGraph() {
        console.log(this.sleepData);

        const agg = this.graphParams.agg;
        const focus = this.graphParams.focus;
        const k = this.graphParams.k;
        const cutoff = 16; // TODO: dedup

        const focusAttr = sleepAttributes.find(attr => attr.name === focus);

        const stroke = Math.round(10 - this.sleepData.length / 30);

        return html`
            <div class="graph">
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
                            // TOOD: round to two decimals
                            title: d => `${d.date.toLocaleDateString()} ${d.bedtime_start_date.toLocaleTimeString()} - ${d.bedtime_end_date.toLocaleTimeString()}\n${focusAttr.label}: ${d[focus]} ${focusAttr.unit}`,
                        }),
                        Plot.line(
                                this.sleepData,
                                Plot.windowY({
                                    k,
                                    anchor: "end",
                                    x: "date",
                                    y: "bedtime_start_hour",
                                    stroke: "blue",
                                    strokeWidth: 2,
                                    curve: "step",
                                    reduce: agg
                                })
                        ),
                        Plot.line(
                                this.sleepData,
                                Plot.windowY({
                                    k,
                                    anchor: "end",
                                    x: "date",
                                    y: "bedtime_end_hour",
                                    stroke: "red",
                                    strokeWidth: 2,
                                    curve: "step",
                                    reduce: agg
                                })
                        ),
                    ]
                })}
            </div>
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
                        Plot.dot(this.sleepData, {
                            x: "date",
                            y: focus,
                            title: "date"
                        }),
                        Plot.line(
                                this.sleepData,
                                Plot.windowY({
                                    k,
                                    anchor: "end",
                                    x: "date",
                                    y: focus,
                                    stroke: "red",
                                    strokeWidth: 2,
                                    curve: "step",
                                    reduce: agg
                                })
                        )
                    ]
                })}
            </div>
        `;
    }

    render() {
        return html`
            <div class="graph">
                <detail-selector
                        .aggType=${this.graphParams.agg}
                        .focusType=${this.graphParams.focus}
                        .kWindow=${this.graphParams.k}
                        @change=${e => this.graphParams = e.detail}
                ></detail-selector>
                <br/>
                ${this.sleepData ? this.renderGraph() : html`No data to render.`}
            </div>
        `;
    }
}

customElements.define("oura-sleep-graph", OuraSleepGraph);
customElements.define("detail-selector", DetailSelector);
