// Cole este código completo no seu arquivo App.js
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDocs, writeBatch, query, orderBy } from 'firebase/firestore';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// --- Registro dos Módulos do Chart.js ---
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// --- Configuração do Firebase ---
// A configuração será lida das Variáveis de Ambiente na Vercel
const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG || '{}');
const appId = 'dashboard-financeiro-prod'; // ID fixo para produção

// --- Componentes de UI ---
const Card = ({ children, className = '' }) => <div className={`bg-white rounded-2xl shadow-lg p-4 sm:p-6 ${className}`}>{children}</div>;
const Spinner = ({text = 'Carregando...'}) => <div className="flex flex-col justify-center items-center p-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div><p className="text-gray-600">{text}</p></div>;
const KpiCard = ({ title, value, color }) => ( <Card className="text-center"><div className={`text-3xl font-bold ${color}`}>{value}</div><div className="text-gray-500 font-medium mt-1">{title}</div></Card> );
const RevenueExpenseChart = ({ data }) => { const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Receitas vs. Despesas Mensais', font: { size: 16 } } }, scales: { y: { beginAtZero: true } }, }; return <div style={{height: '350px'}}><Bar options={options} data={data} /></div>; };
const CategoryPieChart = ({ data }) => { const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Receitas por Categoria', font: { size: 16 } } }, }; return <div style={{height: '350px'}}><Pie data={data} options={options} /></div>; };

// --- Componente Principal ---
export default function App() {
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        try {
            if (!firebaseConfig.apiKey) {
                setError("Configuração do Firebase não encontrada. Verifique as variáveis de ambiente.");
                setIsAuthReady(true);
                return;
            }
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const firestoreInstance = getFirestore(app);
            setAuth(authInstance);
            setDb(firestoreInstance);
            onAuthStateChanged(authInstance, (user) => {
                setUser(user);
                setIsAuthReady(true);
            });
        } catch (e) { 
            console.error("Erro ao inicializar Firebase:", e);
            setError("Falha na configuração do Firebase.");
            setIsAuthReady(true);
        }
    }, []);

    if (!isAuthReady) return <div className="bg-gray-100 min-h-screen flex items-center justify-center"><Spinner /></div>;
    if (error) return <div className="bg-red-100 text-red-700 p-5 text-center min-h-screen flex items-center justify-center"><strong>Erro:</strong> {error}</div>;
    
    return user ? <FinancialDashboard db={db} auth={auth} userId={user.uid} /> : <LoginScreen auth={auth} />;
}

// --- Tela de Login ---
const LoginScreen = ({ auth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError('Email ou senha inválidos.');
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                <h2 className="text-2xl font-bold text-center mb-6">Acesso ao Dashboard</h2>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"/></div>
                    <div><label>Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"/></div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">{isLoading ? 'Entrando...' : 'Entrar'}</button>
                </form>
            </Card>
        </div>
    );
};

