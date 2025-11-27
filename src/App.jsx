import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, writeBatch, doc, getDocs, limit } from 'firebase/firestore';
import { Shield, Users, Cloud, LogOut, MessageSquare, Search, Lock, RefreshCw, Database, Settings, Link as LinkIcon, Check, AlertTriangle, PlayCircle, List, FileSpreadsheet, UploadCloud, Sparkles, Bot, X } from 'lucide-react';

// --- COMPONENTE DE PANTALLA DE ERROR (DIAGNÓSTICO) ---
function ErrorDisplay({ message, details }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-lg w-full">
        <AlertTriangle size={64} className="text-red-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-red-800 mb-2">¡Detectamos el problema!</h1>
        <p className="text-slate-600 mb-6">La aplicación no pudo iniciar por la siguiente razón:</p>
        
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-left mb-6">
          <p className="font-bold text-red-700 text-xs uppercase tracking-wider mb-1">Error Técnico:</p>
          <code className="text-sm text-red-900 font-mono break-words">{message}</code>
        </div>

        {details && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-left">
            <p className="font-bold text-blue-700 text-xs uppercase tracking-wider mb-1">¿Cómo arreglarlo?</p>
            <p className="text-sm text-blue-900">{details}</p>
          </div>
        )}

        <button 
          onClick={() => window.location.reload()} 
          className="mt-8 w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
        >
          Intentar Recargar
        </button>
      </div>
    </div>
  );
}

// --- CONFIGURACIÓN INTELIGENTE ---
const getFirebaseConfig = () => {
  try {
    // Verificamos si import.meta existe antes de usarlo
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    
    // Si estamos en el chat (Preview), usamos la config inyectada
    if (typeof __firebase_config !== 'undefined') {
      return JSON.parse(__firebase_config);
    }

    // Si estamos en Vercel, usamos las variables de entorno
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID
    };
  } catch (e) {
    return {};
  }
};

const getGeminiKey = () => {
  try {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    return env.VITE_GEMINI_API_KEY || "";
  } catch (e) {
    return "";
  }
};

// Inicializar Variables
const firebaseConfig = getFirebaseConfig();
const geminiApiKey = getGeminiKey();

let app, auth, db;
let initError = null;

try {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    // Esperamos a la validación en el componente
  } else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Error inicializando Firebase:", e);
  initError = e;
}

// Funciones Auxiliares
async function callGemini(prompt) {
  if (!geminiApiKey) return "Error: Falta API Key de Gemini en Vercel.";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Error IA";
  } catch (error) { return "Error conexión IA"; }
}

function parseCSV(text) {
  const arr = []; let quote = false; let col = 0, c = 0; let row = [''];
  for (c = 0; c < text.length; c++) {
    let cc = text[c], nc = text[c+1];
    arr[col] = arr[col] || [];
    if (cc === '"') { if (quote && nc === '"') { row[col] += '"'; ++c; } else { quote = !quote; } } 
    else if (cc === ',' && !quote) { col++; row[col] = ''; } 
    else if ((cc === '\r' || cc === '\n') && !quote) { if (cc === '\r' && nc === '\n') ++c; if (row.length > 1 || row[0].length > 0) arr.push(row); row = ['']; col = 0; } 
    else { row[col] += cc; }
  }
  if (row.length > 1 || row[0].length > 0) arr.push(row);
  return arr;
}

// --- COMPONENTE PRINCIPAL ---
export default function SalesMasterCloud() {
  // 1. Chequeo de Inicialización
  if (initError) {
    return <ErrorDisplay message={initError.message} details="Error crítico al conectar con Firebase. Revisa la consola." />;
  }
  
  // 2. Chequeo de Configuración Faltante
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    return <ErrorDisplay 
      message="Faltan las Variables de Entorno" 
      details="No se encontraron las llaves API. Ve a Vercel -> Settings -> Environment Variables y asegúrate de haber agregado las 7 claves (VITE_FIREBASE_API_KEY, etc.) y de haber hecho un Redeploy." 
    />;
  }

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [vendorName, setVendorName] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [runtimeError, setRuntimeError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      if (!auth) return;
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error Auth:", error);
        setRuntimeError(error);
      } finally {
        setIsAuthenticating(false);
      }
    };
    initAuth();
    if (auth) return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // 3. Chequeo de Error en Ejecución (Auth)
  if (runtimeError) {
    return <ErrorDisplay 
      message={runtimeError.message} 
      details="Falló la autenticación. Ve a Firebase Console -> Compilación -> Authentication -> Sign-in method y habilita el proveedor 'Anónimo'." 
    />;
  }
  
  if (isAuthenticating) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-blue-600 gap-4">
        <RefreshCw className="animate-spin" size={48}/>
        <p className="font-bold animate-pulse text-slate-500">Conectando con la nube...</p>
      </div>
    );
  }
  
  if (!role) return <LoginScreen onLogin={(r, name) => { setRole(r); setVendorName(name); }} />;

  return role === 'admin' ? <AdminDashboard user={user} /> : <VendorDashboard user={user} myName={vendorName} />;
}

