import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Wrench, 
  CheckCircle2, 
  Clock, 
  History, 
  AlertCircle, 
  User, 
  PlusCircle, 
  X,
  MessageSquarePlus,
  ArrowRight,
  MapPin,
  Settings2,
  Plus,
  LogOut,
  LogIn,
  Trash2,
  Loader2,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Machine, Status } from './types';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import * as machineService from './services/machineService';

// --- Components ---

const Badge = ({ status }: { status: Status }) => {
  const styles = {
    normal: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending: 'bg-red-100 text-red-700 border-red-200',
    fault: 'bg-red-100 text-red-700 border-red-200', // Added fault for mapping
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  };

  const labels = {
    normal: '正常运行',
    pending: '待维修',
    fault: '待维修',
    in_progress: '维修中',
    completed: '已完成',
  };

  const s = (status === 'fault' ? 'pending' : status) as keyof typeof styles;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${styles[s]}`}>
      {labels[s]}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [password, setPassword] = useState('');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [workerName, setWorkerName] = useState(() => localStorage.getItem('workerName') || '张工');
  
  // Modal states
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [modalType, setModalType] = useState<'report' | 'start' | 'complete' | 'history' | 'add' | 'edit' | 'edit_person' | null>(null);

  // Form states
  const [selectedFaults, setSelectedFaults] = useState<string[]>([]);
  const [customFault, setCustomFault] = useState('');
  const [repairContent, setRepairContent] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');
  const [newMachineId, setNewMachineId] = useState('');
  const [newCommunity, setNewCommunity] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const faultOptions = [
    'PP滤芯更换',
    '机器不出水',
    '漏水',
    '水质异常',
    '机器异响',
    '其他'
  ];

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u && localStorage.getItem('isLoggedIn') === 'true') {
        setIsLoggedIn(true);
      }
    });
    return unsubscribe;
  }, []);

  // Connection test
  useEffect(() => {
    if (isLoggedIn && user) {
      machineService.testConnection();
    }
  }, [isLoggedIn, user]);

  // Save worker name
  useEffect(() => {
    localStorage.setItem('workerName', workerName);
  }, [workerName]);

  // Real-time data listener
  useEffect(() => {
    if (!isLoggedIn || !user) return;

    try {
      const unsubMachines = machineService.subscribeToMachines(setMachines);
      const unsubRepairs = machineService.subscribeToRepairs(setRepairs);

      return () => {
        unsubMachines();
        unsubRepairs();
      };
    } catch (err) {
      console.error('Subscription error:', err);
    }
  }, [isLoggedIn, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPassword = password.trim();
    if (trimmedPassword === '888') {
      setIsLoggingIn(true);
      try {
        await signInAnonymously(auth);
        setIsLoggedIn(true);
        localStorage.setItem('isLoggedIn', 'true');
      } catch (err) {
        console.error('Login error:', err);
        alert('登录失败: ' + (err instanceof Error ? err.message : '未知错误') + '\n请检查网络或联系管理员。');
      } finally {
        setIsLoggingIn(false);
      }
    } else if (trimmedPassword === '') {
      alert('请输入密码');
    } else {
      alert('密码错误');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
  };

  const filteredMachines = useMemo(() => {
    return machines
      .filter(m => {
        const matchesSearch = 
          m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.community.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || m.currentStatus === filterStatus;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const isAActive = a.currentStatus === 'fault' || a.currentStatus === 'in_progress';
        const isBActive = b.currentStatus === 'fault' || b.currentStatus === 'in_progress';
        
        if (isAActive && !isBActive) return -1;
        if (!isAActive && isBActive) return 1;
        return a.id.localeCompare(b.id);
      });
  }, [machines, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: machines.length,
      pending: machines.filter(m => m.currentStatus === 'fault').length,
      inProgress: machines.filter(m => m.currentStatus === 'in_progress').length,
      normal: machines.filter(m => m.currentStatus === 'normal').length,
    };
  }, [machines]);

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await machineService.addMachine({
        id: newMachineId,
        community: newCommunity,
        location: newLocation
      });
      setNewMachineId('');
      setNewCommunity('');
      setNewLocation('');
      setModalType(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加失败');
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalFaults = [...selectedFaults];
    if (finalFaults.includes('其他') && customFault) {
      finalFaults = finalFaults.map(f => f === '其他' ? `其他: ${customFault}` : f);
    } else if (finalFaults.includes('其他')) {
      finalFaults = finalFaults.filter(f => f !== '其他');
    }
    
    const finalFaultString = finalFaults.join(', ');
    
    if (selectedMachine && finalFaultString) {
      try {
        await machineService.reportFault(selectedMachine.id, finalFaultString, workerName);
        setSelectedFaults([]);
        setCustomFault('');
        setModalType(null);
      } catch (err) {
        alert('报修失败');
      }
    }
  };

  const handleEditMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMachine) {
      try {
        await machineService.updateMachine(selectedMachine.id, {
          community: newCommunity,
          location: newLocation
        });
        setModalType(null);
      } catch (err) {
        alert('更新失败');
      }
    }
  };

  const handleStart = async () => {
    if (selectedMachine) {
      try {
        await machineService.startRepair(selectedMachine.id, workerName);
        setModalType(null);
      } catch (err) {
        alert('操作失败');
      }
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMachine && repairContent) {
      const pendingRepair = repairs.find(r => r.machineId === selectedMachine.id && r.status === 'pending');
      if (!pendingRepair) return alert('未找到待处理的维修记录');
      
      try {
        await machineService.completeRepair(selectedMachine.id, repairContent, partsReplaced, workerName, pendingRepair.id);
        setRepairContent('');
        setPartsReplaced('');
        setModalType(null);
      } catch (err) {
        alert('操作失败');
      }
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-bold">系统加载中...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-blue-600">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center space-y-6"
        >
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <Wrench className="text-blue-600" size={40} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">康鲁泉管理系统</h1>
            <p className="text-gray-500 font-bold">联网专业版 · 实时同步</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="请输入系统密码" 
              className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 focus:ring-blue-500 text-center text-xl tracking-widest"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              {isLoggingIn ? '正在进入...' : '进入系统'}
            </button>
          </form>
          <p className="text-[10px] text-gray-400">管理员: liuxiyang5211314@gmail.com</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-200">
                <Wrench className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-gray-900">康鲁泉净水器维修管理系统</h1>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cloud Sync Active</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setModalType('add')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                <Plus size={18} /> 新增设备
              </button>
              
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-200">
                <User size={16} className="text-gray-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">当前操作人</span>
                  <input 
                    type="text" 
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    className="bg-transparent text-sm font-bold focus:outline-none w-24 text-gray-700"
                    placeholder="工人姓名"
                  />
                </div>
              </div>

              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: '全部设备', value: stats.total, icon: Filter, color: 'bg-gray-100 text-gray-600' },
            { label: '待维修', value: stats.pending, icon: AlertCircle, color: 'bg-amber-50 text-amber-600' },
            { label: '维修中', value: stats.inProgress, icon: Clock, color: 'bg-blue-50 text-blue-600' },
            { label: '运行中', value: stats.normal, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className={`p-3.5 rounded-2xl ${stat.color}`}>
                <stat.icon size={22} />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-black uppercase tracking-wide">{stat.label}</p>
                <p className="text-2xl font-black text-gray-900">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="搜索设备编号或小区..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all outline-none shadow-sm font-medium"
            />
          </div>
          <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar">
            {['all', 'fault', 'in_progress', 'normal'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap uppercase tracking-wider ${
                  filterStatus === s 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
              >
                {s === 'all' ? '全部' : s === 'fault' ? '待维修' : s === 'in_progress' ? '维修中' : '运行中'}
              </button>
            ))}
          </div>
        </div>

        {/* Machine Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredMachines.map((machine) => (
              <motion.div
                key={machine.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-white rounded-3xl border ${
                  machine.currentStatus === 'fault' ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'
                } shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden group flex flex-col`}
              >
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex flex-col">
                      <span className="text-xl font-black text-gray-900 tracking-tight">{machine.id}</span>
                    </div>
                    <Badge status={machine.currentStatus} />
                  </div>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-gray-50 rounded-lg">
                        <MapPin size={14} className="text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-0.5">小区位置</p>
                        <p className="text-sm text-gray-700 font-bold leading-relaxed">
                          {machine.community} · {machine.location}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-gray-50 rounded-lg">
                        <AlertCircle size={14} className="text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-0.5">最近故障</p>
                        <p className="text-sm text-gray-700 font-medium line-clamp-2 leading-relaxed">
                          {machine.lastFault || <span className="text-gray-300 italic font-normal">暂无故障记录</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-1 bg-gray-50 rounded-lg">
                        <Clock size={14} className="text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-0.5">最后维修</p>
                        <p className="text-xs text-gray-600 font-semibold">
                          {machine.lastRepairTime || '从未维修'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50/50 border-t border-gray-100 grid grid-cols-2 gap-3">
                  {machine.currentStatus === 'normal' ? (
                    <button 
                      onClick={() => { setSelectedMachine(machine); setModalType('report'); }}
                      className="flex items-center justify-center gap-2 py-2.5 bg-white text-amber-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-50 transition-colors border border-amber-100 shadow-sm"
                    >
                      <PlusCircle size={16} /> 报修
                    </button>
                  ) : machine.currentStatus === 'fault' ? (
                    <button 
                      onClick={() => { setSelectedMachine(machine); setModalType('start'); }}
                      className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                    >
                      <Wrench size={16} /> 开始维修
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setSelectedMachine(machine); setModalType('complete'); }}
                      className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                    >
                      <CheckCircle2 size={16} /> 完成维修
                    </button>
                  )}
                  <button 
                    onClick={() => { setSelectedMachine(machine); setModalType('history'); }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-white text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm"
                  >
                    <History size={16} /> 历史记录
                  </button>
                  <button 
                    onClick={() => { 
                      setSelectedMachine(machine); 
                      setNewCommunity(machine.community);
                      setNewLocation(machine.location);
                      setModalType('edit'); 
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-white text-blue-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-50 transition-colors border border-blue-100 shadow-sm"
                  >
                    <Edit size={16} /> 编辑
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {modalType === 'add' && (
          <Modal isOpen={true} onClose={() => setModalType(null)} title="新增设备">
            <form onSubmit={handleAddMachine} className="space-y-4">
              <input required placeholder="设备编号 (如 KLQ-001)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={newMachineId} onChange={e => setNewMachineId(e.target.value)} />
              <input required placeholder="所属小区" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={newCommunity} onChange={e => setNewCommunity(e.target.value)} />
              <input placeholder="具体位置" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={newLocation} onChange={e => setNewLocation(e.target.value)} />
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">确认添加</button>
            </form>
          </Modal>
        )}

        {modalType === 'edit' && selectedMachine && (
          <Modal isOpen={true} onClose={() => setModalType(null)} title={`编辑设备 - ${selectedMachine.id}`}>
            <form onSubmit={handleEditMachine} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold uppercase ml-2">所属小区</label>
                <input required placeholder="所属小区" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border border-gray-100 focus:border-blue-500" value={newCommunity} onChange={e => setNewCommunity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold uppercase ml-2">具体位置</label>
                <input placeholder="具体位置" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border border-gray-100 focus:border-blue-500" value={newLocation} onChange={e => setNewLocation(e.target.value)} />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">保存修改</button>
            </form>
          </Modal>
        )}

        {modalType === 'report' && selectedMachine && (
          <Modal isOpen={true} onClose={() => setModalType(null)} title={`故障报修 - ${selectedMachine.id}`}>
            <form onSubmit={handleReport} className="space-y-4">
              <p className="text-[10px] text-gray-400 font-bold uppercase ml-1">请选择故障类型 (可多选)</p>
              <div className="grid grid-cols-2 gap-2">
                {faultOptions.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSelectedFaults(prev => 
                        prev.includes(opt) 
                          ? prev.filter(f => f !== opt) 
                          : [...prev, opt]
                      );
                    }}
                    className={`p-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedFaults.includes(opt) 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              
              {selectedFaults.includes('其他') && (
                <textarea 
                  required
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none h-24 border border-gray-200 focus:border-blue-500 transition-all" 
                  placeholder="请详细描述故障情况..."
                  value={customFault}
                  onChange={e => setCustomFault(e.target.value)}
                ></textarea>
              )}
              
              <button 
                type="submit" 
                disabled={selectedFaults.length === 0 || (selectedFaults.includes('其他') && !customFault)}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg disabled:opacity-50"
              >
                提交报修
              </button>
            </form>
          </Modal>
        )}

        {modalType === 'start' && selectedMachine && (
          <Modal isOpen={true} onClose={() => setModalType(null)} title={`开始维修 - ${selectedMachine.id}`}>
            <div className="space-y-6">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <p className="text-xs text-amber-600 font-bold mb-1">故障描述:</p>
                <p className="text-sm font-bold text-amber-900">{selectedMachine.lastFault}</p>
              </div>
              <button onClick={handleStart} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">确认开始</button>
            </div>
          </Modal>
        )}

        {modalType === 'complete' && selectedMachine && (
          <Modal isOpen={true} onClose={() => setModalType(null)} title={`完成维修 - ${selectedMachine.id}`}>
            <form onSubmit={handleComplete} className="space-y-4">
              <textarea 
                required
                className="w-full p-4 bg-gray-50 rounded-2xl outline-none h-32" 
                placeholder="维修内容总结..."
                value={repairContent}
                onChange={e => setRepairContent(e.target.value)}
              ></textarea>
              <input 
                placeholder="更换零件 (可选)" 
                className="w-full p-4 bg-gray-50 rounded-2xl outline-none" 
                value={partsReplaced}
                onChange={e => setPartsReplaced(e.target.value)}
              />
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg">确认完成</button>
            </form>
          </Modal>
        )}

        {modalType === 'history' && selectedMachine && (
          <Modal isOpen={true} onClose={() => setModalType(null)} title={`维修历史 - ${selectedMachine.id}`}>
            <div className="space-y-4">
              {repairs.filter(r => r.machineId === selectedMachine.id).length === 0 ? (
                <p className="text-center py-10 text-gray-400">暂无记录</p>
              ) : repairs.filter(r => r.machineId === selectedMachine.id).map(r => (
                <div key={r.id} className="border-l-4 border-blue-600 pl-4 py-2 bg-gray-50 rounded-r-xl">
                  <p className="text-[10px] text-gray-400 font-bold">{r.date}</p>
                  <p className="font-bold text-sm text-gray-700">{r.faultDesc}</p>
                  {r.repairContent && <p className="text-xs text-gray-500 mt-1">总结: {r.repairContent}</p>}
                  {r.partsReplaced && <p className="text-xs text-gray-500">零件: {r.partsReplaced}</p>}
                  <p className="text-[10px] text-gray-400 mt-1 uppercase">处理人: {r.worker}</p>
                  <span className={`text-[10px] font-black uppercase ${r.status === 'completed' ? 'text-green-500' : 'text-red-500'}`}>
                    {r.status === 'completed' ? '已修复' : '待处理'}
                  </span>
                </div>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <footer className="p-8 text-center text-gray-300 text-[10px] font-bold uppercase tracking-widest">
        © 2026 康鲁泉净水器管理系统 · 云端同步版
      </footer>
    </div>
  );
}