// --- Dashboard Financeiro ---
const FinancialDashboard = ({ db, auth, userId }) => {
    // (O restante do código do Dashboard continua aqui, sem alterações)
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showManualForm, setShowManualForm] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [filter, setFilter] = useState('this_year');

    const fetchData = async () => { if (!db || !userId) return; setIsLoading(true); try { const collectionPath = `artifacts/${appId}/users/${userId}/transactions`; const q = query(collection(db, collectionPath), orderBy("date", "desc")); const snap = await getDocs(q); setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))); } catch (err) { console.error(err); setError('Falha ao carregar transações.'); } finally { setIsLoading(false); } };
    useEffect(() => { fetchData(); }, [db, userId]);

    const dashboardData = useMemo(() => {
        const now = new Date();
        const filtered = transactions.filter(t => { if (!t.date || typeof t.date.toDate !== 'function') return false; const date = t.date.toDate(); if (filter === 'this_year') return date.getFullYear() === now.getFullYear(); if (filter === 'this_month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); return true; });
        const totalRevenue = filtered.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.value, 0);
        const totalExpense = filtered.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.value, 0);
        const balance = totalRevenue - totalExpense;
        const monthlyData = {}; const yearToFilter = now.getFullYear(); for(let i=0; i<12; i++) { const monthName = new Date(yearToFilter, i).toLocaleString('pt-BR', {month: 'short'}); monthlyData[monthName] = { revenue: 0, expense: 0 }; }
        filtered.forEach(t => { const date = t.date.toDate(); if(date.getFullYear() === yearToFilter) { const monthName = date.toLocaleString('pt-BR', {month: 'short'}); if(monthlyData[monthName]) { if(t.type === 'receita') monthlyData[monthName].revenue += t.value; else monthlyData[monthName].expense += t.value; } } });
        const barChartData = { labels: Object.keys(monthlyData), datasets: [{ label: 'Receita', data: Object.values(monthlyData).map(m => m.revenue), backgroundColor: 'rgba(52, 211, 153, 0.7)' }, { label: 'Despesa', data: Object.values(monthlyData).map(m => m.expense), backgroundColor: 'rgba(239, 68, 68, 0.7)' }] };
        const categoryData = { labels: [], datasets: [{ data: [], backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#f59e0b'] }] };
        const categoryRevenue = filtered.filter(t => t.type === 'receita').reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.value; return acc; }, {});
        categoryData.labels = Object.keys(categoryRevenue); categoryData.datasets[0].data = Object.values(categoryRevenue);
        return { transactions: filtered, totalRevenue, totalExpense, balance, barChartData, categoryData };
    }, [transactions, filter]);

    const handleAddTransaction = async (newTx) => { if (!db || !userId) return; try { const collectionPath = `artifacts/${appId}/users/${userId}/transactions`; await addDoc(collection(db, collectionPath), newTx); setSuccess('Lançamento manual salvo com sucesso!'); fetchData(); setShowManualForm(false); } catch (err) { console.error(err); setError("Falha ao salvar lançamento manual."); } };
    const handleBatchUpload = async (newTransactions) => { if (!db || !userId || newTransactions.length === 0) return; const batch = writeBatch(db); const collectionPath = `artifacts/${appId}/users/${userId}/transactions`; newTransactions.forEach(tx => { const newDocRef = doc(collection(db, collectionPath)); batch.set(newDocRef, tx); }); try { await batch.commit(); setSuccess(`${newTransactions.length} lançamentos importados com sucesso!`); fetchData(); setShowUploadForm(false); } catch (err) { console.error(err); setError("Falha ao importar o arquivo .csv."); } };
    useEffect(() => { if (success || error) { const timer = setTimeout(() => { setSuccess(''); setError(''); }, 5000); return () => clearTimeout(timer); } }, [success, error]);

    if (isLoading) return <div className="bg-gray-100 min-h-screen"><Spinner /></div>;

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-wrap justify-between items-center mb-8 gap-4">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Dashboard Financeiro</h1>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <select value={filter} onChange={e => setFilter(e.target.value)} className="p-2 border-gray-300 rounded-lg shadow-sm"> <option value="this_year">Este Ano</option> <option value="this_month">Este Mês</option> </select>
                        <button onClick={() => setShowManualForm(true)} className="bg-white border border-blue-600 text-blue-600 font-bold py-2 px-3 sm:px-5 rounded-lg hover:bg-blue-50 transition">Lançar</button>
                        <button onClick={() => setShowUploadForm(true)} className="bg-blue-600 text-white font-bold py-2 px-3 sm:px-5 rounded-lg hover:bg-blue-700 transition shadow-md">Importar .csv</button>
                        <button onClick={() => signOut(auth)} className="bg-red-500 text-white font-bold py-2 px-3 sm:px-5 rounded-lg hover:bg-red-600 transition">Sair</button>
                    </div>
                </header>
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">{error}</p>}
                {success && <p className="bg-green-100 text-green-700 p-3 rounded-lg mb-4">{success}</p>}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KpiCard title="Receita Total" value={dashboardData.totalRevenue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} color="text-green-600" />
                    <KpiCard title="Despesa Total" value={dashboardData.totalExpense.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} color="text-red-600" />
                    <KpiCard title="Saldo" value={dashboardData.balance.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} color="text-blue-600" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8"> <Card className="lg:col-span-3"><RevenueExpenseChart data={dashboardData.barChartData} /></Card> <Card className="lg:col-span-2"><CategoryPieChart data={dashboardData.categoryData} /></Card> </div>
                <Card>
                    <h3 className="font-bold text-lg text-gray-800 mb-4">Últimos Lançamentos</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Descrição</th><th className="px-6 py-3">Categoria</th><th className="px-6 py-3">Valor</th><th className="px-6 py-3">Arquivo</th></tr></thead>
                            <tbody>
                                {dashboardData.transactions.length > 0 ? dashboardData.transactions.slice(0, 10).map(tx => (
                                    <tr key={tx.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4">{tx.date.toDate().toLocaleDateString('pt-BR')}</td>
                                        <td className="px-6 py-4 text-gray-900 font-medium">{tx.description}</td>
                                        <td className="px-6 py-4">{tx.category}</td>
                                        <td className={`px-6 py-4 font-bold ${tx.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{tx.value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                                        <td className="px-6 py-4"><a href="#" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline">{tx.fileName || 'N/A'}</a></td>
                                    </tr>
                                )) : <tr><td colSpan="5" className="text-center py-10 text-gray-500">Nenhum lançamento encontrado.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
            {showManualForm && <DataInputForm onClose={() => setShowManualForm(false)} onSave={handleAddTransaction} />}
            {showUploadForm && <CsvUploadForm onClose={() => setShowUploadForm(false)} onUpload={handleBatchUpload} />}
        </div>
    );
};

// --- Formulários (Modais) ---
const DataInputForm = ({ onClose, onSave }) => {
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], type: 'receita', category: '', value: '', paymentMethod: 'PIX', description: '', file: null });
    const handleChange = (e) => { const { name, value, type, files } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'file' ? files[0] : value })); };
    const handleSubmit = (e) => { e.preventDefault(); const finalData = { ...formData, value: parseFloat(formData.value), date: new Date(formData.date + 'T00:00:00'), fileName: formData.file ? formData.file.name : null }; delete finalData.file; onSave(finalData); };
    return ( <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><Card className="w-full max-w-lg"> <h2 className="text-2xl font-bold mb-6">Novo Lançamento Manual</h2> <form onSubmit={handleSubmit} className="space-y-4"> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <div><label className="block text-sm font-medium">Data*</label><input type="date" name="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"/></div> <div><label className="block text-sm font-medium">Tipo*</label><select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"><option value="receita">Receita</option><option value="despesa">Despesa</option></select></div> </div> <div><label className="block text-sm font-medium">Categoria*</label><input type="text" name="category" value={formData.category} onChange={handleChange} placeholder="Ex: Dízimo, Aluguel" required className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"/></div> <div><label className="block text-sm font-medium">Valor (R$)*</label><input type="number" step="0.01" name="value" value={formData.value} onChange={handleChange} placeholder="150.00" required className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"/></div> <div><label className="block text-sm font-medium">Descrição</label><input type="text" name="description" value={formData.description} onChange={handleChange} placeholder="Descrição do lançamento" className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"/></div> <div><label className="block text-sm font-medium">Anexar Comprovante</label><input type="file" name="file" onChange={handleChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></div> <div className="flex justify-end gap-4 pt-4"> <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancelar</button> <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Salvar</button> </div> </form> </Card></div> );
};
const CsvUploadForm = ({ onClose, onUpload }) => {
    const [file, setFile] = useState(null); const [type, setType] = useState('receita'); const [error, setError] = useState(''); const [isProcessing, setIsProcessing] = useState(false);
    const handleFileChange = (e) => { setError(''); const selectedFile = e.target.files[0]; if (selectedFile && !selectedFile.name.endsWith('.csv')) { setError('Formato de arquivo inválido. Por favor, selecione um arquivo .csv'); setFile(null); } else { setFile(selectedFile); } };
    const handleProcessFile = () => { if (!file) { setError('Por favor, selecione um arquivo para importar.'); return; } setIsProcessing(true); const reader = new FileReader(); reader.onload = (e) => { const text = e.target.result; const lines = text.split('\n').filter(line => line.trim() !== ''); let headerLine = lines.shift() || ''; const header = headerLine.replace(/\r$/, '').replace(/^\uFEFF/, '').split(';').map(h => h.trim().replace(/"/g, '')); const requiredHeaders = ['data_lançamento', 'Categoria', 'Valor em R$']; const headerIsValid = requiredHeaders.every(h => header.includes(h)); if (!headerIsValid) { const foundHeaders = header.join('; '); setError(`Cabeçalho inválido. Esperado: "${requiredHeaders.join('; ')}". Encontrado: "${foundHeaders}".`); setIsProcessing(false); return; } const transactions = []; for (const line of lines) { if (!line.trim()) continue; const values = line.trim().split(';').map(v => v.trim().replace(/"/g, '')); const row = header.reduce((obj, h, i) => ({ ...obj, [h]: values[i] || '' }), {}); if (!row['data_lançamento'] || !row['Categoria'] || !row['Valor em R$']) { console.warn('Linha ignorada:', line); continue; } const dateParts = row['data_lançamento'].split('/'); if (dateParts.length !== 3) { console.warn('Data inválida (use DD/MM/AAAA):', line); continue; } const date = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]); if (isNaN(date.getTime())) { console.warn('Data inválida:', line); continue; } const value = parseFloat(row['Valor em R$'].replace('R$', '').replace(/\./g, '').replace(',', '.').trim()); if (isNaN(value)) { console.warn('Valor inválido:', line); continue; } transactions.push({ date: date, type: type, category: row['Categoria'], value: value, description: row['descrição'] || `Importado via CSV`, fileName: null, paymentMethod: 'CSV Import' }); } if (transactions.length === 0) { setError('Nenhum lançamento válido encontrado no arquivo.'); setIsProcessing(false); return; } onUpload(transactions); }; reader.onerror = () => { setError('Falha ao ler o arquivo.'); setIsProcessing(false); }; reader.readAsText(file, 'UTF-8'); };
    return ( <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><Card className="w-full max-w-lg"> <h2 className="text-2xl font-bold mb-6">Importar Lançamentos via .csv</h2> <div className="space-y-4"> <div> <label className="block text-sm font-medium">1. Tipo de Lançamento no Arquivo*</label> <div className="flex gap-4 mt-1"> <label className="flex items-center"><input type="radio" name="type" value="receita" checked={type === 'receita'} onChange={(e) => setType(e.target.value)} className="mr-2"/>Receita</label> <label className="flex items-center"><input type="radio" name="type" value="despesa" checked={type === 'despesa'} onChange={(e) => setType(e.target.value)} className="mr-2"/>Despesa</label> </div> </div> <div> <label className="block text-sm font-medium">2. Selecione o Arquivo .csv*</label> <p className="text-xs text-gray-500 mb-1">Cabeçalhos: data_lançamento;Categoria;Valor em R$;descrição</p> <input type="file" accept=".csv" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/> </div> {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>} {isProcessing && <Spinner text="Processando arquivo..."/>} </div> <div className="flex justify-end gap-4 pt-6"> <button type="button" onClick={onClose} disabled={isProcessing} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50">Cancelar</button> <button type="button" onClick={handleProcessFile} disabled={isProcessing || !file} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Importar</button> </div> </Card></div> );
};
