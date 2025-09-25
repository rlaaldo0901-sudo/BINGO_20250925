import React, { useEffect, useMemo, useState } from "react";

/** QR: 외부 API 이미지 방식 */
function QR({ value, size = 160 }: { value: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    value
  )}&size=${size}x${size}`;
  return <img alt="QR" src={src} width={size} height={size} />;
}

// ================= Types =================
type Cats = Record<string, string[]>;
type Config = {
  cats: Cats;
  size: number;
  lines: number;
  ord?: string[];
  updatedAt?: string;
  error?: string;
};
type Settings = { dataUrl: string };

// ================= Config =================
const SIZE = 4; // 4x4
const REQUIRED_LINES = 3; // 3줄 완성 시 BINGO

// ================= Utils =================
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCard(words: string[]): string[][] {
  const needed = SIZE * SIZE;
  if (words.length < needed) {
    throw new Error(
      `단어 풀이 부족합니다. (필요: ${needed}, 제공: ${words.length})`
    );
  }
  const picks = shuffle(words).slice(0, needed);
  const grid: string[][] = [];
  let idx = 0;
  for (let r = 0; r < SIZE; r++) {
    const row: string[] = [];
    for (let c = 0; c < SIZE; c++) row.push(picks[idx++]);
    grid.push(row);
  }
  return grid;
}

function countCompletedLines(marked: boolean[][]): number {
  let lines = 0;
  for (let r = 0; r < SIZE; r++) if (marked[r].every(Boolean)) lines++;
  for (let c = 0; c < SIZE; c++) {
    let all = true;
    for (let r = 0; r < SIZE; r++) if (!marked[r][c]) all = false;
    if (all) lines++;
  }
  let d1 = true,
    d2 = true;
  for (let i = 0; i < SIZE; i++) {
    if (!marked[i][i]) d1 = false;
    if (!marked[i][SIZE - 1 - i]) d2 = false;
  }
  if (d1) lines++;
  if (d2) lines++;
  return lines;
}

function baseUrl(): string {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return origin + pathname;
}

function getAllParams(): URLSearchParams {
  const search =
    typeof window !== "undefined" ? window.location.search : "";
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

// ================= Card =================
function Card({ grid }: { grid: string[][] }) {
  const [marked, setMarked] = useState<boolean[][]>(
    grid.map((row) => row.map(() => false))
  );
  useEffect(() => {
    setMarked(grid.map((row) => row.map(() => false)));
  }, [grid]);

  const lines = useMemo(() => countCompletedLines(marked), [marked]);
  const bingo = lines >= REQUIRED_LINES;
  function toggle(r: number, c: number) {
    setMarked((cur) =>
      cur.map((row, ri) =>
        row.map((m, ci) => (ri === r && ci === c ? !m : m))
      )
    );
  }
  return (
    <div className="w-full">
      <div className="grid grid-cols-4 gap-1 select-none">
        {grid.flatMap((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => toggle(r, c)}
              className={
                "aspect-square flex items-center justify-center rounded-xl border text-center p-2 text-sm sm:text-base md:text-lg lg:text-xl shadow-sm " +
                (marked[r][c]
                  ? "bg-green-100 border-green-300 line-through"
                  : "bg-white border-slate-200 hover:bg-slate-50")
              }
            >
              <span>{cell}</span>
            </button>
          ))
        )}
      </div>
      <div className="mt-3 text-center">
        <span
          className={
            "inline-block rounded-full px-3 py-1 text-sm font-semibold " +
            (bingo
              ? "bg-emerald-500 text-white"
              : "bg-slate-200 text-slate-700")
          }
        >
          {bingo
            ? `BINGO! (${lines}줄)`
            : `완성 줄: ${lines} / ${REQUIRED_LINES}`}
        </span>
      </div>
    </div>
  );
}

// ================= Player =================
function PlayerPageBase({ data }: { data: Config | null }) {
  const cats = data?.cats || {};
  const ord = Array.isArray(data?.ord)
    ? data!.ord!.filter((n) => (cats as Cats)[n])
    : null;
  const catNames = ord && ord.length ? ord : Object.keys(cats);
  const [cat, setCat] = useState<string>("");
  const [grid, setGrid] = useState<string[][] | null>(null);

  function pickCategory(name: string) {
    setCat(name);
    const words = (cats as Cats)[name] || [];
    try {
      setGrid(generateCard(words));
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (!data || catNames.length === 0) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-3">카테고리 선택</h1>
        <p className="text-sm text-slate-600">
          설정이 비어 있습니다. 편집자에게 최신 QR을 요청하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="relative p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">카테고리 선택</h1>
      {!cat ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {catNames.map((name) => (
            <button
              key={name}
              onClick={() => pickCategory(name)}
              className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-left"
            >
              <div className="font-semibold">{name}</div>
              <div className="text-xs text-slate-500">
                단어 {(cats as Cats)[name].length}개
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">{cat} BINGO</h2>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-xl border"
                onClick={() =>
                  setGrid(generateCard((cats as Cats)[cat]))
                }
              >
                새 카드
              </button>
              <button
                className="px-3 py-2 rounded-xl border"
                onClick={() => setCat("")}
              >
                카테고리 변경
              </button>
            </div>
          </div>
          <div className="max-w-md">
            {grid ? (
              <Card grid={grid} />
            ) : (
              <div className="text-sm text-slate-600">카드를 생성하세요.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerPage() {
  const params = getAllParams();
  const srcParam = params.get("src");
  const [remote, setRemote] = useState<Config | null>(null);

  useEffect(() => {
    let alive = true;
    async function fetchRemote() {
      if (!srcParam) return;
      try {
        const bust = `${srcParam}${
          srcParam.includes("?") ? "&" : "?"
        }_ts=${Date.now()}`;
        const res = await fetch(bust, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Config;
        if (alive) setRemote(json);
      } catch (e) {
        console.error("remote fetch error", e);
        if (alive)
          setRemote({
            cats: {},
            size: SIZE,
            lines: REQUIRED_LINES,
            error: "원격 데이터를 불러오지 못했습니다."
          });
      }
    }
    fetchRemote();
    return () => {
      alive = false;
    };
  }, [srcParam]);

  const data = remote ?? null;
  return (
    <PlayerPageBase
      data={data ?? { cats: {}, size: SIZE, lines: REQUIRED_LINES }}
    />
  );
}

// ================= Editor =================
export default function BingoApp() {
// 안전하게 ORIGIN 기준으로 고정 링크 생성
const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";
const playerLink = `${ORIGIN}/?view=player&src=${encodeURIComponent(`${ORIGIN}/bingo.json`)}`;
const editorLink = `${ORIGIN}/`;


  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <aside className="p-4 rounded-2xl border bg-white h-max">
          <h2 className="font-bold mb-3">배포용 링크 (고정)</h2>
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium mb-1">
                참여자 바로가기 링크
              </div>
              <div className="flex items-center justify-center p-3 rounded-xl border">
                <QR value={playerLink || ""} size={160} />
              </div>
              <input
                className="w-full mt-2 text-xs border rounded p-1"
                value={playerLink}
                readOnly
              />
            </div>
            <div>
              <div className="text-xs font-medium mb-1">편집자 링크</div>
              <input
                className="w-full text-xs border rounded p-1"
                value={editorLink}
                readOnly
              />
            </div>
          </div>
        </aside>

        <main className="lg:col-span-2 p-4 rounded-2xl border bg-white">
          <h1 className="text-xl font-bold">달빛캠프 · 빙고 편집자 페이지</h1>
          <p className="mt-2 text-sm text-slate-600">
            public/bingo.json 파일을 직접 수정하세요.
          </p>
        </main>
      </div>
    </div>
  );
}
