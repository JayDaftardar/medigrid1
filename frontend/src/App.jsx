import React, { useState, useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import {
  LayoutDashboard, Building2, Search as SearchIcon, Bell, BarChart3, Settings,
  AlertTriangle, BedDouble, Activity, Users, LogOut, Clock,
  Filter, Plus, MoreVertical, Edit2, CheckCircle2, Info, X, MapPin,
  Phone, ExternalLink, ChevronRight, ArrowUpRight, ArrowDownRight,
  TrendingUp, AlertCircle, Shield, User, Menu, RefreshCcw, Lock, Mail, Eye, EyeOff
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { api, setToken, clearToken } from './lib/api';

// --- COMPONENTS ---

const Badge = ({ children, color = 'blue' }) => {
  const colors = {
    cyan:   'bg-blue-50 text-blue-700 border-blue-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    red:    'bg-red-50 text-red-600 border-red-200',
    gray:   'bg-slate-100 text-slate-600 border-slate-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
};

const StatCard = ({ title, value, label, icon: Icon, color, trend }) => {
  const palettes = {
    cyan:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    blob: 'bg-blue-400' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    blob: 'bg-blue-400' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', blob: 'bg-emerald-400' },
    red:     { bg: 'bg-red-50',     icon: 'text-red-600',     blob: 'bg-red-400' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   blob: 'bg-amber-400' },
  };
  const p = palettes[color] || palettes.cyan;
  return (
    <div className="glass-card p-5 rounded-xl flex flex-col gap-3 relative overflow-hidden group">
      <div className={`stat-blob ${p.blob}`} />
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-lg ${p.bg} ${p.icon}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend > 0 ? <ArrowUpRight size={14} className="mr-0.5" /> : <ArrowDownRight size={14} className="mr-0.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold font-mono tracking-tight text-slate-900">{value}</div>
        <div className="text-sm text-slate-500 font-medium mt-0.5">{title}</div>
        {label && <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{label}</div>}
      </div>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200 border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
};

const Toast = ({ message, type = 'success', onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow-xl animate-in slide-in-from-right duration-300 border-l-4 border border-slate-200 ${type === 'error' ? 'border-l-red-500' : type === 'info' ? 'border-l-blue-500' : 'border-l-emerald-500'}`}>
    {type === 'success' && <CheckCircle2 className="text-emerald-500" size={18} />}
    {type === 'error' && <AlertCircle className="text-red-500" size={18} />}
    {type === 'info' && <Info className="text-blue-500" size={18} />}
    <span className="text-sm text-slate-700 font-medium">{message}</span>
    <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-700"><X size={14} /></button>
  </div>
);

// --- ESCALATION BADGE ---
const ESCALATION_CONFIG = {
  0: { name: "Normal",    color: "#10B981", bg: "rgba(16,185,129,0.15)",  border: "rgba(16,185,129,0.4)"  },
  1: { name: "Pressured", color: "#F59E0B", bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.4)"  },
  2: { name: "Diverted",  color: "#F97316", bg: "rgba(249,115,22,0.15)",  border: "rgba(249,115,22,0.4)"  },
  3: { name: "Critical",  color: "#EF4444", bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.4)"   },
};

const EscalationBadge = ({ level, size = "sm" }) => {
  const cfg = ESCALATION_CONFIG[level] ?? ESCALATION_CONFIG[0];
  const isLarge = size === "lg";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: isLarge ? "4px 12px" : "2px 8px",
      borderRadius: "999px",
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      fontSize: isLarge ? "13px" : "11px",
      fontWeight: 600,
      color: cfg.color,
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: isLarge ? 8 : 6, height: isLarge ? 8 : 6,
        borderRadius: "50%", background: cfg.color,
        boxShadow: level >= 2 ? `0 0 6px ${cfg.color}` : "none",
        animation: level >= 2 ? "escalation-pulse 2s infinite" : "none"
      }} />
      L{level} {cfg.name}
    </span>
  );
};

const LoadingSkeleton = ({ count = 3 }) => (
  <div className="animate-pulse space-y-4 w-full">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="h-24 bg-slate-100 rounded-xl border border-slate-200" />
    ))}
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
    <AlertTriangle size={40} className="text-red-400 mb-3" />
    <p className="text-lg text-slate-600">{message || 'Failed to load data'}</p>
    <button
      onClick={onRetry}
      className="mt-4 px-5 py-2 bg-blue-600 rounded-lg text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
    >
      Retry
    </button>
  </div>
);

// --- PAGE COMPONENTS ---

const Dashboard = ({ 
  effectiveRole, dashStats, alerts, trends, alertStats, 
  loading, loadError, loadInitialData, handleResolveAlert, setActivePage,
  escalationSummary
}) => {
  if (loadError) return <ErrorState message={loadError} onRetry={loadInitialData} />;
  if (loading && !dashStats) return <LoadingSkeleton count={4} />;
  
  // System Admin / Authority View
  if (['system_admin', 'authority'].includes(effectiveRole)) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Hospitals" value={dashStats?.total_hospitals || 0} icon={Building2} color="cyan" />
          <StatCard 
            title="General Bed Availability" 
            value={`${dashStats?.city_totals?.general_bed?.available || 0} / ${dashStats?.city_totals?.general_bed?.total || 0}`} 
            icon={BedDouble} color="emerald" 
            label={`${Math.round((dashStats?.city_totals?.general_bed?.available / (dashStats?.city_totals?.general_bed?.total || 1)) * 100)}% Available`}
          />
          <StatCard title="Active Alerts" value={alerts.length} icon={AlertTriangle} color="red" label="Require Action" />
          <StatCard 
            title="ICU Occupancy" 
            value={`${100 - Math.round((dashStats?.city_totals?.icu_bed?.available / (dashStats?.city_totals?.icu_bed?.total || 1)) * 100)}%`} 
            icon={Activity} color="amber" 
          />
        </div>

        {escalationSummary && (
          <div style={{
            background: "rgba(16,34,68,0.7)", border: "1px solid rgba(30,48,94,0.6)",
            borderRadius: "12px", padding: "16px 24px", marginBottom: "4px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ color: "#94A3B8", fontSize: "13px", fontWeight: 600, marginRight: "8px" }}>
                CITY ESCALATION STATUS
              </span>
              {[
                { key: "normal",    level: 0 },
                { key: "pressured", level: 1 },
                { key: "diverted",  level: 2 },
                { key: "critical",  level: 3 },
              ].map(({ key, level }) => {
                const cfg = ESCALATION_CONFIG[level];
                const count = escalationSummary[key] ?? 0;
                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "6px 14px", borderRadius: "8px",
                    background: cfg.bg, border: `1px solid ${cfg.border}`
                  }}>
                    <span style={{ fontSize: "22px", fontWeight: 700, color: cfg.color }}>{count}</span>
                    <span style={{ fontSize: "12px", color: cfg.color, fontWeight: 500 }}>{cfg.name}</span>
                  </div>
                );
              })}
              {((escalationSummary.diverted ?? 0) > 0 || (escalationSummary.critical ?? 0) > 0) && (
                <div style={{
                  marginLeft: "auto", padding: "6px 14px", borderRadius: "8px",
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#EF4444", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px"
                }}>
                  ⚠ {(escalationSummary.diverted ?? 0) + (escalationSummary.critical ?? 0)} hospitals need attention
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <TrendingUp size={18} className="text-cyan-400" />
              Resource Trends (7 Days)
            </h3>
            <div className="h-[300px] w-full">
              {trends ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends.labels.map((l, i) => ({
                    name: l,
                    general: trends.datasets.general_bed[i],
                    icu: trends.datasets.icu_bed[i],
                    vent: trends.datasets.ventilator[i]
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    <Bar dataKey="general" name="General Beds" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="icu" name="ICU Beds" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vent" name="Ventilators" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading trend data...</div>}
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl flex flex-col h-full border border-slate-800">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Bell size={18} className="text-red-400" />
              Active Alerts
            </h3>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-hide">
              {alerts.length > 0 ? alerts.map(alert => (
                <div key={alert.alert_id} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-white">{alert.hospital_name}</h4>
                      <p className="text-xs text-red-400 font-medium mt-1 capitalize">{alert.resource_type.replace('_', ' ')} Low</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-red-500 pulse-dot danger" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Clock size={10} /> {new Date(alert.triggered_at).toLocaleTimeString()}
                    <AlertCircle size={10} className="ml-auto" /> {alert.severity}
                  </div>
                  <button
                    onClick={() => handleResolveAlert(alert.alert_id)}
                    className="w-full py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-500/20"
                  >
                    Mark Resolved
                  </button>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                  <CheckCircle2 size={32} />
                  <p className="text-sm font-medium">No active alerts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Hospital Admin View
  if (effectiveRole === 'hospital_admin') {
    const h = dashStats; // For hospital admin, dashStats is their hospital object
    if (!h) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <LayoutDashboard size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Unavailable</h2>
          <p className="text-slate-500 text-center max-w-md">Your account has not been assigned to a hospital yet. Please contact the System Administrator to complete your setup.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Active Alerts" value={alerts.length} icon={AlertTriangle} color="red" />
          <StatCard title="Resolved Today" value={alertStats?.resolved_today || 0} icon={CheckCircle2} color="emerald" />
          <StatCard title="Avg. Resolution" value={`${alertStats?.avg_resolution_minutes || 0}m`} icon={Clock} color="cyan" />
        </div>

        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-md">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{h?.name}</h2>
              <p className="text-slate-500 text-sm">Real-time resource dashboard</p>
            </div>
            <Badge color="green">Active</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {['general_bed', 'icu_bed', 'ventilator'].map(type => {
              const res = h?.resources?.[type] || { total: 0, available: 0 };
              const perc = Math.round((res.available / (res.total || 1)) * 100);
              return (
                <div key={type} className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{type.replace('_', ' ')}</div>
                    <div className="text-2xl font-bold font-mono text-slate-800">{res.available}/{res.total}</div>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className={`h-full transition-all duration-1000 ${perc < 20 ? 'bg-red-500' : perc < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                  <p className="text-center text-[10px] text-slate-500 font-bold">{perc}% CAPACITY AVAILABLE</p>
                </div>
              );
            })}
          </div>
          
          <div className="mt-10 pt-10 border-t border-slate-200 flex justify-center">
            <button onClick={() => setActivePage('myhospital')} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
              Update Availability <RefreshCcw size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const HospitalsPage = ({ 
  hospitals, effectiveRole, searchQuery, setSearchQuery, 
  hospitalFilters, setHospitalFilters, setModals, modals, 
  loading, loadError, loadInitialData 
}) => {
  if (loadError) return <ErrorState message={loadError} onRetry={loadInitialData} />;
  const filteredHospitals = hospitals.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.zone.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = hospitalFilters.type === 'All' || h.type.toLowerCase() === hospitalFilters.type.toLowerCase();
    const matchesZone = hospitalFilters.zone === 'All' || h.zone === hospitalFilters.zone;
    const matchesStatus = hospitalFilters.status === 'All' || h.status === hospitalFilters.status.toLowerCase();
    return matchesSearch && matchesType && matchesZone && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search hospitals or zones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <select
            value={hospitalFilters.type}
            onChange={(e) => setHospitalFilters({ ...hospitalFilters, type: e.target.value })}
            className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
          >
            <option>All Types</option>
            <option>Public</option>
            <option>Private</option>
          </select>
          <select
            value={hospitalFilters.zone}
            onChange={(e) => setHospitalFilters({ ...hospitalFilters, zone: e.target.value })}
            className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
          >
            <option>All Zones</option>
            {['North', 'South', 'East', 'West', 'Central', 'Suburban'].map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          {effectiveRole === 'system_admin' && (
            <button
              onClick={() => setModals({ ...modals, addHospital: true })}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition-all whitespace-nowrap"
            >
              <Plus size={16} /> Add Hospital
            </button>
          )}
        </div>
      </div>

      {loading ? <LoadingSkeleton count={6} /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHospitals.map(h => (
            <div key={h.hospital_id} className="bg-white rounded-2xl p-5 flex flex-col gap-4 group border border-slate-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{h.name}</h4>
                  <EscalationBadge level={h.escalation_level ?? 0} />
                  <div className="flex gap-2 mt-1">
                    <Badge color={h.type.toLowerCase() === 'public' ? 'blue' : 'purple'}>{h.type}</Badge>
                    <Badge color="gray">{h.zone}</Badge>
                    <Badge color={h.status === 'active' ? 'green' : 'red'}>{h.status}</Badge>
                  </div>
                </div>
                <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><MoreVertical size={16} /></button>
              </div>

              {h.escalation_level === 3 && (
                <div style={{
                  background: "#FEF2F2", border: "1px solid #FECACA",
                  borderRadius: "6px", padding: "6px 10px",
                  color: "#EF4444", fontSize: "11px", fontWeight: 600, textAlign: "center"
                }}>
                  ⚠ DIVERTING — This hospital is at critical capacity. Route non-critical patients elsewhere.
                </div>
              )}

              <div className="space-y-3">
                {[
                  { key: 'general_bed', label: 'General Beds', bgClass: 'bg-emerald-500' },
                  { key: 'icu_bed', label: 'ICU Beds', bgClass: 'bg-amber-500' },
                  { key: 'ventilator', label: 'Ventilators', bgClass: 'bg-blue-500' },
                ].map((res) => {
                  const data = h.resources?.[res.key] || { available: 0, total: 0 };
                  const perc = Math.round((data.available / (data.total || 1)) * 100);
                  return (
                    <div key={res.key} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-slate-500">{res.label}</span>
                        <span className="text-slate-800 font-mono">{data.available}/{data.total}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${res.bgClass} transition-all duration-1000`}
                          style={{ width: `${perc}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px]">
                <span className="text-slate-500">Updated: {new Date(h.last_updated).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <div className="flex gap-2">
                  <button onClick={() => setModals({ ...modals, hospitalDetails: h })} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-all">Details</button>
                  {effectiveRole === 'system_admin' && <button className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Edit</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SearchPage = ({ searchQuery, setSearchQuery, showToast, userLocation, currentUser, setModals, modals }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchFilters, setSearchFilters] = useState({ resource: 'general_bed', zone: 'All Zones' });
  const [includeCritical, setIncludeCritical] = useState(false);
  const [excludedCriticalCount, setExcludedCriticalCount] = useState(0);

  const handleSearchAction = async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.search({
        resource_type: searchFilters.resource,
        zone: searchFilters.zone,
        q: searchQuery,
        include_critical: includeCritical,
      });
      setSearchResults(res.data.results);
      setExcludedCriticalCount(res.data.excluded_critical_count ?? 0);
    } catch (err) {
      showToast('Search failed', 'error');
      setSearchError('Failed to load search results');
    } finally {
      setSearching(false);
    }
  };

  const sortedResults = useMemo(() => {
    if (!userLocation || !searchResults.length) return searchResults;
    
    return [...searchResults].map(h => {
      const hLat = parseFloat(h.lat) || 18.5204;
      const hLng = parseFloat(h.lng) || 73.8567;
      const uLat = parseFloat(userLocation.lat);
      const uLng = parseFloat(userLocation.lng);
      
      // Calculate distance using Haversine formula for better accuracy
      const R = 6371; // Earth's radius in km
      const dLat = (hLat - uLat) * Math.PI / 180;
      const dLng = (hLng - uLng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(uLat * Math.PI / 180) * Math.cos(hLat * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;
      
      return { ...h, distance: dist.toFixed(1) };
    }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
  }, [searchResults, userLocation]);

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto text-center space-y-6 py-12">
        <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-800">Find Available Resources</h1>
        <p className="text-slate-500 text-lg">Real-time capacity tracking across all hospitals in Pune city.</p>

        {currentUser?.role === 'operator' && (
          <div className="mb-6 p-4 glass-card border border-cyan-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                <MapPin size={20} />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-white">Your Current Location</h4>
                <p className="text-xs text-slate-400">{userLocation?.address || 'Location not set. Set location to see nearest hospitals.'}</p>
              </div>
            </div>
            <button 
              onClick={() => setModals({ ...modals, setOperatorLocation: true })}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <RefreshCcw size={14} /> {userLocation ? 'Change Location' : 'Set My Location'}
            </button>
          </div>
        )}

        <div className="bg-white p-2 rounded-2xl flex flex-col md:flex-row gap-2 shadow-xl relative z-10 border border-slate-200">
          <div className="flex-1 relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={20} />
            <input
              type="text"
              placeholder="Enter hospital name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchAction()}
              className="w-full bg-slate-50/50 border border-transparent rounded-xl py-4 pl-12 pr-4 text-slate-800 focus:bg-white focus:border-blue-200 focus:ring-4 ring-blue-500/10 transition-all outline-none"
            />
          </div>
          <button 
            onClick={handleSearchAction}
            disabled={searching}
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
          >
            {searching ? <RefreshCcw className="animate-spin" size={20} /> : <SearchIcon size={20} />} Search
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <span className="text-slate-500 uppercase tracking-widest font-bold">Filters:</span>
          {['general_bed', 'icu_bed', 'ventilator'].map(type => (
            <button 
              key={type}
              onClick={() => setSearchFilters({ ...searchFilters, resource: type })}
              className={`px-4 py-2 rounded-full border transition-all ${searchFilters.resource === type ? 'border-blue-200 bg-blue-50 text-blue-700 font-bold' : 'border-slate-300 hover:border-slate-400 text-slate-600 bg-white'}`}
            >
              {type.replace('_', ' ').toUpperCase()}
            </button>
          ))}
          <select 
            value={searchFilters.zone}
            onChange={(e) => setSearchFilters({ ...searchFilters, zone: e.target.value })}
            className="bg-white border border-slate-300 rounded-full px-4 py-2 text-slate-700 focus:outline-none focus:border-blue-400"
          >
            <option>All Zones</option>
            {['North', 'South', 'East', 'West', 'Central', 'Suburban'].map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>

        {/* Include Critical toggle + exclusion warning */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginTop: "-8px" }}>
          {excludedCriticalCount > 0 && !includeCritical && (
            <div style={{
              padding: "6px 12px", borderRadius: "8px",
              background: "#FEF2F2", border: "1px solid #FECACA",
              color: "#EF4444", fontSize: "12px"
            }}>
              ⚠ {excludedCriticalCount} critical hospital{excludedCriticalCount > 1 ? "s" : ""} hidden
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeCritical}
              onChange={e => { setIncludeCritical(e.target.checked); }}
              style={{ accentColor: "#EF4444", width: 15, height: 15 }}
            />
            <span style={{ color: "#475569", fontSize: "13px", fontWeight: 500 }}>Show critical hospitals</span>
          </label>
        </div>
      </div>

      {searchError ? (
        <ErrorState message={searchError} onRetry={handleSearchAction} />
      ) : sortedResults.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 max-w-5xl mx-auto">
          <h3 className="text-lg font-bold mb-2">Search Results ({sortedResults.length})</h3>
          {sortedResults.map((h, idx) => (
            <div key={h.hospital_id} className={`bg-white rounded-2xl overflow-hidden flex flex-col md:flex-row items-stretch group relative border shadow-sm hover:shadow-md transition-all ${idx === 0 ? 'border-blue-300' : 'border-slate-200 hover:border-blue-200'}`}>
              <div className="w-2 md:w-3 bg-gradient-to-b from-blue-500 to-blue-600" />
              <div className="p-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{h.name}</h4>
                    <Badge color={h.type.toLowerCase() === 'public' ? 'blue' : 'purple'}>{h.type}</Badge>
                    {h.distance && <Badge color="cyan">{h.distance} km</Badge>}
                    <EscalationBadge level={h.escalation_level ?? 0} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><MapPin size={12} className="text-blue-500" /> {h.zone}</span>
                    <span className="flex items-center gap-1"><Shield size={12} className="text-emerald-500" /> Verified</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2">{h.address}</div>
                </div>
                <div className="flex items-center gap-4">
                  {['general_bed', 'icu_bed', 'ventilator'].map(type => (
                    <div key={type} className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <div className={`text-lg font-bold font-mono ${h.resources?.[type]?.available > 0 ? 'text-slate-800' : 'text-slate-400'}`}>{h.resources?.[type]?.available || 0}</div>
                      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">{type.split('_')[0]}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col justify-center gap-2">
                  <button 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(h.name + ' ' + h.address)}`, '_blank')}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.98]"
                  >
                    Get Directions
                  </button>
                  <button className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
                    <Phone size={14} /> Call Hospital
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !searching && (
        <div className="text-center py-20 text-slate-600">
          <SearchIcon size={48} className="mx-auto mb-4 opacity-20" />
          <p>Search for hospitals to view availability</p>
        </div>
      )}
    </div>
  );
};

const AlertsPage = ({ alerts, alertStats, handleResolveAlert, hospitals }) => {
  const [allAlerts, setAllAlerts] = useState([]);
  const [alertFilter, setAlertFilter] = useState('Active');
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState(null);

  const getHospitalEscalation = (hospitalId) => {
    const h = (hospitals || []).find(h => h.hospital_id === hospitalId);
    return h ? (h.escalation_level ?? 0) : 0;
  };

  const loadAlerts = () => {
    setAlertsLoading(true);
    setAlertsError(null);
    api.getAlerts({ status: alertFilter.toLowerCase() })
      .then(d => setAllAlerts(d.data.alerts))
      .catch(() => setAlertsError('Failed to load alerts'))
      .finally(() => setAlertsLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, [alertFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Active Alerts" value={alerts.length} icon={AlertTriangle} color="red" />
        <StatCard title="Resolved Today" value={alertStats?.resolved_today || 0} icon={CheckCircle2} color="emerald" />
        <StatCard title="Avg. Resolution" value={`${alertStats?.avg_resolution_minutes || 0}m`} icon={Clock} color="cyan" />
      </div>

      <div className="bg-white rounded-2xl p-6 min-h-[500px] border border-slate-200 shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-4">
            {['Active', 'Resolved'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setAlertFilter(tab)}
                className={`pb-2 px-1 text-sm font-bold transition-colors border-b-2 ${tab === alertFilter ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-800'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {alertsLoading ? <LoadingSkeleton count={4} /> : alertsError ? (
            <ErrorState message={alertsError} onRetry={loadAlerts} />
          ) : allAlerts.length > 0 ? allAlerts.map(alert => (
            <div key={alert.alert_id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col md:flex-row items-center gap-4 hover:border-blue-300 transition-all">
              <div className={`w-2 h-2 rounded-full ${alert.status === 'active' ? 'bg-red-500 pulse-dot danger' : 'bg-emerald-500'}`} />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-800 text-sm">{alert.hospital_name}</h4>
                  <Badge color={alert.severity === 'critical' ? 'red' : 'amber'}>{alert.severity}</Badge>
                  <EscalationBadge level={getHospitalEscalation(alert.hospital_id)} />
                </div>
                <p className="text-xs text-slate-500 capitalize">{alert.resource_type.replace('_', ' ')} triggered at {alert.current_value} (Threshold: {alert.threshold_value})</p>
              </div>
              <div className="text-right space-y-1 md:w-32">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{alert.status}</div>
                <div className="text-[11px] text-slate-500">{new Date(alert.triggered_at).toLocaleTimeString()}</div>
              </div>
              <div className="md:w-40 flex justify-end">
                {alert.status === 'active' ? (
                  <button onClick={() => handleResolveAlert(alert.alert_id)} className="px-4 py-1.5 bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 text-[11px] font-bold rounded-lg border border-emerald-200 transition-all">Mark Resolved</button>
                ) : (
                  <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Resolved</div>
                )}
              </div>
            </div>
          )) : (
            <div className="text-center py-20 text-slate-500">No {alertFilter.toLowerCase()} alerts found</div>
          )}
        </div>
      </div>
    </div>
  );
};

const AnalyticsPage = ({ showToast, loadInitialData }) => {
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [analyticsTrends, setAnalyticsTrends] = useState(null);
  const [range, setRange] = useState('7d');
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsEscalation, setAnalyticsEscalation] = useState(null);

  useEffect(() => {
    setAnalyticsError(null);
    api.getAnalyticsSummary()
      .then(d => setAnalyticsSummary(d.data))
      .catch(() => setAnalyticsError('Failed to load analytics summary'));
    api.getEscalationSummary()
      .then(d => setAnalyticsEscalation(d.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setAnalyticsError(null);
    api.getAnalyticsTrends(range)
      .then(d => setAnalyticsTrends(d.data))
      .catch(() => setAnalyticsError('Failed to load analytics trends'));
  }, [range]);

  const handleExport = async () => {
    const res = await api.exportCSV(range);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medigrid_report_${range}.csv`;
    a.click();
    showToast('Report exported successfully');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {analyticsError && <ErrorState message={analyticsError} onRetry={() => loadInitialData()} />}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><BarChart3 className="text-blue-600" /> System Insights</h2>
        <div className="flex gap-2">
          <select 
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 3 Months</option>
          </select>
          <button onClick={handleExport} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors">Export CSV</button>
        </div>
      </div>

      {analyticsEscalation && (
        <div style={{
          background: "#F8FAFC", border: "1px solid #E2E8F0",
          borderRadius: "12px", padding: "20px 24px"
        }}>
          <h3 style={{ color: "#1E293B", fontWeight: 700, marginBottom: "16px", fontSize: "15px" }}>City Escalation Snapshot</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {[
              { key: "normal",    level: 0, label: "Normal" },
              { key: "pressured", level: 1, label: "Pressured" },
              { key: "diverted",  level: 2, label: "Diverted" },
              { key: "critical",  level: 3, label: "Critical" },
            ].map(({ key, level, label }) => {
              const cfg = ESCALATION_CONFIG[level];
              const count = analyticsEscalation[key] ?? 0;
              const pct = analyticsEscalation.total > 0
                ? Math.round((count / analyticsEscalation.total) * 100) : 0;
              return (
                <div key={key} style={{
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: "10px", padding: "14px 16px", textAlign: "center"
                }}>
                  <div style={{ fontSize: "32px", fontWeight: 800, color: cfg.color }}>{count}</div>
                  <div style={{ fontSize: "13px", color: cfg.color, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>{pct}% of hospitals</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-wider">Bed Availability Trend</h3>
          <div className="h-[300px]">
            {analyticsTrends ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsTrends.labels.map((l, i) => ({
                  name: l,
                  general: analyticsTrends.datasets.general_bed[i],
                  icu: analyticsTrends.datasets.icu_bed[i],
                  vent: analyticsTrends.datasets.ventilator[i]
                }))}>
                  <CartesianGrid stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="general" stroke="#06B6D4" strokeWidth={3} dot={{ fill: '#06B6D4', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: '#fff' }} />
                  <Line type="monotone" dataKey="icu" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 0, r: 4 }} />
                  <Line type="monotone" dataKey="vent" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', strokeWidth: 0, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <LoadingSkeleton count={1} />}
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-wider">Utilization by Zone</h3>
          <div className="h-[300px]">
            {analyticsSummary ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsSummary.zone_utilization}>
                  <XAxis dataKey="zone" stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                  <Bar dataKey="utilization_pct" name="Utilization %" radius={[6, 6, 0, 0]}>
                    {analyticsSummary.zone_utilization.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.utilization_pct > 80 ? '#EF4444' : entry.utilization_pct > 60 ? '#F59E0B' : '#10B981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <LoadingSkeleton count={1} />}
          </div>
        </div>
      </div>
    </div>
  );
};

const MyHospitalPage = ({ 
  dashStats, currentUser, demoHospitalId, showToast, 
  loadInitialData, loadError 
}) => {
  if (loadError) return <ErrorState message={loadError} onRetry={loadInitialData} />;
  const h = dashStats; 
  const effectiveHospitalId = currentUser?.role === 'hospital_admin' ? currentUser.hospital_id : demoHospitalId;
  const [form, setForm] = useState({
    general_bed: 0,
    icu_bed: 0,
    ventilator: 0
  });

  if (!effectiveHospitalId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
          <Building2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">No Hospital Assigned</h2>
        <p className="text-slate-400 text-center max-w-md">Your account has not been assigned to a hospital yet. Please contact the System Administrator to complete your setup.</p>
      </div>
    );
  }

  useEffect(() => {
    if (h?.resources) {
      setForm({
        general_bed: h.resources.general_bed?.available || 0,
        icu_bed: h.resources.icu_bed?.available || 0,
        ventilator: h.resources.ventilator?.available || 0
      });
    }
  }, [h]);

  const handleUpdate = async () => {
    if (!effectiveHospitalId) {
      showToast('No hospital selected', 'error');
      return;
    }
    const res = await api.updateResources(effectiveHospitalId, form);
    if (res.status === 'success') {
      showToast('Resources updated successfully');
      loadInitialData(); // Reload stats
    } else {
      let errMsg = res.message || 'Update failed';
      if (res.errors) {
        errMsg = Object.values(res.errors).join(' | ');
      }
      showToast(errMsg, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto py-8">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-3xl font-bold text-white">Resource Management</h2>
        <p className="text-slate-400">Update current availability for {h?.name}</p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ color: "#94A3B8", fontSize: "12px", marginBottom: "6px" }}>CURRENT ESCALATION LEVEL</div>
        <EscalationBadge level={h?.escalation_level ?? 0} size="lg" />
        {(h?.escalation_level ?? 0) >= 2 && (
          <div style={{
            marginTop: "10px", padding: "10px 14px", borderRadius: "8px",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#EF4444", fontSize: "13px"
          }}>
            Your hospital is currently{" "}
            {h.escalation_level === 2 ? "diverting non-critical patients" : "at critical capacity"}.
            Update your resource counts to reflect current availability.
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-8 space-y-8 border border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { key: 'general_bed', label: 'General Beds', max: h?.resources?.general_bed?.total || 0, icon: BedDouble },
            { key: 'icu_bed', label: 'ICU Beds', max: h?.resources?.icu_bed?.total || 0, icon: Activity },
            { key: 'ventilator', label: 'Ventilators', max: h?.resources?.ventilator?.total || 0, icon: TrendingUp },
          ].map((field) => (
            <div key={field.key} className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <field.icon size={14} /> {field.label}
              </div>
              <input
                type="number"
                value={form[field.key]}
                onChange={(e) => setForm({ ...form, [field.key]: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-2xl font-mono text-white focus:outline-none focus:border-cyan-500 focus:ring-1 ring-cyan-500/50 transition-all"
              />
              <div className="text-[10px] text-slate-500 text-center font-bold">MAX CAPACITY: {field.max}</div>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-slate-800">
          <button onClick={handleUpdate} className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2">
            <RefreshCcw size={18} /> Update Resources
          </button>
        </div>
      </div>
    </div>
  );
};

const EscalationHistoryTab = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [histFilters, setHistFilters] = useState({ days: 30 });

  useEffect(() => {
    setLoading(true);
    api.getEscalationHistory(histFilters).then(data => {
      setHistory(data.data?.history ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [histFilters]);

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800">
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <select
          value={histFilters.days}
          onChange={e => setHistFilters(f => ({ ...f, days: e.target.value }))}
          style={{
            background: "rgba(16,34,68,0.7)", border: "1px solid rgba(30,48,94,0.6)",
            borderRadius: "8px", padding: "6px 12px", color: "#F8FAFC", fontSize: "13px"
          }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {loading ? (
        <div style={{ color: "#64748B", textAlign: "center", padding: "40px" }}>Loading...</div>
      ) : history.length === 0 ? (
        <div style={{ color: "#64748B", textAlign: "center", padding: "40px" }}>
          No escalation level changes in the selected period.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {history.map((entry, i) => (
            <div key={entry.log_id} style={{
              display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
              background: i % 2 === 0 ? "rgba(16,34,68,0.5)" : "rgba(16,34,68,0.3)",
              borderRadius: "8px", padding: "10px 14px",
              border: "1px solid rgba(30,48,94,0.4)"
            }}>
              <div style={{ minWidth: 180 }}>
                <div style={{ color: "#F8FAFC", fontWeight: 600, fontSize: "13px" }}>{entry.hospital_name}</div>
                <div style={{ color: "#64748B", fontSize: "11px" }}>{entry.hospital_zone} Zone</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <EscalationBadge level={entry.old_level ?? 0} />
                <span style={{ color: "#64748B", fontSize: "16px" }}>→</span>
                <EscalationBadge level={entry.new_level ?? 0} />
              </div>
              <div style={{ marginLeft: "auto", color: "#64748B", fontSize: "11px" }}>
                {new Date(entry.changed_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AdminPanel = ({ users, auditLogs, thresholds, modals, setModals, loadError, loadInitialData }) => {
  const [adminTab, setAdminTab] = useState('Users');

  if (loadError) return <ErrorState message={loadError} onRetry={loadInitialData} />;
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex gap-4 border-b border-slate-800 pb-px">
        {['Users', 'Thresholds', 'Audit Logs', 'Escalation History'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setAdminTab(tab)}
            className={`pb-4 px-2 text-sm font-bold transition-all border-b-2 ${tab === adminTab ? 'text-cyan-400 border-cyan-400' : 'text-slate-500 border-transparent hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {adminTab === 'Users' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(u => (
                  <tr key={u.user_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{u.name}<div className="text-[10px] text-slate-500 font-normal">{u.email}</div></td>
                    <td className="px-6 py-4"><Badge color="cyan">{u.role.replace('_', ' ')}</Badge></td>
                    <td className="px-6 py-4"><span className={`flex items-center gap-1.5 text-xs ${u.status === 'active' ? 'text-emerald-400' : 'text-slate-500'}`}><div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} /> {u.status}</span></td>
                    <td className="px-6 py-4 text-xs text-slate-500">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-all"><Edit2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminTab === 'Thresholds' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {thresholds.map(t => (
            <div key={t.threshold_id} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-cyan-500/30 transition-all group">
              <div className="flex justify-between items-start">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400">
                  <Activity size={20} />
                </div>
                <button 
                  onClick={() => setModals({ ...modals, editThresholds: t })}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              <div>
                <h4 className="font-bold text-white capitalize">{t.resource_type.replace('_', ' ')}</h4>
                <p className="text-xs text-slate-500">Alert triggers</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Low</div>
                  <div className="text-lg font-mono font-bold text-amber-400">{t.low_threshold}%</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Critical</div>
                  <div className="text-lg font-mono font-bold text-red-500">{t.critical_threshold}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {adminTab === 'Audit Logs' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Entity</th>
                  <th className="px-6 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.map(log => (
                  <tr key={log.log_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{log.user}</td>
                    <td className="px-6 py-4"><Badge color="gray">{log.action}</Badge></td>
                    <td className="px-6 py-4 text-slate-400 text-xs capitalize">{log.entity_type}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminTab === 'Escalation History' && <EscalationHistoryTab />}
    </div>
  );
};


const HospitalDetailsContent = ({ hospital }) => (
  <div className="space-y-8 animate-in fade-in duration-300">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Facility Information</h3>
          <div className="glass-card p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="text-cyan-400 mt-1" size={18} />
              <div>
                <div className="text-sm font-bold text-white">Address</div>
                <div className="text-xs text-slate-400">{hospital.address}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="text-emerald-400 mt-1" size={18} />
              <div>
                <div className="text-sm font-bold text-white">Contact</div>
                <div className="text-xs text-slate-400">{hospital.contact || 'Not available'}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="text-purple-400 mt-1" size={18} />
              <div>
                <div className="text-sm font-bold text-white">Zone / Type</div>
                <div className="text-xs text-slate-400">{hospital.zone} • {hospital.type}</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Operating Status</h3>
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${hospital.status === 'active' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
            <div className={`w-3 h-3 rounded-full ${hospital.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm font-bold uppercase tracking-wider">{hospital.status === 'active' ? 'Operational' : 'Inactive'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Resource Breakdown</h3>
        <div className="space-y-4">
          {[
            { key: 'general_bed', label: 'General Beds', color: 'cyan' },
            { key: 'icu_bed', label: 'ICU Beds', color: 'emerald' },
            { key: 'ventilator', label: 'Ventilators', color: 'amber' },
          ].map(res => {
            const data = hospital.resources?.[res.key] || { available: 0, total: 0 };
            const perc = Math.round((data.available / (data.total || 1)) * 100);
            return (
              <div key={res.key} className="glass-card p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-end">
                  <div className="text-xs font-bold text-slate-400">{res.label}</div>
                  <div className="text-lg font-mono font-bold text-white">{data.available}/{data.total}</div>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full bg-${res.color}-500 transition-all duration-1000`}
                    style={{ width: `${perc}%` }}
                  />
                </div>
                <div className="text-[10px] text-right font-bold text-slate-500 uppercase tracking-widest">{perc}% Available</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    <div style={{ borderTop: "1px solid rgba(30,48,94,0.5)", paddingTop: "16px", marginTop: "8px" }}>
      <div style={{ color: "#94A3B8", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>ESCALATION STATUS</div>
      <EscalationBadge level={hospital.escalation_level ?? 0} size="lg" />
      {hospital.escalation_updated_at && (
        <div style={{ color: "#64748B", fontSize: "11px", marginTop: "6px" }}>
          Last updated: {new Date(hospital.escalation_updated_at).toLocaleString()}
        </div>
      )}
      {(hospital.escalation_level ?? 0) >= 1 && (
        <div style={{
          marginTop: "10px", padding: "8px 12px", borderRadius: "6px",
          background: "rgba(16,34,68,0.5)", color: "#94A3B8", fontSize: "12px"
        }}>
          {hospital.escalation_level === 1 && "Resources running low. Internal capacity actions should begin."}
          {hospital.escalation_level === 2 && "Non-critical admissions should be routed to other hospitals in this zone."}
          {hospital.escalation_level === 3 && "Hospital at critical capacity. Emergency admissions only. All others must be diverted."}
        </div>
      )}
    </div>

    <div className="pt-6 border-t border-slate-800 flex justify-end gap-3">
      <button className="px-6 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-sm font-bold transition-all">Download Report</button>
      <button 
        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hospital.name + ' ' + hospital.address)}`, '_blank')}
        className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all"
      >
        Direct Navigation
      </button>
    </div>
  </div>
);

const MapPicker = ({ onLocationSelect, initialCoords }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [lng, setLng] = useState(initialCoords?.lng || 73.8567);
  const [lat, setLat] = useState(initialCoords?.lat || 18.5204);
  const [zoom, setZoom] = useState(12);

  // NOTE: You must replace this with your own Mapbox Access Token
  // NOTE: Uses environment variable VITE_MAPBOX_ACCESS_TOKEN
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoibWFwYm94YXBpIiwiYSI6ImNrNXhuZ3Y4ZTBhbm8zbm56N29hbm56N28ifQ.5nN7W-W_5nN7W-W_5nN7W-W';

  useEffect(() => {
    if (map.current) return; // initialize map only once
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [lng, lat],
      zoom: zoom
    });

    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setLng(lng.toFixed(4));
      setLat(lat.toFixed(4));
      
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new mapboxgl.Marker({ color: '#06B6D4' })
          .setLngLat([lng, lat])
          .addTo(map.current);
      }
      
      onLocationSelect({ lat: lat.toFixed(4), lng: lng.toFixed(4) });
    });

    // Add navigation control
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add Geocoder
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false, // We handle marker manually
      placeholder: 'Search for location...',
      proximity: {
        longitude: lng,
        latitude: lat
      }
    });

    map.current.addControl(geocoder);

    geocoder.on('result', (e) => {
      const { center, place_name } = e.result;
      const [newLng, newLat] = center;
      
      setLng(newLng.toFixed(4));
      setLat(newLat.toFixed(4));

      if (marker.current) {
        marker.current.setLngLat([newLng, newLat]);
      } else {
        marker.current = new mapboxgl.Marker({ color: '#06B6D4' })
          .setLngLat([newLng, newLat])
          .addTo(map.current);
      }

      onLocationSelect({ 
        lat: newLat.toFixed(4), 
        lng: newLng.toFixed(4),
        address: place_name 
      });
    });
  }, []);

  return (
    <div className="relative w-full h-[300px] rounded-xl overflow-hidden border border-slate-800">
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] font-mono text-cyan-400 z-10">
        LAT: {lat} | LNG: {lng}
      </div>
    </div>
  );
};

const AddHospitalForm = ({ onSubmit, onCancel }) => {
  const [form, setForm] = useState({
    name: '', type: 'Public', zone: 'North', address: '', contact: '',
    general_bed: 0, icu_bed: 0, ventilator: 0,
    lat: 18.5204, lng: 73.8567,
    assignedAdminId: '' // ID of selected hospital_admin user
  });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [hospitalAdmins, setHospitalAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(true);

  useEffect(() => {
    api.getHospitalAdmins()
      .then(d => setHospitalAdmins(d.data?.users || []))
      .catch(() => setHospitalAdmins([]))
      .finally(() => setAdminsLoading(false));
  }, []);

  const handleLocationSelect = ({ lat, lng, address }) => {
    setForm(prev => ({ 
      ...prev, lat, lng,
      address: address || prev.address || `Location: ${lat}, ${lng}`
    }));
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Hospital Name</label>
            <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-cyan-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-cyan-500 outline-none">
                <option>Public</option>
                <option>Private</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Zone</label>
              <select value={form.zone} onChange={e => setForm({...form, zone: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-cyan-500 outline-none">
                {['North', 'South', 'East', 'West', 'Central', 'Suburban'].map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Location & Address</label>
            <div className="relative group">
              <textarea 
                required 
                value={form.address} 
                onChange={e => setForm({...form, address: e.target.value})} 
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-cyan-500 outline-none h-24" 
                placeholder="Type address or use map picker..."
              />
              <button 
                type="button"
                onClick={() => setShowMapPicker(!showMapPicker)}
                className={`absolute right-2 bottom-2 p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold ${showMapPicker ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-cyan-500 hover:text-white'}`}
              >
                <MapPin size={14} /> {showMapPicker ? 'CLOSE MAP' : 'OPEN MAP VIEW'}
              </button>
            </div>
            
            {showMapPicker && (
              <div className="mt-2 animate-in zoom-in-95 duration-200">
                <MapPicker 
                  onLocationSelect={handleLocationSelect} 
                  initialCoords={{ lat: form.lat, lng: form.lng }} 
                />
                <p className="mt-2 text-[10px] text-slate-500 italic text-center">Click on the map to place a marker at the hospital's exact location.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Total Capacity</label>
            <div className="space-y-3 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
              {['general_bed', 'icu_bed', 'ventilator'].map(type => (
                <div key={type} className="flex items-center gap-4">
                  <span className="text-xs text-slate-400 flex-1 capitalize">{type.replace('_', ' ')}</span>
                  <input type="number" required value={form[type]} onChange={e => setForm({...form, [type]: parseInt(e.target.value) || 0})} className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-right focus:border-cyan-500 outline-none" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Contact Information</label>
            <input value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-cyan-500 outline-none" placeholder="+91 1234567890" />
          </div>

          {/* Hospital Admin Assignment */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Assign Hospital Admin</label>
            <select
              value={form.assignedAdminId}
              onChange={e => setForm({...form, assignedAdminId: e.target.value})}
              disabled={adminsLoading}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-cyan-500 outline-none disabled:opacity-50"
            >
              <option value="">— None / Assign Later —</option>
              {hospitalAdmins.map(admin => (
                <option key={admin.user_id} value={admin.user_id}>
                  {admin.name} ({admin.email}){admin.hospital_id ? ' ⚠ Already Assigned' : ''}
                </option>
              ))}
            </select>
            {form.assignedAdminId && hospitalAdmins.find(a => a.user_id === form.assignedAdminId)?.hospital_id && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                <AlertCircle size={10} /> This admin is already assigned to another hospital. Assigning will overwrite.
              </p>
            )}
            {adminsLoading && <p className="text-[10px] text-slate-500 mt-1">Loading hospital admins...</p>}
          </div>
        </div>
      </div>
      <div className="pt-4 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-sm font-bold transition-all">Cancel</button>
        <button type="submit" className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all">Save Hospital</button>
      </div>
    </form>
  );
};

const ThresholdForm = ({ threshold, onSubmit, onCancel }) => {
  const [form, setForm] = useState(threshold || { resource_type: 'general_bed', low_threshold: 20, critical_threshold: 10 });
  
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase">Resource Type</label>
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-sm font-bold text-white capitalize">
            {form.resource_type.replace('_', ' ')}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" /> Low Alert Threshold (%)
            </label>
            <input type="number" value={form.low_threshold} onChange={e => setForm({...form, low_threshold: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-lg font-mono focus:border-amber-500/50 outline-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Critical Alert Threshold (%)
            </label>
            <input type="number" value={form.critical_threshold} onChange={e => setForm({...form, critical_threshold: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-lg font-mono focus:border-red-500/50 outline-none" />
          </div>
        </div>
        <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1">Impact Info</p>
          <p className="text-xs text-slate-400 leading-relaxed">Alerts will be automatically triggered when available capacity falls below these percentages. Critical alerts notify city authorities immediately.</p>
        </div>
      </div>
      <div className="pt-4 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-sm font-bold transition-all">Cancel</button>
        <button type="submit" className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all">Update Thresholds</button>
      </div>
    </form>
  );
};


// --- LOGIN / REGISTER COMPONENT ---

const Login = ({ onLogin, onRegister }) => {
  const [tab, setTab] = useState('login');

  // Login state
  const [email, setEmail] = useState('admin@medigrid.in');
  const [password, setPassword] = useState('Admin@1234');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState('user');
  const [regShowPw, setRegShowPw] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  const fillDemo = (e, r) => {
    e.preventDefault();
    const creds = {
      admin:    ['admin@medigrid.in',            'Admin@1234'],
      hospital: ['priya.rao@citygeneral.in',      'Hospital@123'],
      operator: ['rohan.s@punepolice.in',         'Operator@123'],
      authority: ['kavita@punecity.gov.in',       'Authority@123']
    };
    setEmail(creds[r][0]);
    setPassword(creds[r][1]);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    await onLogin(email, password);
    setLoginLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (regPassword !== regConfirm) { setRegError('Passwords do not match'); return; }
    if (regPassword.length < 6) { setRegError('Password must be at least 6 characters'); return; }
    setRegLoading(true);
    const result = await onRegister(regName, regEmail, regPassword, regRole);
    if (result?.status !== 'success') setRegError(result?.message || 'Registration failed');
    setRegLoading(false);
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-xl py-3 pl-11 pr-4 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400 text-sm";
  const iconCls  = "absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #E0F2FE 100%)' }}>
      <div className="absolute inset-0 medi-grid-bg opacity-40" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-100 rounded-full blur-3xl opacity-60 translate-y-1/2 -translate-x-1/2" />

      <div className="w-full max-w-[410px] animate-in fade-in zoom-in duration-500 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg mb-4">
            <Shield size={28} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">MediGrid</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Hospital Resource Management System</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="flex border-b border-slate-100">
            <button onClick={() => setTab('login')} className={`flex-1 py-3.5 text-sm font-semibold transition-all ${tab === 'login' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/60' : 'text-slate-500 hover:text-slate-700'}`}>Sign In</button>
            <button onClick={() => setTab('register')} className={`flex-1 py-3.5 text-sm font-semibold transition-all ${tab === 'register' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/60' : 'text-slate-500 hover:text-slate-700'}`}>Register</button>
          </div>

          <div className="p-7">
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email Address</label>
                  <div className="relative group">
                    <div className={iconCls}><Mail size={16} /></div>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="name@example.com" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-xs font-semibold text-slate-600">Password</label>
                    <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700">Forgot password?</a>
                  </div>
                  <div className="relative group">
                    <div className={iconCls}><Lock size={16} /></div>
                    <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} pr-11`} placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loginLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                  {loginLoading ? <RefreshCcw size={18} className="animate-spin" /> : <>Sign In <ChevronRight size={16} /></>}
                </button>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] text-center font-semibold text-slate-400 uppercase tracking-widest">Demo Quick Access</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[['admin','System Admin'],['hospital','Hospital Admin'],['operator','Operator'],['authority','Authority']].map(([k,l]) => (
                      <button key={k} onClick={(e) => fillDemo(e, k)} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all">{l}</button>
                    ))}
                  </div>
                </div>
              </form>
            )}

            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-[11px] text-blue-600 font-medium">Register as a general user or as a new hospital administrator.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Account Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRegRole('user')} className={`p-2 rounded-xl text-xs font-semibold transition-all border ${regRole === 'user' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}>General User</button>
                    <button type="button" onClick={() => setRegRole('hospital_admin')} className={`p-2 rounded-xl text-xs font-semibold transition-all border ${regRole === 'hospital_admin' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}>Hospital Admin</button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Full Name</label>
                  <div className="relative group">
                    <div className={iconCls}><User size={16} /></div>
                    <input type="text" required value={regName} onChange={e => setRegName(e.target.value)} className={inputCls} placeholder="John Doe" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email Address</label>
                  <div className="relative group">
                    <div className={iconCls}><Mail size={16} /></div>
                    <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} className={inputCls} placeholder="name@example.com" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Password</label>
                  <div className="relative group">
                    <div className={iconCls}><Lock size={16} /></div>
                    <input type={regShowPw ? 'text' : 'password'} required value={regPassword} onChange={e => setRegPassword(e.target.value)} className={`${inputCls} pr-11`} placeholder="Min. 6 characters" />
                    <button type="button" onClick={() => setRegShowPw(!regShowPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {regShowPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Confirm Password</label>
                  <div className="relative group">
                    <div className={iconCls}><Lock size={16} /></div>
                    <input type="password" required value={regConfirm} onChange={e => setRegConfirm(e.target.value)} className={inputCls} placeholder="Re-enter password" />
                  </div>
                </div>

                {regError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                    <AlertCircle size={14} /> {regError}
                  </div>
                )}

                <button type="submit" disabled={regLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                  {regLoading ? <RefreshCcw size={18} className="animate-spin" /> : <>Create Account <ChevronRight size={16} /></>}
                </button>

                <p className="text-center text-xs text-slate-400 pt-1">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setTab('login')} className="text-blue-600 font-semibold hover:text-blue-700">Sign in</button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );

};

export default function App() {

  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('medigrid_token'));
  const [currentUser, setCurrentUser] = useState(null);
  const [viewRole, setViewRole] = useState(null);
  const [demoHospitalId, setDemoHospitalId] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toast, setToast] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng, address }

  // App State
  const [hospitals, setHospitals] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState(null);
  const [dashStats, setDashStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [escalationSummary, setEscalationSummary] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitalFilters, setHospitalFilters] = useState({ type: 'All', zone: 'All', status: 'All' });
  const [modals, setModals] = useState({ hospitalDetails: null, addHospital: false, addUser: false, editThresholds: null });

  // Effects
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchCurrentUser();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (currentUser && !viewRole) {
      setViewRole(currentUser.role);
    }
  }, [currentUser, viewRole]);

  useEffect(() => {
    if (currentUser) {
      loadInitialData();
      // Set default page based on role
      const allowed = getAllowedPages(viewRole || currentUser.role);
      if (!allowed.includes(activePage)) {
        setActivePage(allowed[0]);
      }
    }
  }, [currentUser, viewRole]);

  useEffect(() => {
    if (viewRole === 'hospital_admin' && !demoHospitalId && hospitals.length > 0) {
      setDemoHospitalId(hospitals[0].hospital_id);
    }
  }, [viewRole, hospitals, demoHospitalId]);

  useEffect(() => {
    if (viewRole === 'hospital_admin' && demoHospitalId) {
      loadInitialData();
    }
  }, [demoHospitalId]);

  // Data Fetching
  const fetchCurrentUser = async () => {
    try {
      const data = await api.me();
      if (data.status === 'success') {
        setCurrentUser(data.data);
      } else {
        handleLogout();
      }
    } catch (err) {
      handleLogout();
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const role = viewRole || currentUser.role;
      const effectiveHospitalId = currentUser.role === 'hospital_admin'
        ? currentUser.hospital_id
        : (role === 'hospital_admin' ? demoHospitalId : null);
      const promises = [
        api.getHospitals().then(d => setHospitals(d.data.hospitals)),
        api.getAlerts({ status: 'active' }).then(d => setAlerts(d.data.alerts)),
      ];

      if (['system_admin', 'authority'].includes(role)) {
        promises.push(api.getAnalyticsSummary().then(d => setDashStats(d.data)));
        promises.push(api.getAnalyticsTrends('7d').then(d => setTrends(d.data)));
        promises.push(api.getEscalationSummary().then(d => setEscalationSummary(d.data)).catch(() => {}));
      }

      if (role === 'system_admin') {
        promises.push(api.getUsers().then(d => setUsers(d.data.users)));
        promises.push(api.getAuditLogs({ per_page: 10 }).then(d => setAuditLogs(d.data.logs)));
        promises.push(api.getThresholds().then(d => setThresholds(d.data.thresholds)));
      }

      if (['system_admin', 'authority', 'hospital_admin'].includes(role)) {
        promises.push(api.getAlertStats().then(d => setAlertStats(d.data)));
      }

      if (role === 'hospital_admin' && effectiveHospitalId) {
        promises.push(api.getHospital(effectiveHospitalId).then(d => setDashStats(d.data)));
      }

      await Promise.all(promises);
    } catch (err) {
      showToast('Failed to load system data', 'error');
      setLoadError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  const handleLogin = async (email, password) => {
    const result = await api.login(email, password);
    if (result.status === 'success') {
      setToken(result.data.access_token);
      setCurrentUser(result.data.user);
      setIsLoggedIn(true);
      showToast(`Welcome back, ${result.data.user.name}`);
      return result;
    } else {
      showToast(result.message || 'Login failed', 'error');
      return result;
    }
  };

  const handleRegister = async (name, email, password, role) => {
    const result = await api.register(name, email, password, role);
    if (result.status === 'success') {
      setToken(result.data.access_token);
      setCurrentUser(result.data.user);
      setIsLoggedIn(true);
      showToast(`Welcome to MediGrid, ${result.data.user.name}!`);
    } else {
      showToast(result.message || 'Registration failed', 'error');
    }
    return result;
  };

  const handleLogout = async () => {
    await api.logout();
    clearToken();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setViewRole(null);
    setDemoHospitalId(null);
    setLoadError(null);
    showToast('Logged out successfully', 'info');
  };

  const handleAddHospital = async (data) => {
    const { assignedAdminId, ...hospitalData } = data;
    const res = await api.createHospital(hospitalData);
    if (res.status === 'success') {
      // If a hospital admin was selected, link them to this hospital
      if (assignedAdminId && res.data?.hospital_id) {
        await api.updateUser(assignedAdminId, { hospital_id: res.data.hospital_id });
      }
      showToast('Hospital added successfully');
      setModals({ ...modals, addHospital: false });
      loadInitialData();
    } else {
      showToast(res.message || 'Failed to add hospital', 'error');
    }
  };

  const handleUpdateThreshold = async (data) => {
    const res = await api.updateThreshold(data.threshold_id, data);
    if (res.status === 'success') {
      showToast('Threshold updated successfully');
      setModals({ ...modals, editThresholds: null });
      loadInitialData();
    } else {
      showToast(res.message || 'Update failed', 'error');
    }
  };

  const handleResolveAlert = async (id) => {
    const res = await api.resolveAlert(id);
    if (res.status === 'success') {
      setAlerts(prev => prev.filter(a => a.alert_id !== id));
      showToast('Alert marked as resolved');
    }
  };

  const handleRoleSwitch = (role) => {
    setViewRole(role);
    setDashStats(null);
    setAlertStats(null);
    const allowed = getAllowedPages(role);
    setActivePage(allowed[0]);
  };

  const getAllowedPages = (role) => {
    if (role === 'system_admin') return ['dashboard', 'hospitals', 'alerts', 'analytics', 'users', 'admin'];
    if (role === 'hospital_admin') return ['dashboard', 'myhospital', 'alerts'];
    if (role === 'authority') return ['dashboard', 'hospitals', 'alerts', 'analytics'];
    if (role === 'operator') return ['hospitals', 'search', 'alerts'];
    if (role === 'user') return ['hospitals', 'search', 'alerts'];
    return ['hospitals', 'search'];
  };

  const effectiveRole = viewRole || currentUser?.role;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'hospitals', label: 'Hospitals', icon: Building2 },
    { id: 'search', label: 'Search', icon: SearchIcon },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: alerts.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'myhospital', label: 'My Hospital', icon: Building2 },
    { id: 'admin', label: 'Admin Panel', icon: Settings },
  ].filter(item => getAllowedPages(effectiveRole).includes(item.id));



  if (!isLoggedIn) return <Login onLogin={handleLogin} onRegister={handleRegister} />;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-700">
      {/* Sidebar */}
      <aside className={`w-[240px] border-r border-slate-200 bg-white flex flex-col h-screen fixed inset-y-0 z-40 transition-transform duration-300 shadow-sm ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActivePage('dashboard')}>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Shield size={20} />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900">MediGrid</span>
              <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Hospital Network</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 pb-2">Navigation</div>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative ${
                activePage === item.id
                  ? 'active-nav-item'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <item.icon size={18} className={activePage === item.id ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
              <span className="text-sm font-medium">{item.label}</span>
              {item.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center">
                <User size={17} className="text-blue-600" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-semibold text-slate-800 truncate">{currentUser?.name || 'User'}</div>
              <div className="text-[10px] text-slate-400 capitalize truncate">{currentUser?.role.replace('_', ' ')}</div>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 bg-slate-50 ${isSidebarOpen ? 'lg:pl-[240px]' : ''}`}>
        <header className="h-14 border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 lg:hidden">
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-900 capitalize">{activePage.replace(/([A-Z])/g, ' $1')}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock size={12} className="text-blue-500" />
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-[10px] text-slate-400">{currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            </div>

            {currentUser?.role === 'system_admin' && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">View As</span>
                <select
                  value={viewRole || 'system_admin'}
                  onChange={(e) => handleRoleSwitch(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="system_admin">System Admin</option>
                  <option value="hospital_admin">Hospital Admin</option>
                  <option value="authority">City Authority</option>
                  <option value="operator">Emergency Operator</option>
                </select>
              </div>
            )}

            <div className="h-7 w-px bg-slate-200 mx-1" />

            <button className="relative p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onClick={() => setActivePage('alerts')}>
              <Bell size={19} />
              {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />}
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
          {activePage === 'dashboard' && <Dashboard 
            effectiveRole={effectiveRole} 
            dashStats={dashStats} 
            alerts={alerts} 
            trends={trends} 
            alertStats={alertStats}
            loading={loading}
            loadError={loadError}
            loadInitialData={loadInitialData}
            handleResolveAlert={handleResolveAlert}
            setActivePage={setActivePage}
            escalationSummary={escalationSummary}
          />}
          {activePage === 'hospitals' && <HospitalsPage 
            hospitals={hospitals} 
            effectiveRole={effectiveRole}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            hospitalFilters={hospitalFilters}
            setHospitalFilters={setHospitalFilters}
            setModals={setModals}
            modals={modals}
            loading={loading}
            loadError={loadError}
            loadInitialData={loadInitialData}
          />}
          {activePage === 'search' && <SearchPage 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showToast={showToast}
            userLocation={userLocation}
            currentUser={currentUser}
            setModals={setModals}
            modals={modals}
          />}
          {activePage === 'alerts' && <AlertsPage 
            alerts={alerts}
            alertStats={alertStats}
            handleResolveAlert={handleResolveAlert}
            hospitals={hospitals}
          />}
          {activePage === 'analytics' && <AnalyticsPage 
            showToast={showToast}
            loadInitialData={loadInitialData}
          />}
          {activePage === 'myhospital' && <MyHospitalPage 
            dashStats={dashStats}
            currentUser={currentUser}
            demoHospitalId={demoHospitalId}
            showToast={showToast}
            loadInitialData={loadInitialData}
            loadError={loadError}
          />}
          {activePage === 'admin' && <AdminPanel 
            users={users}
            auditLogs={auditLogs}
            thresholds={thresholds}
            modals={modals}
            setModals={setModals}
            loadError={loadError}
            loadInitialData={loadInitialData}
          />}
        </div>
      </main>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Modals */}
      <Modal 
        isOpen={!!modals.hospitalDetails} 
        onClose={() => setModals({ ...modals, hospitalDetails: null })}
        title={modals.hospitalDetails?.name || 'Hospital Details'}
      >
        {modals.hospitalDetails && <HospitalDetailsContent hospital={modals.hospitalDetails} />}
      </Modal>

      <Modal 
        isOpen={modals.addHospital} 
        onClose={() => setModals({ ...modals, addHospital: false })}
        title="Add New Hospital"
      >
        <AddHospitalForm 
          onSubmit={handleAddHospital} 
          onCancel={() => setModals({ ...modals, addHospital: false })} 
        />
      </Modal>

      <Modal 
        isOpen={!!modals.editThresholds} 
        onClose={() => setModals({ ...modals, editThresholds: null })}
        title={`Edit ${modals.editThresholds?.resource_type.replace('_', ' ')} Thresholds`}
      >
        {modals.editThresholds && (
          <ThresholdForm 
            threshold={modals.editThresholds} 
            onSubmit={handleUpdateThreshold}
            onCancel={() => setModals({ ...modals, editThresholds: null })}
          />
        )}
      </Modal>
      <Modal 
        isOpen={modals.setOperatorLocation} 
        onClose={() => setModals({ ...modals, setOperatorLocation: false })}
        title="Set Your Current Location"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400 mb-4">Click on the map to set your current location. Hospitals will be sorted by distance from this point.</p>
          <MapPicker 
            onLocationSelect={(loc) => {
              const formattedLoc = {
                lat: parseFloat(loc.lat),
                lng: parseFloat(loc.lng),
                address: loc.address || `Location: ${loc.lat}, ${loc.lng}`
              };
              setUserLocation(formattedLoc);
              showToast('Location updated. Hospitals now sorted by distance.');
            }}
            initialCoords={userLocation || { lat: 18.5204, lng: 73.8567 }}
          />
          <div className="flex justify-end pt-4">
            <button 
              onClick={() => setModals({ ...modals, setOperatorLocation: false })}
              className="px-6 py-2 bg-cyan-500 text-white text-sm font-bold rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
