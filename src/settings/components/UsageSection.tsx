import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from 'css/settings/Settings.module.css';

type TimeRange = "hourly" | "daily" | "weekly" | "monthly";

function getWeekNumber(d: Date): number {
    const onejan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
}

function formatLabel(time: string, range: TimeRange): string {
    const date = new Date(time);
    if (range === "hourly") return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (range === "daily") return date.toLocaleDateString([], { month: "short", day: "numeric" });
    if (range === "weekly") return `W${getWeekNumber(date)} ${date.getFullYear()}`;
    return date.toLocaleDateString([], { month: "short", year: "numeric" });
}

const formatYAxis = (tickItem: number) => {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(tickItem);
};

const chartColors = {
    tooltipBg: "#000",
    tooltipBorder: "#333",
    tooltipBody: "#fff",
    tooltipTitle: "#aaa",
    green: "#00ff80",
    grid: "#222",
    text: "#aaa",
    greenAlpha: "rgba(0,255,128,0.2)"
};

const generateMockData = (range: TimeRange) => {
    const data = [];
    let count = range === 'hourly' ? 24 : range === 'daily' ? 14 : range === 'weekly' ? 12 : 6;
    let now = new Date();
    for (let i = count; i >= 0; i--) {
        let d = new Date(now);
        if (range === 'hourly') d.setHours(d.getHours() - i);
        if (range === 'daily') d.setDate(d.getDate() - i);
        if (range === 'weekly') d.setDate(d.getDate() - i * 7);
        if (range === 'monthly') d.setMonth(d.getMonth() - i);
        data.push({
            time: d.toISOString(),
            count: Math.floor(Math.random() * 500) + 100
        });
    }
    return data;
};

function ApiChart({ range, tall }: { range: TimeRange, tall?: boolean }) {
    const height = tall ? 320 : 224;
    const data = generateMockData(range);

    const chartData = data.map((d) => ({
        label: formatLabel(d.time, range),
        count: d.count,
    }));

    const tooltipStyle = {
        backgroundColor: chartColors.tooltipBg,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        borderRadius: 8,
        padding: "8px 12px",
        color: chartColors.tooltipBody,
        fontSize: 12,
    };

    const tooltipLabelStyle = {
        color: chartColors.tooltipTitle,
        fontWeight: 600 as const,
        marginBottom: 2,
    };

    if (range === "hourly") {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 20 }}>
                    <defs>
                        <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={chartColors.green} stopOpacity={0.15} />
                            <stop offset="100%" stopColor={chartColors.green} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: chartColors.text, fontSize: 11 }} axisLine={false} tickLine={true} interval="preserveEnd" angle={-45} textAnchor="end" />
                    <YAxis tick={{ fill: chartColors.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={formatYAxis} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ stroke: chartColors.grid, strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="count" name="Requests" stroke={chartColors.green} strokeWidth={2} fill="url(#greenGradient)" dot={{ r: 3, fill: chartColors.green, strokeWidth: 0 }} activeDot={{ r: 5, fill: chartColors.green, strokeWidth: 0 }} />
                </AreaChart>
            </ResponsiveContainer>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 20 }}>
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: chartColors.text, fontSize: 11 }} axisLine={false} tickLine={true} interval="preserveEnd" angle={-45} textAnchor="end" />
                <YAxis tick={{ fill: chartColors.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={formatYAxis} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: chartColors.grid, opacity: 0.5 }} />
                <Bar dataKey="count" name="Requests" fill={chartColors.greenAlpha} stroke={chartColors.green} strokeWidth={2} radius={[6, 6, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

interface UsageSectionProps {
    serverData: {
        automations_run: number;
        tokens_used: string;
        time_saved: string;
    };
}

const UsageSection: React.FC<UsageSectionProps> = ({ serverData }) => {
    const [timeRange, setTimeRange] = useState<TimeRange>('hourly');

    return (
        <div className={styles.sectionContainer}>
            <div className={styles.card}>
                <div className={styles.cardTitle}><Activity size={18} /> Usage Overview</div>
                <div className={styles.statGrid}>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Automations Run</span>
                        <span className={styles.statValue}>{serverData.automations_run.toLocaleString()}</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Tokens Used</span>
                        <span className={styles.statValue}>{serverData.tokens_used}</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Time Saved</span>
                        <span className={styles.statValue}>{serverData.time_saved}</span>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardTitle}>API Requests</div>
                <div className={styles.timeTabs}>
                    {(["hourly", "daily", "weekly", "monthly"] as TimeRange[]).map((t) => (
                        <button
                            key={t}
                            className={`${styles.timeTab} ${timeRange === t ? styles.active : ''}`}
                            onClick={() => setTimeRange(t)}
                        >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>
                <ApiChart range={timeRange} />
            </div>
        </div>
    );
};

export default UsageSection;