// --- PANTALLAS DE LA APP ---

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('menu'); 
  const [inputVal, setInputVal] = useState('');
  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-2xl text-center border border-slate-700">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white"><Cloud size={32} /></div>
          <h1 className="text-2xl font-bold text-white mb-2">SalesMaster Cloud</h1>
          <p className="text-slate-400 mb-8">Gestión Inteligente de Cobranza.</p>
          <div className="space-y-4">
            <button onClick={() => setMode('admin')} className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all"><Shield size={20} /> Soy el Administrador</button>
            <button onClick={() => setMode('vendor')} className="w-full bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all"><Users size={20} /> Soy Vendedor</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
        <button onClick={() => setMode('menu')} className="text-slate-500 hover:text-white mb-4 text-sm">← Volver</button>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">{mode === 'admin' ? 'Acceso Admin' : 'Acceso Vendedor'}</h2>
        <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder={mode === 'admin' ? "Contraseña..." : "Ej: Juan Perez"} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mb-4 outline-none" />
        <button onClick={() => {
            if (mode === 'admin') { if (inputVal === 'admin' || inputVal === 'admin123') onLogin('admin', 'Master'); else alert("Contraseña incorrecta"); } 
            else { if (inputVal.trim().length > 1) onLogin('vendor', inputVal.trim()); else alert("Escribe un nombre válido"); }
          }} className="w-full p-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500">Entrar</button>
      </div>
    </div>
  );
}

