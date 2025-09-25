import React, { useEffect, useMemo, useState } from "react";

/* ===== 공통 유틸 ===== */
const S = (v: any) => String(v ?? "");
const isArr = (v: any): v is any[] => Array.isArray(v);

/** 어떤 값이 와도 “텍스트로만” 안전하게 렌더 */
function Safe({ value }: { value: any }) {
  return <>{S(value)}</>;
}

/* ===== QR (외부 이미지 API, 의존성 0) ===== */
function QR({ value, size = 160 }: { value: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    value
  )}&size=${size}x${size}`;
  return <img alt="QR" src={src} width={size} height={size} />;
}

/* ===== 타입 ===== */
type Cats = Record<string, string[]>;
type Config = { cats: Cats; size: number; lines: number; ord?: string[] };

/* ===== 상수/유틸 ===== */
const SIZE = 4;
const REQUIRED_LINES = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 어떤 값이 들어와도 “문자열 배열”로 정규화 */
function normalizeWords(raw: any): string[] {
  if (!isArr(raw)) return [];
  return raw.map(S).map((s) => s.trim()).filter(Boolean);
}

/** JSON 전체를 안전하게 정규화 (모든 동적 값 → 문자열) */
function normalizeConfig(json: any): Config {
  const cats: Cats = {};
  const rawCats = json?.cats && typeof json.cats === "object" ? json.cats : {};
  for (const k of Object.keys(rawCats)) cats[S(k)] = normalizeWords(rawCats[k]);
  const ord: string[] = isArr(json?.ord) ? normalizeWords(json.ord) : Object.keys(cats);
  const size = Number(json?.size) || SIZE;
  const lines = Number(json?.lines) || REQUIRED_LINES;
  return { cats, size, lines, ord };
}

function generateCard(wordsInput: any): string[][] {
  const words = normalizeWords(wordsInput);
  const needed = SIZE * SIZE;
  if (words.length < needed) throw new Error(`단어 풀이 부족합니다. (필요: ${needed}, 제공: ${words.length})`);
  const picks = shuffle(words).slice(0, needed);
  const grid: string[][] = [];
  let idx = 0;
  for (let r = 0; r < SIZE; r++) {
    const row: string[] = [];
    for (let c = 0; c < SIZE; c++) row.push(S(picks[idx++]));
    grid.push(row);
  }
  return grid;
}

function countCompletedLines(marked: boolean[][]): number {
  let lines = 0;
  for (let r = 0; r < SIZE; r++) if (marked[r].every(Boolean)) lines++;
  for (let c = 0; c < SIZE; c++) {
    let ok = true;
    for (let r = 0; r < SIZE; r++) if (!marked[r][c]) ok = false;
    if (ok) lines++;
  }
  let d1 = true, d2 = true;
  for (let i = 0; i < SIZE; i++) {
    if (!marked[i][i]) d1 = false;
    if (!marked[i][SIZE - 1 - i]) d2 = false;
  }
  if (d1) lines++;
  if (d2) lines++;
  return lines;
}

function getParams(): URLSearchParams {
  const s = typeof window !== "undefined" ? window.location.search : "";
  return new URLSearchParams(s.startsWith("?") ? s.slice(1) : s);
}
function isPlayerRoute(): boolean {
  if (typeof window === "undefined") return false;
  return getParams().get("view") === "player";
}

/* ===== Error Boundary ===== */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err?: any }> {
  constructor(p: any) { super(p); this.state = {}; }
  static getDerivedStateFromError(err: any) { return { err }; }
  componentDidCatch(err: any, info: any) { console.error("Render error:", err, info); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 16, color: "#b91c1c" }}>
          <h2 style={{ fontWeight: 800, marginBottom: 8 }}>화면 렌더링 오류</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}><Safe value={this.state.err?.message || this.state.err} /></pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ===== 카드 (모든 텍스트 Safe로 렌더) ===== */
function Card({ grid }: { grid: string[][] }) {
  const safeGrid = useMemo(() => grid.map((row) => row.map((cell) => S(cell))), [grid]);
  const [marked, setMarked] = useState<boolean[][]>(safeGrid.map((r) => r.map(() => false)));
  useEffect(() => setMarked(safeGrid.map((r) => r.map(() => false))), [safeGrid]);
  const lines = useMemo(() => countCompletedLines(marked), [marked]);
  const bingo = lines >= REQUIRED_LINES;

  const toggle = (r: number, c: number) =>
    setMarked((cur) => cur.map((row, ri) => row.map((m, ci) => (ri === r && ci === c ? !m : m))));

  const cells: React.ReactElement[] = [];
  for (let r = 0; r < safeGrid.length; r++) {
    for (let c = 0; c < safeGrid[r].length; c++) {
      const cell = safeGrid[r][c];
      cells.push(
        <button
          key={`${r}-${c}`}
          onClick={() => toggle(r, c)}
          style={{
            aspectRatio: "1/1",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: 8,
            background: marked[r][c] ? "#dcfce7" : "#fff",
            textDecoration: marked[r][c] ? "line-through" : "none",
            boxShadow: "0 1px 2px rgba(0,0,0,.06)"
          }}
        >
          <Safe value={cell} />
        </button>
      );
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>{cells}</div>
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            fontWeight: 600,
            background: bingo ? "#10b981" : "#e2e8f0",
            color: bingo ? "#fff" : "#334155"
          }}
        >
          <Safe value={bingo ? `BINGO! (${lines}줄)` : `완성 줄: ${lines} / ${REQUIRED_LINES}`} />
        </span>
      </div>
    </div>
  );
}

/* ===== 플레이어 (고정 JSON 로드) ===== */
function PlayerPage() {
  const params = getParams();
  const src = params.get("src");
  const [data, setData] = useState<Config | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!src) { setErr("URL에 src 파라미터가 없습니다."); return; }
      try {
        const bust = `${src}${src.includes("?") ? "&" : "?"}_ts=${Date.now()}`;
        const res = await fetch(bust, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const cfg = normalizeConfig(json);
        if (!Object.keys(cfg.cats).length) throw new Error("cats 안에 카테고리가 없습니다.");
        if (alive) setData(cfg);
      } catch (e: any) {
        if (alive) setErr(S(e?.message || e));
      }
    })();
    return () => { alive = false; };
  }, [src]);

  if (err) return <div style={{ padding: 16, color: "#b91c1c" }}>에러: <Safe value={err} /></div>;
  if (!data) return <div style={{ padding: 16 }}><Safe value="불러오는 중…" /></div>;

  const cats = data.cats;
  const ord = (data.ord && data.ord.length ? data.ord : Object.keys(cats)).filter((n) => !!cats[n]);

  const [cat, setCat] = useState<string>("");
  const [grid, setGrid] = useState<string[][] | null>(null);

  const pick = (name: string) => {
    setCat(S(name));
    try { setGrid(generateCard(cats[name])); } catch (e: any) { alert(S(e?.message || e)); }
  };

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      {!cat ? (
        <>
          <h1 style={{ fontWeight: 800, fontSize: 20, marginBottom: 12 }}><Safe value="달빛캠프 · 카테고리 선택" /></h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {ord.map((raw) => {
              const name = S(raw);
              const count = isArr(cats[name]) ? cats[name].length : 0;
              return (
                <button
                  key={name}
                  onClick={() => pick(name)}
                  style={{ padding: 12, borderRadius: 12, border: "1px solid #e2e8f0", background: "#f1f5f9", textAlign: "left" }}
                >
                  <div style={{ fontWeight: 600 }}><Safe value={name} /></div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    <Safe value={`단어 ${count}개`} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontWeight: 700 }}><Safe value={`${cat} BINGO`} /></h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0" }}
                      onClick={() => setGrid(generateCard(cats[cat]))}><Safe value="새 카드" /></button>
              <button style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0" }}
                      onClick={() => setCat("")}><Safe value="카테고리 변경" /></button>
            </div>
          </div>
          <div style={{ maxWidth: 480 }}>
            {grid ? <Card grid={grid} /> : <div style={{ fontSize: 14, color: "#64748b" }}><Safe value="카드를 생성하세요." /></div>}
          </div>
        </>
      )}
    </div>
  );
}

/* ===== 편집자 (고정 링크/QR) ===== */
function EditorPage() {
  const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";
  const playerLink = `${ORIGIN}/?view=player&src=${encodeURIComponent(`${ORIGIN}/bingo.json`)}`;
  const editorLink = `${ORIGIN}/`;

  return (
    <div style={{ minHeight: "100vh", padding: 16, background: "linear-gradient(#fff,#f8fafc)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
        <aside style={{ padding: 16, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", height: "max-content" }}>
          <h2 style={{ fontWeight: 700, marginBottom: 12 }}><Safe value="배포용 링크 (고정)" /></h2>

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}><Safe value="참여자 바로가기 링크" /></div>
          <div style={{ display: "flex", justifyContent: "center", padding: 12, border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <QR value={playerLink} size={160} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input readOnly value={playerLink} style={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8, padding: 6 }} />
            <a href={playerLink} target="_blank" rel="noreferrer"
               style={{ fontSize: 12, background: "#059669", color: "#fff", padding: "6px 10px", borderRadius: 8, textDecoration: "none", textAlign: "center" }}>
              <Safe value="열기" />
            </a>
            <button onClick={() => navigator.clipboard.writeText(playerLink)}
                    style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <Safe value="복사" />
            </button>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 6 }}><Safe value="편집자 링크" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
            <input readOnly value={editorLink} style={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8, padding: 6 }} />
            <a href={editorLink} target="_blank" rel="noreferrer"
               style={{ fontSize: 12, background: "#0f172a", color: "#fff", padding: "6px 10px", borderRadius: 8, textDecoration: "none", textAlign: "center" }}>
              <Safe value="열기" />
            </a>
            <button onClick={() => navigator.clipboard.writeText(editorLink)}
                    style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <Safe value="복사" />
            </button>
          </div>
        </aside>

        <main style={{ padding: 16, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff" }}>
          <h1 style={{ fontWeight: 800, fontSize: 22 }}><Safe value="달빛캠프 · 빙고 편집자 페이지" /></h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>
            <code>public/bingo.json</code> <Safe value="파일을 직접 수정하세요. 수정 후 커밋하면 같은 QR/링크로 참가자 페이지가 자동 업데이트됩니다." />
          </p>
        </main>
      </div>
    </div>
  );
}

/* ===== 루트 ===== */
export default function App() {
  return <ErrorBoundary>{isPlayerRoute() ? <PlayerPage /> : <EditorPage />}</ErrorBoundary>;
}
