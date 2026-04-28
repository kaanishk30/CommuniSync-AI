import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  Shield, AlertCircle, CheckCircle2, Users, Loader2, Send, History, 
  MapPin, UserCircle, LayoutDashboard, Bell, Check, X, LogOut, ChevronRight,
  Camera, Mic, Image as ImageIcon, Volume2, Zap, LogIn, Languages
} from 'lucide-react';
import { 
  db, collection, addDoc, getDocs, query, where, Timestamp, 
  seedVolunteers, seedSectorKeywords, handleFirestoreError, OperationType, onSnapshot, 
  doc, updateDoc, setDoc, deleteDoc
} from './lib/firebase';
import { triageIncident, TriageResult } from './services/geminiService';

// Types
type Role = 'selector' | 'login' | 'signUp' | 'reporter' | 'volunteer' | 'manager';
type Status = 'reported' | 'triaged' | 'matched' | 'assigned' | 'completed';

interface Volunteer {
  id: string;
  name: string;
  email?: string;
  skills: string[];
  group: string;
  isAvailable: boolean;
  currentTask: string | null;
  location?: { lat: number, lng: number };
}

interface Incident extends TriageResult {
  id: string;
  description: string;
  status: Status;
  assigned_vol: string | null;
  reporterId: string;
  timestamp: any;
  imageUrl?: string;
  location?: { lat: number, lng: number };
  urgency?: number; // fallback for old data
  category?: string; // fallback for old data
}

interface Notification {
  id: string;
  volunteer_id: string;
  incident_id: string;
  status: 'pending' | 'accepted' | 'declined';
  incident_desc?: string;
}

// Constants
const SECTOR_DIRECTORY = {
  Medical: {
    icon: '🏥',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    description: 'Physical injuries, bleeding, unconsciousness, medications, clinical crises.',
    storage: 'Medical database, patient status, vitals triage.'
  },
  Fire: {
    icon: '🔥',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    description: 'Active combustion, thick smoke, chemical hazards, structural heat risk.',
    storage: 'Hazard logs, structural assessments, burn zones.'
  },
  Logistics: {
    icon: '🏗️',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    description: 'Debris clearing, heavy lifting, supply transport, machinery, shelter prep.',
    storage: 'Supply chain, machinery logs, shelter capacity.'
  },
  Civil: {
    icon: '🛡️',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    description: 'Coordination, missing persons, local alerts, non-urgent assistance.',
    storage: 'Coordination logs, missing lists, general bulletins.'
  }
};

// Context
const AuthContext = createContext<{ 
  role: Role, 
  setRole: (role: Role) => void,
  targetRole: Role | null,
  setTargetRole: (role: Role) => void,
  authType: 'emergency' | 'standard' | null,
  setAuthType: (type: 'emergency' | 'standard') => void,
  reporterId: string | null,
  setReporterId: (id: string) => void,
  volunteerId: string | null,
  setVolunteerId: (id: string) => void,
  logout: () => void
}>({ 
  role: 'selector', 
  setRole: () => {},
  targetRole: null,
  setTargetRole: () => {},
  authType: null,
  setAuthType: () => {},
  reporterId: null,
  setReporterId: () => {},
  volunteerId: null,
  setVolunteerId: () => {},
  logout: () => {}
});

