import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dumbbell, BarChart2, Calendar, Home, Plus, Trash2, ChevronRight,
  ChevronLeft, Check, Timer, TrendingUp, Flame, Award, X, Edit2,
  Play, Pause, RotateCcw, ArrowUp, Scale, Save, ChevronDown, ChevronUp,
  Zap, Target, Activity
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── Storage helpers ──────────────────────────────────────────────────────────
const KEYS = {
  workouts: "ft_workouts",
  bodyweight: "ft_bodyweight",
  plans: "ft_plans",
  schedule: "ft_schedule",
  settings: "ft_settings",
};

async function load(key) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function save(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const dayName = (d) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d];
const weekStart = () => {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0,10);
};
const fmt = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);

const MUSCLE_GROUPS = ["Chest","Back","Shoulders","Biceps","Triceps","Legs","Glutes","Core","Full Body","Cardio"];
const DEFAULT_PLANS = [
  { id:"p1", name:"Push Day", color:"#f97316", exercises:[
    {id:"e1",name:"Bench Press",muscleGroup:"Chest",sets:4,reps:8,weight:135},
    {id:"e2",name:"Incline DB Press",muscleGroup:"Chest",sets:3,reps:10,weight:60},
    {id:"e3",name:"Overhead Press",muscleGroup:"Shoulders",sets:3,reps:10,weight:95},
    {id:"e4",name:"Lateral Raises",muscleGroup:"Shoulders",sets:3,reps:15,weight:20},
    {id:"e5",name:"Tricep Pushdown",muscleGroup:"Triceps",sets:3,reps:12,weight:50},
  ]},
  { id:"p2", name:"Pull Day", color:"#3b82f6", exercises:[
    {id:"e6",name:"Deadlift",muscleGroup:"Back",sets:4,reps:5,weight:225},
    {id:"e7",name:"Barbell Row",muscleGroup:"Back",sets:3,reps:8,weight:135},
    {id:"e8",name:"Pull-Ups",muscleGroup:"Back",sets:3,reps:8,weight:0},
    {id:"e9",name:"Face Pulls",muscleGroup:"Shoulders",sets:3,reps:15,weight:30},
    {id:"e10",name:"Barbell Curl",muscleGroup:"Biceps",sets:3,reps:10,weight:65},
  ]},
  { id:"p3", name:"Leg Day", color:"#22c55e", exercises:[
    {id:"e11",name:"Squat",muscleGroup:"Legs",sets:4,reps:8,weight:185},
    {id:"e12",name:"Romanian Deadlift",muscleGroup:"Legs",sets:3,reps:10,weight:135},
    {id:"e13",name:"Leg Press",muscleGroup:"Legs",sets:3,reps:12,weight:270},
    {id:"e14",name:"Leg Curl",muscleGroup:"Legs",sets:3,reps:12,weight:80},
    {id:"e15",name:"Calf Raises",muscleGroup:"Legs",sets:4,reps:15,weight:100},
  ]},
];
const DEFAULT_SCHEDULE = {0:null,1:"p2",2:"p3",3:"p1",4:null,5:"p2",6:"p3"};

