import type { Filter, WebFact, WebRecord, WebSession } from '../types';
import { filterEntries, formatTime, getSessionMode, getSessionTitle } from '../utils';
import { MessageItem } from './MessageItem';

interface MainPanelProps {
  session: WebSession | null;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
}

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'user', label: '用户' },
  { value: 'assistant', label: '助手' },
  { value: 'tool', label: '工具' },
];

const glassPanel =
  'flex min-h-0 flex-col overflow-hidden rounded-lg border border-black/10 bg-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl lg:h-[calc(100vh-2rem)] dark:border-white/10 dark:bg-[#0d1116]/75 dark:shadow-[0_18px_60px_rgba(0,0,0,0.42)]';

function FactGrid({ facts }: { facts: WebFact[] }) {
  if (facts.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
      {facts.slice(0, 12).map((fact, index) => (
        <div
          key={`${fact.seq}-${index}`}
          className="rounded-lg border border-black/10 bg-white/40 p-2.5 dark:border-white/10 dark:bg-white/5"
        >
          <div className="text-xs text-slate-400 dark:text-slate-500">{fact.kind}</div>
          <div className="mt-1 truncate text-sm text-slate-700 dark:text-slate-200">
            {fact.value || fact.key || String(fact.seq)}
          </div>
        </div>
      ))}
    </div>
  );
}

const payloadText = (payload: unknown): string => {
  if (typeof payload === 'string') {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    return JSON.stringify(payload);
  }
  return String(payload ?? '');
};

function RecordGrid({ records }: { records: WebRecord[] }) {
  if (records.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-bold text-slate-400 dark:text-slate-500">
        运行记录 ({records.length})
      </div>
      <div className="space-y-2">
        {records
          .slice(-20)
          .reverse()
          .map((record) => (
            <div
              key={record.id}
              className="rounded-lg border border-black/10 bg-white/40 p-2.5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
                <span>
                  {record.type}
                  {record.opKind ? ` / ${record.opKind}` : ''}
                </span>
                <span>{formatTime(record.timestamp)}</span>
              </div>
              <div className="mt-1.5 whitespace-pre-wrap break-words font-mono text-xs text-slate-600 dark:text-slate-300">
                {payloadText(record.payload)}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export function MainPanel({ session, filter, onFilterChange }: MainPanelProps) {
  const entries = session ? filterEntries(session.entries, filter) : [];

  return (
    <main className={glassPanel}>
      <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4 dark:border-white/10">
        <div className="min-w-0">
          <h1 className="break-words text-base font-bold text-slate-800 dark:text-slate-100">
            {session ? getSessionTitle(session) : 'Call Code'}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {session ? (
              <>
                <span className="rounded-lg border border-black/10 bg-white/40 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  {getSessionMode(session).toUpperCase()}
                </span>
                <span className="rounded-lg border border-black/10 bg-white/40 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  {session.entries.length} 条消息
                </span>
                <span className="rounded-lg border border-black/10 bg-white/40 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  tokens {session.stats?.totalTokens ?? 0}
                </span>
                <span className="rounded-lg border border-black/10 bg-white/40 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  成本 {session.stats?.costTotal ?? 0}
                </span>
                <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-black/10 bg-white/40 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  {session.cwd}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-black/10 p-2.5 dark:border-white/10">
        <div className="flex rounded-lg border border-black/10 bg-white/40 p-0.5 dark:border-white/10 dark:bg-white/5">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilterChange(item.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                filter === item.value
                  ? 'bg-white text-slate-900 shadow dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!session ? (
          <div className="grid min-h-40 place-items-center text-sm text-slate-400 dark:text-slate-500">
            暂无会话数据
          </div>
        ) : entries.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-slate-400 dark:text-slate-500">
            没有匹配的消息
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <MessageItem key={entry.id} entry={entry} />
            ))}
            {session.facts ? <FactGrid facts={session.facts} /> : null}
            {session.records ? <RecordGrid records={session.records} /> : null}
          </div>
        )}
      </div>
    </main>
  );
}