export default function App() {
  const [role, setRoleState] = useState<Role>(() => (localStorage.getItem('sync_role') as Role) || 'selector');
  const [targetRole, setTargetRole] = useState<Role | null>(null);
  const [authType, setAuthTypeState] = useState<'emergency' | 'standard' | null>(() => (localStorage.getItem('sync_auth_type') as any) || null);
  const [reporterId, setReporterId] = useState<string | null>(() => localStorage.getItem('sync_reporter_id') || null);
  const [volunteerId, setVolunteerIdState] = useState<string | null>(() => localStorage.getItem('sync_vol_id') || null);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem('sync_role', newRole);
  };

  const setVolunteerId = (id: string) => {
    setVolunteerIdState(id);
    localStorage.setItem('sync_vol_id', id);
  };

  const setReporterIdManual = (id: string) => {
    setReporterId(id);
    localStorage.setItem('sync_reporter_id', id);
  };

  const setAuthType = (type: 'emergency' | 'standard') => {
    setAuthTypeState(type);
    localStorage.setItem('sync_auth_type', type);
    if (type === 'emergency') {
      const storedPrevId = localStorage.getItem('sync_persistent_guest_id');
      if (storedPrevId) {
        setReporterId(storedPrevId);
        localStorage.setItem('sync_reporter_id', storedPrevId);
      } else if (!reporterId) {
        const newId = `GUEST_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        setReporterId(newId);
        localStorage.setItem('sync_reporter_id', newId);
        localStorage.setItem('sync_persistent_guest_id', newId);
      }
    }
  };

  const logout = async () => {
    setRoleState('selector');
    setTargetRole(null);
    setAuthTypeState(null);
    setReporterId(null);
    setVolunteerIdState(null);
    localStorage.removeItem('sync_role');
    localStorage.removeItem('sync_auth_type');
    localStorage.removeItem('sync_reporter_id');
    localStorage.removeItem('sync_vol_id');
  };

  useEffect(() => {
    seedVolunteers().catch(console.error);
    seedSectorKeywords().catch(console.error);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      role, setRole, targetRole, setTargetRole, authType, setAuthType, 
      reporterId, setReporterId: setReporterIdManual, volunteerId, setVolunteerId,
      logout 
    }}>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-neutral-800 selection:text-white">
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {role === 'selector' && <RoleSelector key="selector" />}
            {role === 'login' && <LoginPage key="login" />}
            {role === 'signUp' && <SignUpPage key="signUp" />}
            {role === 'reporter' && <ReporterView key="reporter" />}
            {role === 'volunteer' && <VolunteerView key="volunteer" />}
            {role === 'manager' && <ManagerView key="manager" />}
          </AnimatePresence>
        </main>
      </div>
    </AuthContext.Provider>
  );
}

// Utilities
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Components
function Header() {
  const { role, setRole, logout } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const isAuthed = role !== 'selector' && role !== 'login' && role !== 'signUp';

  const languages = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' }
  ];

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setShowLangMenu(false);
  };

  return (
    <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setRole('selector')}>
          <div className="p-2 bg-white rounded-lg">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-display font-bold text-xl tracking-tighter uppercase text-white hidden sm:block">
            {t('app_name')}
          </h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="p-2 hover:bg-neutral-900 rounded-lg transition-colors text-neutral-400 hover:text-white flex items-center gap-2"
              title={t('select_language')}
            >
              <Languages className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase hidden md:inline">
                {languages.find(l => l.code === i18n.language.split('-')[0])?.native || 'EN'}
              </span>
            </button>
            
            <AnimatePresence>
              {showLangMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-2 z-[60]"
                >
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-2 px-3 pt-2">
                    {t('select_language')}
                  </p>
                  <div className="grid gap-1">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                          i18n.language.startsWith(lang.code) 
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                            : 'hover:bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="font-medium">{lang.label}</span>
                        <span className="text-[10px] font-bold opacity-60">{lang.native}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {isAuthed && (
            <>
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-neutral-900 rounded-full border border-neutral-800">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Node_{role}_Active</span>
              </div>
              <button 
                onClick={logout}
                className="p-2 hover:bg-neutral-900 rounded-lg transition-colors text-neutral-400 hover:text-white flex items-center gap-2"
              >
                <span className="text-xs font-bold uppercase hidden sm:inline text-red-500/80">Terminal Offline</span>
                <LogOut className="w-4 h-4 text-red-500" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function RoleSelector() {
  const { setRole, setTargetRole } = useContext(AuthContext);
  const { t } = useTranslation();
  const roles: { id: Role, icon: any, label: string, desc: string, color: string }[] = [
    { id: 'reporter', icon: AlertCircle, label: t('reporter_label'), desc: t('reporter_desc'), color: 'border-red-500/50 hover:bg-red-500/10' },
    { id: 'volunteer', icon: Users, label: t('volunteer_label'), desc: t('volunteer_desc'), color: 'border-blue-500/50 hover:bg-blue-500/10' },
    { id: 'manager', icon: LayoutDashboard, label: t('manager_label'), desc: t('manager_desc'), color: 'border-green-500/50 hover:bg-green-500/10' }
  ];

  const selectRole = (id: Role, mode: 'login' | 'signUp') => {
    setTargetRole(id);
    setRole(mode);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-4xl mx-auto pt-20"
    >
      <div className="text-center mb-16">
        <h2 className="text-4xl font-display font-black text-white mb-4 tracking-tighter uppercase">{t('portal_title')}</h2>
        <p className="text-neutral-500 font-medium font-mono text-xs uppercase tracking-widest leading-relaxed">{t('portal_subtitle')}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map((r) => (
          <div key={r.id} className={`group relative p-8 bg-black border ${r.color} rounded-3xl text-left transition-all hover:-translate-y-1 shadow-2xl flex flex-col`}>
            <r.icon className="w-12 h-12 mb-8 text-white group-hover:scale-110 transition-transform" />
            <h3 className="text-2xl font-bold mb-2 text-white">{r.label}</h3>
            <p className="text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors leading-relaxed mb-8 flex-1">
              {r.desc}
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => selectRole(r.id, 'login')}
                className="w-full py-3 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:invert transition-all"
              >
                {t('identity_auth')}
              </button>
              {r.id === 'reporter' && (
                <button 
                  onClick={() => selectRole(r.id, 'signUp')}
                  className="w-full py-3 bg-neutral-900 border border-neutral-700 text-neutral-400 font-black uppercase text-[10px] tracking-widest rounded-xl hover:text-white hover:border-white transition-all text-center"
                >
                  {t('initialize_node')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-[10px] text-neutral-800 font-bold uppercase tracking-[0.4em]">Awaiting User Selection</p>
      </div>
    </motion.div>
  );
}

function SignUpPage() {
  const { setRole, targetRole, setVolunteerId, setReporterId, logout } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    group: 'Medical',
    skills: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (targetRole === 'volunteer') {
        const volRef = await addDoc(collection(db, 'volunteers'), {
          name: formData.name,
          email: formData.email,
          group: formData.group,
          skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
          isAvailable: true,
          currentTask: null,
          location: { lat: 37.7749 + (Math.random() - 0.5) * 0.1, lng: -122.4194 + (Math.random() - 0.5) * 0.1 }
        });
        setVolunteerId(volRef.id);
      } else if (targetRole === 'reporter') {
        setReporterId(formData.email || `REP_${Math.random().toString(36).substr(2, 4).toUpperCase()}`);
      }
      
      // simulation delay
      setTimeout(() => {
        if (targetRole) setRole(targetRole);
        setLoading(false);
      }, 400); 
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, targetRole === 'volunteer' ? 'volunteers' : 'incidents');
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto pt-10"
    >
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Zap className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-3xl font-display font-black text-white tracking-tighter uppercase italic">Node Registry</h2>
          <p className="text-neutral-500 text-sm mt-2">Initialize <span className="text-white font-bold uppercase">{targetRole}</span> Profile</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Assigned Name</label>
            <input 
              required type="text" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all text-sm"
              placeholder="Operational Alias"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Terminal ID (Email)</label>
            <input 
              required type="email" 
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all text-sm"
              placeholder="id@sync.ai"
            />
          </div>

          {targetRole === 'volunteer' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Deployment Group</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Medical', 'Fire', 'Civil', 'Logistics'].map(g => (
                    <button
                      key={g} type="button"
                      onClick={() => setFormData({...formData, group: g})}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${formData.group === g ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black border-neutral-800 text-neutral-500 hover:border-neutral-600'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Core Skills (Comma separated)</label>
                <input 
                  required type="text" 
                  value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})}
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all text-sm"
                  placeholder="Trauma, Rescue, etc."
                />
              </div>
            </>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
            {loading ? 'Processing Registry...' : 'Initialize Profile'}
          </button>
          
          <button 
            type="button" onClick={logout}
            className="w-full text-neutral-600 hover:text-neutral-400 text-[10px] font-bold uppercase tracking-widest transition-colors mt-2"
          >
            Cancel Registration
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function LoginPage() {
  const { setRole, targetRole, setAuthType, reporterId, setReporterId, volunteerId, setVolunteerId, logout } = useContext(AuthContext);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showStandard, setShowStandard] = useState(targetRole === 'manager');
  const [selectedGroup, setSelectedGroup] = useState('Medical');
  const [email, setEmail] = useState(targetRole === 'manager' ? 'admin@communisync.org' : '');
  const [password, setPassword] = useState(targetRole === 'manager' ? 'manager2026' : '');

  const persistentGuestId = localStorage.getItem('sync_persistent_guest_id');
  const isResumingEmergency = targetRole === 'reporter' && (reporterId || persistentGuestId);
  const isResumingVolunteer = targetRole === 'volunteer' && volunteerId;

  useEffect(() => {
    if (volunteerId && targetRole === 'volunteer') {
      getDocs(collection(db, 'volunteers')).then(s => {
        const found = s.docs.find(d => d.id === volunteerId);
        if (found) {
          const data = found.data();
          if (data && data.group) {
            setSelectedGroup(data.group);
          }
        }
      });
    }
  }, [volunteerId, targetRole]);

  const handleLogin = (type: 'emergency' | 'standard') => {
    setLoading(true);
    setAuthType(type);

    setTimeout(async () => {
      // Linking logic: If we have an existing volunteerId, check if it matches the selected group
      let finalVolId = volunteerId;
      
      if (targetRole === 'volunteer') {
        try {
          const vRef = finalVolId ? doc(db, 'volunteers', finalVolId) : null;
          const vSnap = vRef ? await getDocs(query(collection(db, 'volunteers'), where('__name__', '==', finalVolId))) : null;
          const currentVol = vSnap && !vSnap.empty ? vSnap.docs[0].data() : null;

          if (!finalVolId || (currentVol && currentVol.group !== selectedGroup)) {
            // Need to link to a volunteer of the selected group
            // We prioritize available ones, but fall back to ANY in that group for the sake of the demo session
            const qAvailable = query(collection(db, 'volunteers'), where('group', '==', selectedGroup), where('isAvailable', '==', true));
            const snapAvailable = await getDocs(qAvailable);
            
            if (!snapAvailable.empty) {
              finalVolId = snapAvailable.docs[0].id;
              setVolunteerId(finalVolId);
            } else {
              // Fallback to ANY in group if no available ones found
              const qAny = query(collection(db, 'volunteers'), where('group', '==', selectedGroup));
              const snapAny = await getDocs(qAny);
              if (!snapAny.empty) {
                finalVolId = snapAny.docs[0].id;
                setVolunteerId(finalVolId);
              }
            }
          }
        } catch (e) {
          console.error("Failed to link volunteer", e);
        }
      }

      // Fix for Reporter data persistence on standard resume
      if (type === 'standard' && targetRole === 'reporter' && email) {
        setReporterId(email);
      }

      if (targetRole) {
        setRole(targetRole);
      }
      setLoading(false);
    }, 400); 
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto pt-20"
    >
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl shadow-black">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6">
            <UserCircle className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-3xl font-display font-black text-white tracking-tighter uppercase italic">{t('secure_uplink')}</h2>
          <p className="text-neutral-500 text-sm mt-2">{t('accessing_node', { role: t(targetRole || 'reporter').toUpperCase() })}</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
              {!showStandard ? (
                <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
                  <p className="text-neutral-400 text-xs italic mb-4 text-center">Operational Mode Selection</p>
                  <div className="grid gap-4">
                    {targetRole === 'reporter' && (
                      <button 
                        onClick={() => handleLogin('emergency')}
                        disabled={loading}
                        className={`w-full py-6 font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg flex flex-col items-center gap-1 ${isResumingEmergency ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'} text-white`}
                      >
                        {loading ? <Loader2 className="animate-spin" /> : (
                          <>
                            <span className="text-lg">{isResumingEmergency ? t('resume_session') : t('emergency_access')}</span>
                            <span className="text-[10px] opacity-70">{isResumingEmergency ? 'Return to local hub' : 'Immediate Dispatch Protocol'}</span>
                          </>
                        )}
                      </button>
                    )}

                    {targetRole === 'volunteer' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
                          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-3 text-center">Active Sector Selection</p>
                          <div className="grid grid-cols-2 gap-2">
                            {['Medical', 'Fire', 'Civil', 'Logistics'].map(g => (
                              <button
                                key={g} type="button"
                                onClick={() => setSelectedGroup(g)}
                                className={`py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${selectedGroup === g ? 'bg-blue-500 border-blue-400 text-white' : 'bg-black border-neutral-800 text-neutral-600'}`}
                              >
                                {t(g.toLowerCase())}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleLogin('emergency')}
                          disabled={loading}
                          className={`w-full py-6 font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg flex flex-col items-center gap-1 ${isResumingVolunteer ? 'bg-blue-600 hover:bg-blue-500' : 'bg-neutral-800 hover:bg-neutral-700'} text-white`}
                        >
                          {loading ? <Loader2 className="animate-spin" /> : (
                            <>
                              <span className="text-lg">{isResumingVolunteer ? t('resume_session') : t('emergency_access')}</span>
                              <span className="text-[10px] opacity-70">{isResumingVolunteer ? 'Return to unit dashboard' : 'Initialize group availability'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <button 
                      onClick={() => setShowStandard(true)}
                      disabled={loading}
                      className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-widest rounded-xl transition-all border border-neutral-700"
                    >
                      {t('management_protocol')}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleLogin('standard'); }} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Terminal ID</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@sync.ai"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Access Cipher</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : 'Authorize Connection'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowStandard(false)}
                    className="w-full text-[10px] text-neutral-600 uppercase font-black tracking-widest mt-2"
                  >
                    Back to Selection
                  </button>
                </form>
              )}
            </div>
          
          <button 
            type="button"
            onClick={() => {
              logout();
              localStorage.removeItem('sync_persistent_guest_id');
            }}
            className="w-full text-neutral-600 hover:text-neutral-400 text-[10px] font-bold uppercase tracking-widest transition-colors mt-6 underline decoration-neutral-800"
          >
            Terminal Wipe & Re-Initialize
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SectorDirectory() {
  const { t } = useTranslation();
  const [keywords, setKeywords] = useState<Record<string, string[]>>({});

  useEffect(() => {
    getDocs(collection(db, 'sector_keywords')).then(s => {
      const kMap: Record<string, string[]> = {};
      s.docs.forEach(d => {
        kMap[d.id] = d.data().keywords || [];
      });
      setKeywords(kMap);
    }).catch(err => console.error(err));
  }, []);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <LayoutDashboard size={14} className="text-neutral-500" />
        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Sector Classification Index & Keyword Triggers</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(SECTOR_DIRECTORY).map(([key, info]) => (
          <div key={key} className={`p-3 rounded-xl border ${info.border} ${info.bg} flex flex-col gap-1`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black uppercase ${info.color}`}>{key} {info.icon}</span>
            </div>
            <p className="text-[10px] text-neutral-300 font-medium leading-relaxed">{info.description}</p>
            <div className="mt-2 pt-2 border-t border-neutral-800/20">
              <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-tighter italic">Machine Storage:</p>
              <p className="text-[9px] text-neutral-400 leading-none mt-1">{info.storage}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// REPORTER VIEW
function ReporterView() {
  const { reporterId } = useContext(AuthContext);
  const { t } = useTranslation();
  const [desc, setDesc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [videoRef] = useState(() => React.createRef<HTMLVideoElement>());
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  useEffect(() => {
    // Auto-fetch location on mount
    handleGetLocation();

    const queryIncidents = query(collection(db, 'incidents'), where('reporterId', '==', reporterId));
    const unsubInc = onSnapshot(queryIncidents, (snapshot) => {
      setIncidents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Incident)).sort((a,b) => b.timestamp?.seconds - a.timestamp?.seconds));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'incidents'));

    const unsubVol = onSnapshot(collection(db, 'volunteers'), (snapshot) => {
      setVolunteers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Volunteer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'volunteers'));

    return () => { unsubInc(); unsubVol(); };
  }, [reporterId]);

  // Real-time notification for reporter when status changes
  useEffect(() => {
    if (!reporterId) return;
    const q = query(collection(db, 'incidents'), where('reporterId', '==', reporterId), where('status', '==', 'assigned'));
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || (change.type === 'modified' && (change.doc.data() as Incident).status === 'assigned')) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {}); 
        }
      });
    }, (err) => console.warn("Incident notification error", err));
    return () => unsub();
  }, [reporterId]);

  const nearbyVolunteers = volunteers.filter(v => {
    if (!v.location || !location) return false;
    const distance = calculateDistance(location.lat, location.lng, v.location.lat, v.location.lng);
    return distance <= 5; // 5km range
  });

  const handleCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Wait a small bit for camera to focus
        setTimeout(() => {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current!.videoWidth;
          canvas.height = videoRef.current!.videoHeight;
          canvas.getContext('2d')?.drawImage(videoRef.current!, 0, 0);
          setCapturedImage(canvas.toDataURL('image/jpeg'));
          
          // Stop stream
          stream.getTracks().forEach(track => track.stop());
          if (videoRef.current) videoRef.current.srcObject = null;
        }, 1000);
      }
    } catch (err) {
      console.error("Camera access failed", err);
    }
  };

  const handleVoice = () => {
    // Simulated voice capture for now
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        setDesc("Medical emergency at Main St. Severe bleeding, unconscious male. Approximately 40 years old.");
        setIsRecording(false);
      }, 1000); // Faster simulation
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsFetchingLocation(false);
      },
      (error) => {
        console.error("Error fetching location", error);
        setIsFetchingLocation(false);
      }
    );
  };

  const setMockLocation = () => {
    // SF coordinates matching the seeded volunteers
    setLocation({ lat: 37.7749, lng: -122.4194 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() && !capturedImage) return;
    
    setIsProcessing(true);
    try {
      // Use synced volunteers state instead of re-fetching
      const availableVols = volunteers.filter(v => v.isAvailable);
      const aiResult = await triageIncident(desc, availableVols, capturedImage || undefined);
      
      const incidentRef = await addDoc(collection(db, 'incidents'), {
        description: desc || aiResult.triage.summary,
        triage: aiResult.triage,
        tasks: aiResult.tasks,
        manager_analysis: aiResult.manager_analysis,
        status: 'reported',
        assigned_vol: null,
        reporterId: reporterId || 'ANONYMOUS',
        timestamp: Timestamp.now(),
        imageUrl: capturedImage || null,
        location: location || null
      });

      // --- AUTONOMOUS DISPATCH LOGIC (COMMAND-AGENT PROTOCOL) ---
      let targetVol: Volunteer | null = null;
      const targetGroup = aiResult.triage.targetGroup;
      
      // Filter by group first
      let potentialVols = availableVols.filter(v => v.group === targetGroup);
      
      // Fallback: If no available in specific group, look at all available
      if (potentialVols.length === 0) {
        potentialVols = availableVols;
      }

      if (potentialVols.length > 0) {
        if (location) {
          const sortedByDistance = potentialVols
            .filter(v => v.location)
            .sort((a,b) => {
              const da = calculateDistance(location.lat, location.lng, a.location!.lat, a.location!.lng);
              const db = calculateDistance(location.lat, location.lng, b.location!.lat, b.location!.lng);
              return da - db;
            });
          
          if (sortedByDistance.length > 0) {
            targetVol = sortedByDistance[0];
          }
        } else {
          targetVol = potentialVols[0];
        }
      }

      if (targetVol) {
        if (aiResult.triage.dispatchType === 'AUTO') {
          // Level 1-2: IMMEDIATE ASSIGNMENT (Bypass confirmation)
          await updateDoc(doc(db, 'incidents', incidentRef.id), {
            status: 'assigned',
            assigned_vol: targetVol.id
          });
          await updateDoc(doc(db, 'volunteers', targetVol.id), {
            isAvailable: false,
            currentTask: incidentRef.id
          });
          // Also notify reporter was done by onSnapshot listener usually, 
          // but we can add a notification record for history
          await addDoc(collection(db, 'notifications'), {
            volunteer_id: targetVol.id,
            incident_id: incidentRef.id,
            status: 'accepted', // Auto-accepted
            timestamp: Timestamp.now()
          });
        } else {
          // Level 3-5: MANUAL POOL
          await addDoc(collection(db, 'notifications'), {
            volunteer_id: targetVol.id,
            incident_id: incidentRef.id,
            status: 'pending',
            timestamp: Timestamp.now()
          });
          await updateDoc(doc(db, 'incidents', incidentRef.id), {
            status: 'matched'
          });
        }
      }

      setDesc('');
      setCapturedImage(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'incidents');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-12">
        <section className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl mb-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Shield size={120} />
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
              <AlertCircle className="w-6 h-6 text-red-500" />
              Emergency Broadcast
            </h2>
            <div className="px-3 py-1 bg-red-500/10 border border-red-500/50 rounded-full text-red-500 text-[10px] font-black uppercase">
              ID: {reporterId}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            <div className="lg:col-span-8">
              <textarea
                value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe the emergency. AI will triage and locate nearby units..."
                className="w-full h-40 bg-black border border-neutral-800 rounded-2xl p-6 text-lg text-white focus:border-white outline-none transition-all resize-none"
                disabled={isProcessing}
              />
              <div className="mt-4">
                <SectorDirectory />
              </div>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="flex-1 bg-black border border-neutral-800 rounded-2xl relative overflow-hidden flex items-center justify-center">
                {capturedImage ? (
                  <img src={capturedImage} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon className="mx-auto mb-2 text-neutral-600" />
                    <p className="text-[10px] uppercase font-bold text-neutral-700">Visual Evidence</p>
                  </div>
                )}
                <video ref={videoRef} className="hidden" />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleCapture}
                  className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl flex items-center justify-center gap-2 text-white text-xs font-bold transition-all"
                >
                  <Camera size={14} /> Photo
                </button>
                <button 
                  onClick={handleVoice}
                  className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-white text-xs font-bold transition-all ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-neutral-800 hover:bg-neutral-700'}`}
                >
                  {isRecording ? <Volume2 size={14} /> : <Mic size={14} />} 
                  {isRecording ? 'Audio' : 'Voice'}
                </button>
              </div>
              <div className="p-3 bg-black border border-neutral-800 rounded-xl flex items-center gap-3">
                <MapPin className={location ? "text-blue-500" : "text-neutral-700"} size={16} />
                <div className="flex-1">
                  <p className="text-[8px] font-black uppercase text-neutral-500">Auto-Location</p>
                  <p className="text-[10px] text-neutral-300">
                    {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Establishing Link...'}
                  </p>
                </div>
                {isFetchingLocation && <Loader2 size={12} className="animate-spin text-blue-500" />}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <button
              type="submit" disabled={isProcessing || (!desc.trim() && !capturedImage)}
              className="w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-3 shadow-xl"
            >
              {isProcessing ? <Loader2 className="animate-spin text-black" /> : <Send />}
              {isProcessing ? 'Triaging Nearby Units...' : 'Broadcast Immediate Support'}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-500">My Reports & Tracking</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(incidents || []).map((inc: Incident) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
          {incidents.length === 0 && <p className="text-neutral-700 italic text-sm">No active reports from this terminal.</p>}
        </section>
      </motion.div>
    </div>
  );
}

interface IncidentCardProps {
  incident: Incident;
}

const IncidentCard: React.FC<IncidentCardProps> = ({ incident }) => {
  const steps: Status[] = ['reported', 'triaged', 'matched', 'assigned', 'completed'];
  const currentStep = steps.indexOf(incident.status);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group">
      {incident.imageUrl && (
        <div className="h-32 w-full overflow-hidden">
          <img src={incident.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        </div>
      )}
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2">
            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter text-white ${incident.triage?.urgency <= 2 ? 'bg-red-500' : 'bg-neutral-700'}`}>
              Level {incident.triage?.urgency || '?'}
            </span>
            <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[10px] font-black uppercase tracking-tighter">
              {incident.triage?.targetGroup || 'General'}
            </span>
          </div>
          {incident.triage?.dispatchType === 'AUTO' && (
            <div className="flex items-center gap-1 text-green-500">
              <Zap size={10} />
              <span className="text-[8px] font-black uppercase">Auto-Assigned</span>
            </div>
          )}
        </div>
        <p className="text-sm text-neutral-300 font-medium line-clamp-2 italic mb-6">"{incident.description || incident.triage?.summary}"</p>
        
        <div className="space-y-3">
          <div className="flex items-center gap-1">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1 flex-1 rounded-full ${idx <= currentStep ? (incident.status === 'completed' ? 'bg-green-400' : 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]') : 'bg-neutral-800'}`} 
              />
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase text-neutral-500 flex justify-between">
            <span>{incident.status}</span>
            <span>{incident.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </p>
        </div>
      </div>
    </div >
  );
}

// VOLUNTEER VIEW
function VolunteerView() {
  const { volunteerId: volId, setVolunteerId } = useContext(AuthContext);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // For demo, we just pick a volunteer if none set
    if (!volId) {
      getDocs(collection(db, 'volunteers')).then(s => {
        // Try to match Alice (Medical) or Bob (Fire) or any volunteer if no ID is linked
        // We avoid hardcoding a single fallback to avoid 'Civil' always being the default
        const found = s.docs[0];
        if (found) setVolunteerId(found.id);
      }).catch(err => handleFirestoreError(err, OperationType.LIST, 'volunteers'));
    }
  }, [volId, setVolunteerId]);

  useEffect(() => {
    if (!volId) return;
    const volRef = doc(db, 'volunteers', volId);
    const unsubVol = onSnapshot(volRef, (d) => {
      if (d.exists()) {
        const data = d.data() as Volunteer;
        const prevTask = volunteer?.currentTask;
        setVolunteer({ id: d.id, ...data } as Volunteer);
        
        // Audio alert for new auto-assignment
        if (data.currentTask && data.currentTask !== prevTask) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {});
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'volunteers'));
    
    const notifQ = query(collection(db, 'notifications'), where('volunteer_id', '==', volId), where('status', '==', 'pending'));
    const unsubNotif = onSnapshot(notifQ, async (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      setNotifications(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));

    return () => { unsubVol(); unsubNotif(); };
  }, [volId]);

  const toggleAvailability = async () => {
    if (!volunteer) return;
    await updateDoc(doc(db, 'volunteers', volId), { isAvailable: !volunteer.isAvailable });
  };

  const handleAction = async (notif: Notification, action: 'accepted' | 'declined') => {
    await updateDoc(doc(db, 'notifications', notif.id), { status: action });
    if (action === 'accepted') {
      // Atomic Update logic
      await updateDoc(doc(db, 'volunteers', volId), { isAvailable: false, currentTask: notif.incident_id });
      await updateDoc(doc(db, 'incidents', notif.incident_id), { status: 'assigned', assigned_vol: volId });
    }
  };

  const completeTask = async () => {
    if (!volunteer?.currentTask) return;
    await updateDoc(doc(db, 'incidents', volunteer.currentTask), { status: 'completed' });
    await updateDoc(doc(db, 'volunteers', volunteer.id), { isAvailable: true, currentTask: null });
  };

  if (!volunteer) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto w-10 h-10" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-neutral-900/50 p-8 rounded-3xl border border-neutral-800">
        <div className="flex items-center gap-6 text-white">
          <div className="w-20 h-20 bg-neutral-800 rounded-2xl flex items-center justify-center text-3xl">👨‍🚒</div>
          <div>
            <h2 className="text-3xl font-bold">{volunteer.name}</h2>
            <div className="flex gap-2 mt-2">
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-black uppercase tracking-widest">{volunteer.group} Sector</span>
              {(volunteer.skills || []).map(s => <span key={s} className="px-2 py-0.5 bg-neutral-700 rounded text-[10px] font-bold uppercase">{s}</span>)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={toggleAvailability}
            className={`px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${volunteer.isAvailable ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}
          >
            {volunteer.isAvailable ? <CheckCircle2 /> : <X />}
            {volunteer.isAvailable ? 'Broadcasting Availability' : 'Offline / Busy'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-500 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Notifications ({notifications.length})
          </h3>
          <AnimatePresence>
            {(notifications || []).map(n => (
              <NotificationCard key={n.id} notification={n} onAction={handleAction} />
            ))}
          </AnimatePresence>
          {notifications.length === 0 && <p className="text-neutral-600 text-sm italic">No pending dispatches.</p>}
        </section>

        <section className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-500">Current Assignment</h3>
          {volunteer.currentTask ? (
            <CurrentTaskCard incidentId={volunteer.currentTask} onComplete={completeTask} />
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 p-12 rounded-3xl text-center text-neutral-600">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm">Standby for AI Dispatch suggestions.</p>
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onAction: (n: Notification, a: 'accepted' | 'declined') => void | Promise<void>;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ notification, onAction }) => {
  const [incident, setIncident] = useState<Incident | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'incidents', notification.incident_id), (d) => {
      if (d.exists()) setIncident({ id: d.id, ...d.data() } as Incident);
    });
    return () => unsub();
  }, [notification.incident_id]);

  if (!incident) return <div className="p-6 bg-neutral-900 rounded-2xl animate-pulse h-32" />;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}
      className="bg-neutral-900 border-2 border-blue-500/30 rounded-2xl overflow-hidden"
    >
      {incident.imageUrl && (
        <div className="h-40 w-full overflow-hidden">
          <img src={incident.imageUrl} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-6">
        <div className="flex justify-between items-center mb-3">
          <p className="text-blue-400 font-black text-[10px] uppercase tracking-widest">Urgent Dispatch Request</p>
          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase text-white ${incident.urgency <= 2 ? 'bg-red-500' : 'bg-neutral-700'}`}>
            Lvl {incident.urgency}
          </span>
        </div>
        
        <p className="text-lg font-bold mb-2 text-white italic">"{incident.description}"</p>
        
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-2 text-neutral-500 text-xs">
            <Shield size={12} /> <span>Sector: {incident.category}</span>
          </div>
          {incident.location && (
            <a 
              href={`https://www.google.com/maps?q=${incident.location.lat},${incident.location.lng}`} 
              target="_blank" rel="noopener noreferrer" 
              className="flex items-center gap-2 text-blue-400 text-xs font-bold hover:underline"
            >
              <MapPin size={12} /> Precise Location Identified
            </a>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => onAction(notification, 'accepted')} className="flex-1 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-neutral-200">Accept Mission</button>
          <button onClick={() => onAction(notification, 'declined')} className="px-6 py-3 bg-neutral-800 text-neutral-500 font-bold text-xs rounded-xl hover:bg-neutral-700">Deny</button>
        </div>
      </div>
    </motion.div>
  );
}

function CurrentTaskCard({ incidentId, onComplete }: { incidentId: string, onComplete: () => void }) {
  const [incident, setIncident] = useState<Incident | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'incidents', incidentId), (d) => {
      if (d.exists()) setIncident({ id: d.id, ...d.data() } as Incident);
    });
    return () => unsub();
  }, [incidentId]);

  if (!incident) return null;

  return (
    <div className="bg-neutral-900 border border-green-500/50 rounded-3xl overflow-hidden">
      {incident.imageUrl && (
        <div className="h-48 w-full overflow-hidden">
          <img src={incident.imageUrl} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-8">
        <p className="text-green-500 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
          <Shield size={12} /> Active Life-Safe Mission
        </p>
        <h4 className="text-xl font-bold mb-4 text-white italic">"{incident.description}"</h4>
        
        {incident.location && (
          <a 
            href={`https://www.google.com/maps?q=${incident.location.lat},${incident.location.lng}`} 
            target="_blank" rel="noopener noreferrer" 
            className="w-full mb-6 py-3 bg-neutral-800 rounded-xl flex items-center justify-center gap-2 text-blue-400 font-bold text-sm"
          >
            <MapPin size={16} /> Open Navigation
          </a>
        )}

        <button onClick={onComplete} className="w-full py-4 border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-black font-black uppercase tracking-widest rounded-2xl transition-all">
          Signal Mission Success
        </button>
      </div>
    </div>
  );
}

// MANAGER VIEW
function ManagerView() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const unsubInc = onSnapshot(collection(db, 'incidents'), 
      (s) => setIncidents(s.docs.map(d => ({ id: d.id, ...d.data() } as Incident))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'incidents')
    );
    const unsubVol = onSnapshot(collection(db, 'volunteers'), 
      (s) => setVolunteers(s.docs.map(d => ({ id: d.id, ...d.data() } as Volunteer))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'volunteers')
    );
    return () => { unsubInc(); unsubVol(); };
  }, []);

  const resetOperationalUnits = async () => {
    setIsResetting(true);
    try {
      if (!window.confirm("ARE YOU SURE? THIS WILL TERMINATE ALL ACTIVE DISPATCHES.")) {
        setIsResetting(false);
        return;
      }
      // Clear incidents
      const incSnap = await getDocs(collection(db, 'incidents'));
      for (const d of incSnap.docs) {
        await deleteDoc(doc(db, 'incidents', d.id));
      }
      // Clear notifications
      const notifSnap = await getDocs(collection(db, 'notifications'));
      for (const d of notifSnap.docs) {
        await deleteDoc(doc(db, 'notifications', d.id));
      }
      // Reset volunteers
      const volSnap = await getDocs(collection(db, 'volunteers'));
      for (const d of volSnap.docs) {
        await updateDoc(doc(db, 'volunteers', d.id), {
          isAvailable: true,
          currentTask: null
        });
      }
      alert("Operational Reset Complete. System Restored to Nominal state.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black text-white tracking-tighter uppercase italic">Mission Control</h2>
          <p className="text-neutral-500 text-sm">Autonomous dispatching active. Real-time operation monitoring.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={resetOperationalUnits}
            disabled={isResetting}
            className="px-6 py-2 bg-red-600/10 border border-red-500/50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
          >
            {isResetting ? <Loader2 className="animate-spin" /> : 'System Reset'}
          </button>
          <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase text-neutral-400">AI Triage Active</span>
          </div>
        </div>
      </div>

      <SectorDirectory />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {['Medical', 'Fire', 'Civil', 'Logistics'].map(group => {
          const groupIncidents = incidents.filter(i => i.triage?.targetGroup === group || i.category === group);
          const highUrgencyCount = groupIncidents.filter(i => i.triage?.urgency <= 2 || i.urgency <= 2).length;
          return (
            <div key={group} className="bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800 hover:border-neutral-700 transition-all">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-white">{group} Node</h4>
                {highUrgencyCount > 0 && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] text-neutral-500 font-bold uppercase">Load</span>
                  <span className="text-2xl font-display font-black text-white">{groupIncidents.length}</span>
                </div>
                <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.min(100, (groupIncidents.length / 10) * 100)}%` }} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-tighter">
                  <div className="text-neutral-500">Response: <span className="text-green-500">Nominal</span></div>
                  <div className="text-neutral-500 text-right">Impact: <span className="text-blue-500">Med</span></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-2">Total Alerts</p>
          <p className="text-4xl font-display font-black text-white">{incidents.length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-2">Responders Active</p>
          <p className="text-4xl font-display font-black text-white">{volunteers.filter(v => v.isAvailable).length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-2">Pending Triage</p>
          <p className="text-4xl font-display font-black text-blue-400">{incidents.filter(i => i.status === 'reported').length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-2">Resolution Rate</p>
          <p className="text-4xl font-display font-black text-green-400">{Math.round((incidents.filter(i => i.status === 'completed').length / (incidents.length || 1)) * 100)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 overflow-hidden bg-neutral-900 border border-neutral-800 rounded-3xl">
          <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-300">Live Mission Log</h3>
            <button className="text-[10px] font-black uppercase text-neutral-500 hover:text-white transition-colors">Export Telemetry</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-neutral-500 text-[10px] font-bold uppercase border-b border-neutral-800">
                  <th className="p-6">Time</th>
                  <th className="p-6">Reporter ID</th>
                  <th className="p-6">Incident Summary</th>
                  <th className="p-6">Sector</th>
                  <th className="p-6">Urgency</th>
                  <th className="p-6">Status/Assignment</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {(incidents || []).map(inc => (
                  <tr key={inc.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors text-white group">
                    <td className="p-6 text-neutral-500 font-mono text-xs">
                      {inc.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-6">
                      <span className="font-mono text-[10px] text-neutral-400 bg-neutral-800 px-2 py-1 rounded">
                        {inc.reporterId}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          {inc.imageUrl && <div className="w-8 h-8 rounded bg-neutral-800 overflow-hidden"><img src={inc.imageUrl} className="w-full h-full object-cover" /></div>}
                          <span className="font-medium max-w-md truncate italic text-neutral-300 group-hover:text-white transition-colors">"{inc.description}"</span>
                        </div>
                        {inc.location && (
                          <a 
                            href={`https://www.google.com/maps?q=${inc.location.lat},${inc.location.lng}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <MapPin size={8} /> View Location ({inc.location.lat.toFixed(4)}, {inc.location.lng.toFixed(4)})
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-6 font-bold text-blue-400">{inc.triage?.targetGroup || inc.category}</td>
                    <td className="p-6">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${inc.triage?.urgency <= 2 ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-neutral-800 text-neutral-400'}`}>Lvl {inc.triage?.urgency || inc.urgency}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${inc.status === 'completed' ? 'bg-green-400' : 'bg-blue-400 animate-pulse'}`} />
                          <span className="uppercase text-[10px] font-black tracking-widest text-white">
                            {inc.status}
                          </span>
                        </div>
                        {inc.assigned_vol && (
                          <span className="text-[9px] text-neutral-500 uppercase font-black tracking-tighter">
                            Unit: {volunteers.find(v => v.id === inc.assigned_vol)?.name || 'DISPATCHED'}
                          </span>
                        )}
                        {inc.manager_analysis && (
                          <span className="text-[8px] text-blue-500/80 font-black uppercase tracking-widest">
                            Impact: {inc.manager_analysis.resource_impact}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden mt-8">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-300">Responder Fleet Status</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(volunteers || []).map(vol => (
            <div key={vol.id} className="bg-black/40 border border-neutral-800 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-black text-white uppercase">{vol.name}</p>
                  <p className="text-[9px] text-neutral-500 font-bold tracking-tighter">{vol.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                  vol.group === 'Medical' ? 'bg-red-500/20 text-red-500' : 
                  vol.group === 'Fire' ? 'bg-orange-500/20 text-orange-500' : 
                  vol.group === 'Logistics' ? 'bg-blue-500/20 text-blue-500' : 
                  'bg-green-500/20 text-green-500'
                }`}>
                  {vol.group}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {vol.skills.map((s, idx) => (
                  <span key={idx} className="text-[8px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded uppercase font-black">{s}</span>
                ))}
              </div>
              <div className="mt-auto pt-3 border-t border-neutral-800/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${vol.isAvailable ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
                  <span className="text-[9px] font-black uppercase text-neutral-500">{vol.isAvailable ? 'Ready' : 'Engaged'}</span>
                </div>
                {vol.currentTask && <span className="text-[8px] font-black uppercase text-blue-400">On Mission</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