// ─── Rest Timer ───────────────────────────────────────────────────────────────
function RestTimer({ onDone }) {
  const [secs, setSecs] = useState(90);
  const [running, setRunning] = useState(true);
  const [total] = useState(90);
  useEffect(() => {
    if (!running) return;
    if (secs <= 0) { onDone(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, running, onDone]);
  const pct = secs / total;
  const r = 44, circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2937" strokeWidth="8"/>
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f97316" strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round" style={{transition:"stroke-dashoffset 1s linear"}}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-white">{secs}s</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setRunning(r => !r)}
          className="p-2 rounded-xl bg-gray-800 text-white">
          {running ? <Pause size={18}/> : <Play size={18}/>}
        </button>
        <button onClick={() => setSecs(total)}
          className="p-2 rounded-xl bg-gray-800 text-white"><RotateCcw size={18}/></button>
        <button onClick={onDone}
          className="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm">Skip</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [workouts, setWorkouts] = useState([]);
  const [bodyweight, setBodyweight] = useState([]);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [loaded, setLoaded] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState(null); // workout session

  useEffect(() => {
    (async () => {
      const w = await load(KEYS.workouts);
      const b = await load(KEYS.bodyweight);
      const p = await load(KEYS.plans);
      const s = await load(KEYS.schedule);
      if (w) setWorkouts(w);
      if (b) setBodyweight(b);
      if (p) setPlans(p);
      if (s) setSchedule(s);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) save(KEYS.workouts, workouts); }, [workouts, loaded]);
  useEffect(() => { if (loaded) save(KEYS.bodyweight, bodyweight); }, [bodyweight, loaded]);
  useEffect(() => { if (loaded) save(KEYS.plans, plans); }, [plans, loaded]);
  useEffect(() => { if (loaded) save(KEYS.schedule, schedule); }, [schedule, loaded]);

  const addWorkout = (w) => setWorkouts(prev => [w, ...prev]);
  const deleteWorkout = (id) => setWorkouts(prev => prev.filter(w => w.id !== id));

  if (!loaded) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-orange-500 text-2xl font-black animate-pulse">LOADING...</div>
    </div>
  );

  if (activeWorkout) return (
    <WorkoutSession
      plan={plans.find(p => p.id === activeWorkout)}
      workouts={workouts}
      onFinish={(w) => { addWorkout(w); setActiveWorkout(null); }}
      onCancel={() => setActiveWorkout(null)}
    />
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono max-w-md mx-auto relative">
      <div className="pb-20">
        {tab === "dashboard" && <Dashboard workouts={workouts} plans={plans} schedule={schedule} onStart={setActiveWorkout} bodyweight={bodyweight}/>}
        {tab === "log" && <LogTab workouts={workouts} addWorkout={addWorkout} deleteWorkout={deleteWorkout} plans={plans}/>}
        {tab === "plans" && <PlansTab plans={plans} setPlans={setPlans} schedule={schedule} setSchedule={setSchedule}/>}
        {tab === "body" && <BodyTab bodyweight={bodyweight} setBodyweight={setBodyweight}/>}
        {tab === "stats" && <StatsTab workouts={workouts} plans={plans} schedule={schedule}/>}
      </div>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gray-900 border-t border-gray-800 flex">
        {[
          {id:"dashboard",icon:<Home size={20}/>,label:"Home"},
          {id:"log",icon:<Dumbbell size={20}/>,label:"Log"},
          {id:"plans",icon:<Calendar size={20}/>,label:"Plans"},
          {id:"body",icon:<Scale size={20}/>,label:"Body"},
          {id:"stats",icon:<BarChart2 size={20}/>,label:"Stats"},
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-bold transition-colors ${tab===t.id?"text-orange-500":"text-gray-500"}`}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ workouts, plans, schedule, onStart, bodyweight }) {
  const dow = new Date().getDay();
  const todayPlanId = schedule[dow];
  const todayPlan = plans.find(p => p.id === todayPlanId);

  // PRs
  const prs = getPRs(workouts);
  const recentPRs = prs.slice(0, 3);

  // Streak
  const streak = calcStreak(workouts, schedule);

  // Weekly volume
  const weekVol = calcWeeklyVolume(workouts);

  // Last bodyweight
  const lastBW = bodyweight[bodyweight.length - 1];

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4 pb-2">
        <div className="text-xs text-gray-500 uppercase tracking-widest">Today</div>
        <div className="text-3xl font-black text-white">{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
      </div>

      {/* Today's Plan */}
      <div className={`rounded-2xl p-4 ${todayPlan ? "bg-gray-900 border border-gray-800" : "bg-gray-900/50 border border-gray-800/50"}`}>
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Today's Workout</div>
        {todayPlan ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl font-black" style={{color: todayPlan.color}}>{todayPlan.name}</span>
              <span className="text-sm text-gray-400">{todayPlan.exercises.length} exercises</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-4">
              {[...new Set(todayPlan.exercises.map(e=>e.muscleGroup))].map(mg => (
                <span key={mg} className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">{mg}</span>
              ))}
            </div>
            <button onClick={() => onStart(todayPlan.id)}
              className="w-full py-3 rounded-xl font-black text-white flex items-center justify-center gap-2"
              style={{background: todayPlan.color}}>
              <Play size={16} fill="white"/> START WORKOUT
            </button>
          </>
        ) : (
          <div className="text-gray-500 text-sm">Rest day — no workout scheduled.</div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800">
          <Flame size={16} className="text-orange-500 mb-1"/>
          <div className="text-2xl font-black text-white">{streak}</div>
          <div className="text-xs text-gray-500">wk streak</div>
        </div>
        <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800">
          <Activity size={16} className="text-blue-500 mb-1"/>
          <div className="text-2xl font-black text-white">{fmt(weekVol)}</div>
          <div className="text-xs text-gray-500">lbs/week</div>
        </div>
        <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800">
          <Scale size={16} className="text-green-500 mb-1"/>
          <div className="text-2xl font-black text-white">{lastBW ? lastBW.weight : "--"}</div>
          <div className="text-xs text-gray-500">lbs</div>
        </div>
      </div>

      {/* Recent PRs */}
      {recentPRs.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-yellow-400"/>
            <span className="text-xs text-gray-500 uppercase tracking-widest">Recent PRs</span>
          </div>
          <div className="space-y-2">
            {recentPRs.map((pr, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-white font-bold">{pr.exercise}</span>
                <span className="text-sm text-yellow-400 font-black">{pr.weight}lbs × {pr.reps}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Volume mini chart */}
      <WeeklyVolMini workouts={workouts}/>
    </div>
  );
}

function WeeklyVolMini({ workouts }) {
  const data = last7Days(workouts);
  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">7-Day Volume</div>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={data} barSize={16}>
          <Bar dataKey="vol" fill="#f97316" radius={[4,4,0,0]}/>
          <XAxis dataKey="day" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={{background:"#111827",border:"1px solid #374151",borderRadius:8,color:"#fff",fontSize:12}} formatter={(v)=>[`${fmt(v)} lbs`,"Vol"]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────
function LogTab({ workouts, addWorkout, deleteWorkout, plans }) {
  const [showNew, setShowNew] = useState(false);
  const [overloadFlags, setOverloadFlags] = useState({});

  // check overload suggestions
  useEffect(() => {
    const flags = {};
    workouts.forEach(w => {
      w.exercises?.forEach(ex => {
        const hist = getExerciseHistory(workouts, ex.name);
        if (hist.length >= 2) {
          const last = hist[0], prev = hist[1];
          const sameSets = last.sets >= prev.sets;
          const sameWeight = last.weight >= prev.weight;
          const sameReps = last.reps >= prev.reps;
          if (sameSets && sameWeight && sameReps) {
            flags[ex.name] = true;
          }
        }
      });
    });
    setOverloadFlags(flags);
  }, [workouts]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h2 className="text-2xl font-black">WORKOUT LOG</h2>
        <button onClick={() => setShowNew(true)}
          className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
          <Plus size={20}/>
        </button>
      </div>
      {showNew && (
        <NewWorkoutForm plans={plans} onSave={(w) => { addWorkout(w); setShowNew(false); }} onCancel={() => setShowNew(false)}/>
      )}
      {workouts.length === 0 && !showNew && (
        <div className="text-center text-gray-500 py-12">
          <Dumbbell size={40} className="mx-auto mb-3 opacity-30"/>
          <div>No workouts yet. Hit the + to log one.</div>
        </div>
      )}
      <div className="space-y-3">
        {workouts.map(w => <WorkoutCard key={w.id} workout={w} overloadFlags={overloadFlags} onDelete={() => deleteWorkout(w.id)}/>)}
      </div>
    </div>
  );
}

function WorkoutCard({ workout, overloadFlags, onDelete }) {
  const [open, setOpen] = useState(false);
  const vol = workout.exercises?.reduce((a,e) => a + (e.sets*e.reps*e.weight),0) ?? 0;
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <button className="w-full p-4 flex items-center justify-between" onClick={() => setOpen(o=>!o)}>
        <div className="text-left">
          <div className="font-black text-white">{workout.name}</div>
          <div className="text-xs text-gray-500">{workout.date} · {fmt(vol)} lbs volume</div>
        </div>
        <div className="flex items-center gap-2">
          {open ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-800 pt-3">
          {workout.exercises?.map((ex, i) => (
            <div key={i} className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1">
                  {ex.name}
                  {overloadFlags[ex.name] && (
                    <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 flex items-center gap-0.5">
                      <ArrowUp size={10}/>OL
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{ex.muscleGroup}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-orange-400">{ex.weight}lbs</div>
                <div className="text-xs text-gray-500">{ex.sets}×{ex.reps}</div>
              </div>
            </div>
          ))}
          <button onClick={onDelete} className="mt-2 text-xs text-red-500 flex items-center gap-1">
            <Trash2 size={12}/> Delete workout
          </button>
        </div>
      )}
    </div>
  );
}

function NewWorkoutForm({ plans, onSave, onCancel }) {
  const [name, setName] = useState(`Workout ${new Date().toLocaleDateString()}`);
  const [exercises, setExercises] = useState([{id:uid(),name:"",muscleGroup:"Chest",sets:3,reps:10,weight:0}]);
  const addEx = () => setExercises(e => [...e, {id:uid(),name:"",muscleGroup:"Chest",sets:3,reps:10,weight:0}]);
  const remEx = (id) => setExercises(e => e.filter(x=>x.id!==id));
  const updEx = (id, field, val) => setExercises(e => e.map(x=>x.id===id?{...x,[field]:field==="sets"||field==="reps"||field==="weight"?Number(val)||0:val}:x));
  const handleSave = () => {
    onSave({id:uid(), name, date:today(), exercises});
  };
  return (
    <div className="bg-gray-900 rounded-2xl border border-orange-500/50 p-4 space-y-4">
      <div className="text-sm font-black text-orange-500 uppercase tracking-widest">New Workout</div>
      <input value={name} onChange={e=>setName(e.target.value)}
        className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white font-bold border border-gray-700 focus:border-orange-500 outline-none"/>
      {exercises.map(ex => (
        <div key={ex.id} className="bg-gray-800 rounded-xl p-3 space-y-2">
          <div className="flex gap-2">
            <input placeholder="Exercise name" value={ex.name} onChange={e=>updEx(ex.id,"name",e.target.value)}
              className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-gray-600 focus:border-orange-500"/>
            <button onClick={() => remEx(ex.id)} className="p-2 text-red-400"><Trash2 size={14}/></button>
          </div>
          <select value={ex.muscleGroup} onChange={e=>updEx(ex.id,"muscleGroup",e.target.value)}
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-gray-600">
            {MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {["sets","reps","weight"].map(f => (
              <div key={f}>
                <div className="text-xs text-gray-500 mb-1 uppercase">{f}{f==="weight"?" (lbs)":""}</div>
                <input type="number" value={ex[f]} onChange={e=>updEx(ex.id,f,e.target.value)}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none border border-gray-600 focus:border-orange-500 text-center font-bold"/>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={addEx} className="w-full py-3 rounded-xl border border-dashed border-gray-700 text-gray-500 text-sm flex items-center justify-center gap-2">
        <Plus size={14}/> Add Exercise
      </button>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm">Cancel</button>
        <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black text-sm">Save</button>
      </div>
    </div>
  );
}

// ─── Workout Session ──────────────────────────────────────────────────────────
function WorkoutSession({ plan, workouts, onFinish, onCancel }) {
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [resting, setResting] = useState(false);
  const [done, setDone] = useState([]); // [{exName, sets, reps, weight}]
  const [weight, setWeight] = useState(null);
  const [reps, setReps] = useState(null);
  const [finished, setFinished] = useState(false);

  const ex = plan.exercises[exIdx];
  const totalSets = plan.exercises.reduce((a,e)=>a+e.sets,0);
  const doneSets = done.reduce((a,d)=>a+d.sets,0) + setIdx;
  const progress = totalSets > 0 ? doneSets/totalSets : 0;

  useEffect(() => {
    if (ex) {
      setWeight(ex.weight);
      setReps(ex.reps);
    }
  }, [exIdx]);

  const logSet = () => {
    if (setIdx + 1 < ex.sets) {
      setSetIdx(s => s+1);
      setResting(true);
    } else {
      setDone(d => [...d, {exName:ex.name, muscleGroup:ex.muscleGroup, sets:ex.sets, reps:Number(reps)||ex.reps, weight:Number(weight)||ex.weight}]);
      setSetIdx(0);
      if (exIdx + 1 < plan.exercises.length) {
        setExIdx(i => i+1);
        setResting(true);
      } else {
        setFinished(true);
      }
    }
  };

  const finishWorkout = () => {
    const w = {
      id: uid(),
      name: plan.name,
      date: today(),
      planId: plan.id,
      exercises: done,
    };
    onFinish(w);
  };

  if (finished) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🔥</div>
      <div className="text-3xl font-black text-white mb-2">WORKOUT DONE</div>
      <div className="text-gray-400 mb-6">{done.length} exercises · {done.reduce((a,d)=>a+d.sets,0)} sets total</div>
      <div className="w-full bg-gray-900 rounded-2xl p-4 mb-6 border border-gray-800 space-y-2">
        {done.map((d,i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-white font-bold">{d.exName}</span>
            <span className="text-orange-400 font-black">{d.weight}lbs × {d.sets}×{d.reps}</span>
          </div>
        ))}
      </div>
      <button onClick={finishWorkout} className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black text-lg">SAVE WORKOUT</button>
    </div>
  );

  // last time this exercise was done
  const hist = getExerciseHistory(workouts, ex.name);
  const lastTime = hist[0];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-4 mb-4">
        <button onClick={onCancel} className="p-2 rounded-xl bg-gray-900"><X size={20}/></button>
        <div className="text-center">
          <div className="font-black text-white" style={{color:plan.color}}>{plan.name}</div>
          <div className="text-xs text-gray-500">Exercise {exIdx+1}/{plan.exercises.length}</div>
        </div>
        <div className="w-9"/>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{width:`${progress*100}%`}}/>
      </div>

      {/* Exercise */}
      <div className="flex-1 space-y-4">
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <div className="text-2xl font-black text-white mb-1">{ex.name}</div>
          <div className="text-sm text-gray-500">{ex.muscleGroup} · Set {setIdx+1} of {ex.sets}</div>
          {lastTime && (
            <div className="mt-2 text-xs text-blue-400 flex items-center gap-1">
              <TrendingUp size={10}/> Last: {lastTime.weight}lbs × {lastTime.sets}×{lastTime.reps}
            </div>
          )}
        </div>

        {resting ? (
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-center text-sm text-gray-500 mb-2 font-bold uppercase tracking-widest">Rest</div>
            <RestTimer onDone={() => setResting(false)}/>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Weight (lbs)</div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setWeight(w=>Math.max(0,Number(w)-5))} className="w-10 h-10 rounded-xl bg-gray-800 text-white font-black flex items-center justify-center text-lg">−</button>
                  <input type="number" value={weight??""} onChange={e=>setWeight(e.target.value)}
                    className="flex-1 bg-transparent text-center text-2xl font-black text-orange-400 outline-none"/>
                  <button onClick={()=>setWeight(w=>Number(w)+5)} className="w-10 h-10 rounded-xl bg-gray-800 text-white font-black flex items-center justify-center text-lg">+</button>
                </div>
              </div>
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Reps</div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setReps(r=>Math.max(1,Number(r)-1))} className="w-10 h-10 rounded-xl bg-gray-800 text-white font-black flex items-center justify-center text-lg">−</button>
                  <input type="number" value={reps??""} onChange={e=>setReps(e.target.value)}
                    className="flex-1 bg-transparent text-center text-2xl font-black text-orange-400 outline-none"/>
                  <button onClick={()=>setReps(r=>Number(r)+1)} className="w-10 h-10 rounded-xl bg-gray-800 text-white font-black flex items-center justify-center text-lg">+</button>
                </div>
              </div>
            </div>
            <button onClick={logSet}
              className="w-full py-5 rounded-2xl font-black text-xl text-white flex items-center justify-center gap-2"
              style={{background:plan.color}}>
              <Check size={22}/> LOG SET
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────
function PlansTab({ plans, setPlans, schedule, setSchedule }) {
  const [editing, setEditing] = useState(null); // plan id or "new"
  const [schedOpen, setSchedOpen] = useState(false);

  const deletePlan = (id) => {
    setPlans(p => p.filter(x=>x.id!==id));
    setSchedule(s => {
      const ns = {...s};
      Object.keys(ns).forEach(k => { if(ns[k]===id) ns[k]=null; });
      return ns;
    });
  };

  if (editing) return (
    <PlanEditor
      plan={editing==="new" ? {id:uid(),name:"",color:"#f97316",exercises:[]} : plans.find(p=>p.id===editing)}
      onSave={(p) => {
        setPlans(prev => editing==="new" ? [...prev,p] : prev.map(x=>x.id===p.id?p:x));
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h2 className="text-2xl font-black">PLANS</h2>
        <button onClick={() => setEditing("new")} className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
          <Plus size={20}/>
        </button>
      </div>

      {/* Schedule */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <button className="w-full p-4 flex items-center justify-between" onClick={()=>setSchedOpen(o=>!o)}>
          <span className="font-black text-white flex items-center gap-2"><Calendar size={16} className="text-orange-500"/>Weekly Schedule</span>
          {schedOpen ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
        </button>
        {schedOpen && (
          <div className="px-4 pb-4 grid grid-cols-7 gap-1 border-t border-gray-800 pt-3">
            {[0,1,2,3,4,5,6].map(d => {
              const pid = schedule[d];
              const plan = plans.find(p=>p.id===pid);
              return (
                <div key={d} className="flex flex-col items-center gap-1">
                  <div className="text-xs text-gray-500">{dayName(d)}</div>
                  <select value={pid||""} onChange={e=>setSchedule(s=>({...s,[d]:e.target.value||null}))}
                    className="w-full text-xs bg-gray-800 rounded-lg py-1 text-white outline-none border border-gray-700 text-center"
                    style={{color: plan?.color||"#9ca3af"}}>
                    <option value="">—</option>
                    {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {plans.map(plan => (
        <div key={plan.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-black text-lg" style={{color:plan.color}}>{plan.name}</div>
            <div className="flex gap-2">
              <button onClick={()=>setEditing(plan.id)} className="p-2 rounded-xl bg-gray-800 text-gray-400"><Edit2 size={14}/></button>
              <button onClick={()=>deletePlan(plan.id)} className="p-2 rounded-xl bg-gray-800 text-red-400"><Trash2 size={14}/></button>
            </div>
          </div>
          <div className="space-y-1">
            {plan.exercises.map((ex,i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white">{ex.name}</span>
                <span className="text-gray-500">{ex.sets}×{ex.reps} @ {ex.weight}lbs</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const COLORS = ["#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#eab308","#06b6d4"];

function PlanEditor({ plan, onSave, onCancel }) {
  const [p, setP] = useState({...plan, exercises: plan.exercises.map(e=>({...e}))});
  const addEx = () => setP(x=>({...x, exercises:[...x.exercises, {id:uid(),name:"",muscleGroup:"Chest",sets:3,reps:10,weight:0}]}));
  const remEx = (id) => setP(x=>({...x, exercises:x.exercises.filter(e=>e.id!==id)}));
  const updEx = (id,f,v) => setP(x=>({...x,exercises:x.exercises.map(e=>e.id===id?{...e,[f]:["sets","reps","weight"].includes(f)?Number(v)||0:v}:e)}));
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pt-4">
        <button onClick={onCancel} className="p-2 rounded-xl bg-gray-900"><ChevronLeft size={18}/></button>
        <h2 className="text-xl font-black">{plan.id ? "EDIT PLAN" : "NEW PLAN"}</h2>
      </div>
      <input placeholder="Plan name" value={p.name} onChange={e=>setP(x=>({...x,name:e.target.value}))}
        className="w-full bg-gray-900 rounded-xl px-4 py-3 text-white font-bold border border-gray-700 focus:border-orange-500 outline-none"/>
      <div>
        <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest">Color</div>
        <div className="flex gap-2">
          {COLORS.map(c => (
            <button key={c} onClick={()=>setP(x=>({...x,color:c}))}
              className="w-8 h-8 rounded-full border-2 transition-all"
              style={{background:c, borderColor: p.color===c?"white":"transparent"}}/>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {p.exercises.map(ex => (
          <div key={ex.id} className="bg-gray-900 rounded-xl p-3 space-y-2 border border-gray-800">
            <div className="flex gap-2">
              <input placeholder="Exercise name" value={ex.name} onChange={e=>updEx(ex.id,"name",e.target.value)}
                className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none border border-gray-700 focus:border-orange-500"/>
              <button onClick={()=>remEx(ex.id)} className="p-2 text-red-400"><Trash2 size={14}/></button>
            </div>
            <select value={ex.muscleGroup} onChange={e=>updEx(ex.id,"muscleGroup",e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none border border-gray-700">
              {MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              {["sets","reps","weight"].map(f=>(
                <div key={f}>
                  <div className="text-xs text-gray-500 mb-1 uppercase">{f}</div>
                  <input type="number" value={ex[f]} onChange={e=>updEx(ex.id,f,e.target.value)}
                    className="w-full bg-gray-800 rounded-lg px-2 py-2 text-sm text-white outline-none border border-gray-700 text-center font-bold"/>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={addEx} className="w-full py-3 rounded-xl border border-dashed border-gray-700 text-gray-500 text-sm flex items-center justify-center gap-2">
          <Plus size={14}/> Add Exercise
        </button>
      </div>
      <div className="flex gap-2 pb-4">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold">Cancel</button>
        <button onClick={()=>onSave(p)} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black">Save Plan</button>
      </div>
    </div>
  );
}

// ─── Body Tab ─────────────────────────────────────────────────────────────────
function BodyTab({ bodyweight, setBodyweight }) {
  const [input, setInput] = useState("");
  const addEntry = () => {
    const w = parseFloat(input);
    if (!w) return;
    setBodyweight(b => [...b, {date:today(), weight:w}]);
    setInput("");
  };
  const chartData = bodyweight.slice(-30).map(b=>({date:b.date.slice(5),w:b.weight}));
  const latest = bodyweight[bodyweight.length-1];
  const prev = bodyweight[bodyweight.length-2];
  const diff = latest && prev ? (latest.weight - prev.weight).toFixed(1) : null;

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h2 className="text-2xl font-black">BODY WEIGHT</h2>
      </div>
      {/* Log new */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex gap-3">
        <input type="number" placeholder="Weight (lbs)" value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addEntry()}
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-white font-bold border border-gray-700 focus:border-orange-500 outline-none text-lg"/>
        <button onClick={addEntry} className="px-5 py-3 rounded-xl bg-orange-500 text-white font-black">LOG</button>
      </div>

      {/* Current */}
      {latest && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Current</div>
            <div className="text-3xl font-black text-white">{latest.weight}<span className="text-sm text-gray-500 ml-1">lbs</span></div>
            <div className="text-xs text-gray-500">{latest.date}</div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Change</div>
            <div className={`text-3xl font-black ${diff>0?"text-red-400":diff<0?"text-green-400":"text-white"}`}>
              {diff !== null ? (diff > 0 ? `+${diff}` : diff) : "--"}<span className="text-sm text-gray-500 ml-1">lbs</span>
            </div>
            <div className="text-xs text-gray-500">since last entry</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">30-Day Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937"/>
              <XAxis dataKey="date" tick={{fill:"#6b7280",fontSize:9}} axisLine={false} tickLine={false} interval={4}/>
              <YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} domain={["auto","auto"]} width={35}/>
              <Tooltip contentStyle={{background:"#111827",border:"1px solid #374151",borderRadius:8,color:"#fff",fontSize:12}} formatter={(v)=>[`${v} lbs`]}/>
              <Line type="monotone" dataKey="w" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{r:4,fill:"#22c55e"}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-widest">History</div>
        {bodyweight.length === 0 && <div className="p-4 text-gray-500 text-sm">No entries yet.</div>}
        <div className="divide-y divide-gray-800">
          {[...bodyweight].reverse().slice(0,15).map((b,i) => (
            <div key={i} className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-400">{b.date}</span>
              <span className="text-sm font-black text-white">{b.weight} lbs</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab({ workouts, plans, schedule }) {
  const prs = getPRs(workouts);
  const weeklyData = calcWeeklyData(workouts);
  const streak = calcStreak(workouts, schedule);
  const totalWorkouts = workouts.length;
  const totalVol = workouts.reduce((a,w)=>a+(w.exercises?.reduce((b,e)=>b+(e.sets*e.reps*e.weight),0)??0),0);

  const muscleBreakdown = calcMuscleBreakdown(workouts);

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h2 className="text-2xl font-black">STATS</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Dumbbell size={16} className="text-orange-500"/>} val={totalWorkouts} label="Total Workouts"/>
        <StatCard icon={<Flame size={16} className="text-orange-500"/>} val={`${streak}w`} label="Streak"/>
        <StatCard icon={<Zap size={16} className="text-yellow-400"/>} val={fmt(totalVol)} label="Total Volume (lbs)"/>
        <StatCard icon={<Award size={16} className="text-yellow-400"/>} val={prs.length} label="PRs Tracked"/>
      </div>

      {/* Volume trend */}
      {weeklyData.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Weekly Volume (lbs)</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weeklyData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
              <XAxis dataKey="week" tick={{fill:"#6b7280",fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#6b7280",fontSize:9}} axisLine={false} tickLine={false} width={30} tickFormatter={fmt}/>
              <Tooltip contentStyle={{background:"#111827",border:"1px solid #374151",borderRadius:8,color:"#fff",fontSize:11}} formatter={(v)=>[`${fmt(v)} lbs`]}/>
              <Bar dataKey="vol" fill="#3b82f6" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Muscle breakdown */}
      {muscleBreakdown.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Volume by Muscle</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={muscleBreakdown} layout="vertical" barSize={12}>
              <XAxis type="number" tick={{fill:"#6b7280",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
              <YAxis type="category" dataKey="name" tick={{fill:"#9ca3af",fontSize:10}} axisLine={false} tickLine={false} width={70}/>
              <Tooltip contentStyle={{background:"#111827",border:"1px solid #374151",borderRadius:8,color:"#fff",fontSize:11}} formatter={(v)=>[`${fmt(v)} lbs`]}/>
              <Bar dataKey="vol" fill="#a855f7" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* PRs */}
      {prs.length > 0 && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center gap-2">
            <Award size={14} className="text-yellow-400"/>
            <span className="text-xs text-gray-500 uppercase tracking-widest">Personal Records</span>
          </div>
          <div className="divide-y divide-gray-800">
            {prs.map((pr,i) => (
              <div key={i} className="flex justify-between items-center px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-white">{pr.exercise}</div>
                  <div className="text-xs text-gray-500">{pr.date}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-yellow-400">{pr.weight} lbs</div>
                  <div className="text-xs text-gray-500">{pr.sets}×{pr.reps}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, val, label }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="mb-1">{icon}</div>
      <div className="text-2xl font-black text-white">{val}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ─── Data helpers ─────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10); }

function getExerciseHistory(workouts, name) {
  const results = [];
  workouts.forEach(w => {
    w.exercises?.forEach(e => {
      if (e.name.toLowerCase() === name.toLowerCase()) results.push({...e, date:w.date});
    });
  });
  return results.sort((a,b) => b.date.localeCompare(a.date));
}

function getPRs(workouts) {
  const bests = {};
  workouts.forEach(w => {
    w.exercises?.forEach(e => {
      const key = e.name;
      if (!bests[key] || e.weight > bests[key].weight || (e.weight === bests[key].weight && e.reps > bests[key].reps)) {
        bests[key] = {...e, date: w.date};
      }
    });
  });
  return Object.values(bests).sort((a,b)=>b.date.localeCompare(a.date));
}

function calcWeeklyVolume(workouts) {
  const ws = weekStart();
  return workouts
    .filter(w => w.date >= ws)
    .reduce((a,w) => a+(w.exercises?.reduce((b,e)=>b+(e.sets*e.reps*e.weight),0)??0), 0);
}

function calcStreak(workouts, schedule) {
  // Count consecutive weeks with at least one scheduled session completed
  if (workouts.length === 0) return 0;
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 52; i++) {
    const ws = new Date(now);
    ws.setDate(ws.getDate() - ws.getDay() - i*7);
    const we = new Date(ws); we.setDate(we.getDate()+6);
    const wsStr = ws.toISOString().slice(0,10);
    const weStr = we.toISOString().slice(0,10);
    const sessionThisWeek = workouts.some(w => w.date >= wsStr && w.date <= weStr);
    if (sessionThisWeek) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function calcWeeklyData(workouts) {
  const weeks = {};
  workouts.forEach(w => {
    const d = new Date(w.date);
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().slice(5,10);
    const vol = w.exercises?.reduce((a,e)=>a+(e.sets*e.reps*e.weight),0)??0;
    weeks[key] = (weeks[key]||0) + vol;
  });
  return Object.entries(weeks).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8).map(([week,vol])=>({week,vol}));
}

function last7Days(workouts) {
  const days = [];
  for (let i=6;i>=0;i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const ds = d.toISOString().slice(0,10);
    const vol = workouts.filter(w=>w.date===ds).reduce((a,w)=>a+(w.exercises?.reduce((b,e)=>b+(e.sets*e.reps*e.weight),0)??0),0);
    days.push({day:dayName(d.getDay()),vol});
  }
  return days;
}

function calcMuscleBreakdown(workouts) {
  const m = {};
  workouts.forEach(w => {
    w.exercises?.forEach(e => {
      const mg = e.muscleGroup||"Other";
      m[mg] = (m[mg]||0) + (e.sets*e.reps*e.weight);
    });
  });
  return Object.entries(m).map(([name,vol])=>({name,vol})).sort((a,b)=>b.vol-a.vol).slice(0,7);
}