function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('view');
  const [syncing, setSyncing] = useState(false);
  const [dbCount, setDbCount] = useState(0);
  const [progress, setProgress] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [uploadStep, setUploadStep] = useState(1);
  const [rawFileRows, setRawFileRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [fileName, setFileName] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sales_master'));
    return onSnapshot(q, (snap) => { setDbCount(snap.size); if (snap.size > 0 && previewData.length === 0) fetchPreview(); });
  }, [user]);

  const fetchPreview = async () => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sales_master'), limit(50));
    const snap = await getDocs(q);
    setPreviewData(snap.docs.map(d => d.data()));
  };

  useEffect(() => { if (activeTab === 'view') fetchPreview(); }, [activeTab]);

  const runAiAnalysis = async () => {
    if (previewData.length === 0) return alert("No hay datos.");
    setAnalyzing(true);
    const result = await callGemini(`Analiza estos datos de ventas (JSON): ${JSON.stringify(previewData.slice(0, 30))}. Dame un reporte ejecutivo corto.`);
    setAiAnalysis(result);
    setAnalyzing(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      let rows = [];
      if (text.includes('\t')) rows = text.trim().split('\n').map(l => l.split('\t'));
      else rows = parseCSV(text);
      if (rows.length > 0) {
        setRawFileRows(rows);
        const initialMap = {};
        rows[0].forEach((header, index) => {
            const h = header.toLowerCase().trim();
            if (h.includes('cliente')) initialMap[index] = 'Cliente';
            else if (h.includes('vendedor')) initialMap[index] = 'Vendedor';
            else if (h.includes('monto')) initialMap[index] = 'Monto';
            else if (h.includes('estatus')) initialMap[index] = 'Estatus';
            else if (h.includes('tel')) initialMap[index] = 'Telefono';
            else initialMap[index] = 'Ignorar';
        });
        setColumnMapping(initialMap);
        setUploadStep(2);
      }
    };
    reader.readAsText(file);
  };

  const executeUpload = async () => {
    if (!confirm("¿Confirmar?")) return;
    setUploadStep(3); setSyncing(true); setProgress('Iniciando...');
    try {
        setProgress('Limpiando...');
        const snapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sales_master'));
        const chunks = []; snapshot.docs.forEach(d => chunks.push(d));
        while(chunks.length) { const batch = writeBatch(db); chunks.splice(0, 400).forEach(doc => batch.delete(doc.ref)); await batch.commit(); }

        const validRows = rawFileRows.slice(1);
        const processedRows = [];
        validRows.forEach(row => {
            const docData = {}; let hasData = false;
            row.forEach((cellVal, index) => {
                const fieldName = columnMapping[index];
                if (fieldName && fieldName !== 'Ignorar') {
                    docData[fieldName] = cellVal?.trim() || ''; hasData = true;
                    if (fieldName === 'Vendedor') docData['normalized_vendor'] = cellVal?.trim().toLowerCase();
                }
            });
            if (hasData) processedRows.push(docData);
        });

        const insertChunks = [];
        for (let i = 0; i < processedRows.length; i += 300) insertChunks.push(processedRows.slice(i, i + 300));
        let inserted = 0;
        for (const chunk of insertChunks) {
            const batch = writeBatch(db);
            chunk.forEach(data => { const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'sales_master')); batch.set(ref, data); });
            await batch.commit(); inserted += chunk.length; setProgress(`Subiendo: ${inserted}...`);
            await new Promise(r => setTimeout(r, 100));
        }
        alert("¡Listo!"); setUploadStep(1); fetchPreview(); setActiveTab('view');
    } catch (e) { alert("Error: " + e.message); setUploadStep(2); }
    setSyncing(false);
  };

  const FIELDS = ['Ignorar', 'Cliente', 'Vendedor', 'Monto', 'Estatus', 'Telefono', 'Fecha', 'Nota'];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Shield className="text-blue-600"/> Admin Panel</h1>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button onClick={() => setActiveTab('view')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'view' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><List size={18}/> Base</button>
            <button onClick={() => setActiveTab('upload')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'upload' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><Cloud size={18}/> Carga</button>
          </div>
          <div className="flex items-center gap-4"><span className="text-xs bg-slate-200 px-3 py-1 rounded-full text-slate-600">Total: <b>{dbCount}</b></span><button onClick={() => window.location.reload()} className="text-slate-400 hover:text-red-500"><LogOut size={20}/></button></div>
        </div>

        {activeTab === 'upload' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                {uploadStep === 1 && (
                    <div className="text-center py-10">
                        <div className="mb-4 bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-blue-600"><FileSpreadsheet size={40} /></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Sube tu archivo CSV</h3>
                        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold inline-flex items-center gap-2"><UploadCloud size={20}/> Seleccionar Archivo<input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" /></label>
                    </div>
                )}
                {uploadStep === 2 && (
                    <div>
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-slate-800">Verifica tus columnas</h3><button onClick={executeUpload} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Check size={18}/> Confirmar</button></div>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm">
                                <thead><tr className="bg-slate-100">{rawFileRows[0].map((header, index) => (<th key={index} className="p-2 min-w-[150px]"><select value={columnMapping[index] || 'Ignorar'} onChange={(e) => setColumnMapping({...columnMapping, [index]: e.target.value})} className="w-full p-2 rounded border border-slate-300 font-bold text-blue-700">{FIELDS.map(f => <option key={f} value={f}>{f}</option>)}</select><div className="mt-1 text-xs text-slate-500 truncate">{header}</div></th>))}</tr></thead>
                                <tbody className="divide-y divide-slate-100">{rawFileRows.slice(1, 6).map((row, rIdx) => (<tr key={rIdx}>{row.map((cell, cIdx) => <td key={cIdx} className="p-3 text-slate-600 truncate max-w-[150px]">{cell}</td>)}</tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                )}
                {uploadStep === 3 && <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-blue-600 mb-4" size={48}/><h3 className="text-xl font-bold text-slate-800">Sincronizando...</h3><p className="text-slate-500 mt-2">{progress}</p></div>}
            </div>
        )}

        {activeTab === 'view' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Database size={20}/> Datos en Nube</h3>
                    <div className="flex gap-2"><button onClick={runAiAnalysis} disabled={analyzing} className="text-sm bg-violet-100 text-violet-700 px-4 py-2 rounded-lg flex items-center gap-2 font-bold">{analyzing ? <RefreshCw className="animate-spin"/> : <Sparkles/>} Analizar IA</button><button onClick={fetchPreview} className="text-xs text-blue-600 border border-blue-100 px-3 py-1 rounded-lg">Refrescar</button></div>
                </div>
                {aiAnalysis && <div className="mb-6 bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm text-violet-800 whitespace-pre-wrap">{aiAnalysis}</div>}
                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr>{previewData.length > 0 && Object.keys(previewData[0]).filter(k=>k!=='normalized_vendor').map(k=><th key={k} className="p-3">{k}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{previewData.map((r,i) => <tr key={i}>{Object.keys(r).filter(k=>k!=='normalized_vendor').map(k=><td key={k} className="p-3">{r[k]}</td>)}</tr>)}</tbody></table></div>
            </div>
        )}
      </div>
    </div>
  );
}

function VendorDashboard({ user, myName }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [videoLink, setVideoLink] = useState('https://youtu.be/tu-video-aqui');
  const [messageTemplate, setMessageTemplate] = useState("Hola *{Cliente}*, saldo: *${Monto}*. Video: {Video}");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [aiMsg, setAiMsg] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user || !myName) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sales_master'));
    return onSnapshot(q, (snap) => {
      const all = snapshot.docs.map(doc => doc.data());
      const mine = all.filter(i => i['normalized_vendor']?.includes(myName.toLowerCase()));
      setData(mine); setLoading(false);
    });
  }, [user, myName]);

  const filtered = data.filter(i => JSON.stringify(i).toLowerCase().includes(searchTerm.toLowerCase()));

  const openAi = async (client) => {
      setSelectedClient(client); setAiModalOpen(true); setGenerating(true);
      const txt = await callGemini(`Escribe WhatsApp para ${client['Cliente']}. Debe ${client['Monto']}. Estatus: ${client['Estatus']}. Soy ${myName}. Link: ${videoLink}.`);
      setAiMsg(txt); setGenerating(false);
  };

  const sendWa = (text, client) => {
      let ph = client['Telefono']?.replace(/\D/g,'');
      if(ph?.length===10) ph='52'+ph;
      if(!ph) return alert("Sin teléfono");
      window.open(`https://wa.me/${ph}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 font-sans">
       <nav className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm">
          <h1 className="font-bold text-slate-800">Hola, <span className="text-green-600">{myName}</span></h1>
          <div className="flex gap-2"><button onClick={()=>setShowConfig(!showConfig)} className="p-2 bg-slate-100 rounded-full"><Settings size={18}/></button><button onClick={()=>window.location.reload()} className="p-2 bg-red-50 text-red-500 rounded-full"><LogOut size={18}/></button></div>
       </nav>
       {showConfig && <div className="bg-white p-4 rounded-xl shadow-lg mb-4 border border-green-100"><h3 className="font-bold text-sm mb-2">Plantilla Fija</h3><input value={videoLink} onChange={e=>setVideoLink(e.target.value)} className="w-full p-2 border rounded mb-2 text-xs"/><textarea value={messageTemplate} onChange={e=>setMessageTemplate(e.target.value)} className="w-full p-2 border rounded text-xs h-20"/></div>}
       {aiModalOpen && <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><div className="bg-white p-6 rounded-xl w-full max-w-md"><h3 className="font-bold flex gap-2 mb-4"><Sparkles className="text-violet-500"/> IA</h3>{generating ? <div className="py-10 text-center"><RefreshCw className="animate-spin mx-auto"/></div> : <textarea value={aiMsg} onChange={e=>setAiMsg(e.target.value)} className="w-full h-32 p-3 border rounded-lg text-sm mb-4"/>}<div className="flex gap-2"><button onClick={()=>setAiModalOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-lg">Cerrar</button><button onClick={()=>sendWa(aiMsg, selectedClient)} disabled={generating} className="flex-1 py-2 bg-green-600 text-white rounded-lg">Enviar</button></div></div></div>}
       <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full p-3 rounded-xl border border-slate-200 mb-4"/>
       {loading ? <div className="text-center opacity-50 mt-10">Cargando...</div> : <div className="grid gap-4 md:grid-cols-2">{filtered.map((c, i) => (<div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><div className="flex justify-between mb-2"><h3 className="font-bold">{c['Cliente']}</h3><span className="font-mono text-slate-600">${c['Monto']}</span></div><div className="badge bg-slate-100 text-xs px-2 py-1 rounded text-slate-500 inline-block mb-4">{c['Estatus']}</div><div className="grid grid-cols-2 gap-2"><button onClick={()=>{ let msg = messageTemplate.replace('{Cliente}', c['Cliente']).replace('{Monto}', c['Monto']).replace('{Video}', videoLink); sendWa(msg, c); }} className="bg-green-100 text-green-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><MessageSquare size={14}/> Plantilla</button><button onClick={()=>openAi(c)} className="bg-violet-100 text-violet-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Sparkles size={14}/> IA</button></div></div>))}</div>}
    </div>
  );
}
